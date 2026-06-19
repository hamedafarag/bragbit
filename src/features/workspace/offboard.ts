import "server-only";

import { eq } from "drizzle-orm";

import { MemberRemoved } from "@/emails/member-removed";
import { toDataExport } from "@/features/export/json";
import { documentToMarkdown, type ExportDocumentData } from "@/features/export/markdown";
import { getAllDataForExport } from "@/features/export/queries";
import { emailBrandFromOrg } from "@/lib/branding";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { sendEmail, type EmailAttachment } from "@/lib/email/send";
import { getStorage } from "@/lib/storage";

import { pickFilesWithinCap, uniqueName } from "./offboard-bundle";

/** Cap on the binary files bundled into the removal email; JSON + Markdown are always included. */
const MAX_BINARY_BUNDLE_BYTES = 20 * 1024 * 1024;

/**
 * Email a removed member a copy of all their data in the workspace (ENH-CO-01) —
 * a portability courtesy so a deactivated member doesn't lose their career record.
 * The bundle is the same export they could download while active: a full JSON
 * (every document + brag, private included) and a combined Markdown, plus the
 * actual attachment files up to a size cap (oversized ones are listed in the JSON,
 * not bundled). Branded to the workspace they're leaving.
 *
 * Best-effort by contract: the caller (`removeMember`) ignores failures so a mail
 * hiccup never blocks the removal — the underlying data still persists for a manual
 * export. Call this *before* purging the membership.
 */
export async function emailRemovedMemberBundle(scope: {
  workspaceId: string;
  userId: string;
  email: string;
}): Promise<void> {
  const loaded = await getAllDataForExport(scope);

  const json = JSON.stringify(
    toDataExport({ ...loaded, exportedAt: new Date().toISOString() }),
    null,
    2,
  );
  const markdown = loaded.documents
    .map(({ document: d, brags }) => {
      const doc: ExportDocumentData = {
        title: d.title,
        description: d.description,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        goalsMd: d.goalsMd,
        brags,
      };
      return documentToMarkdown(doc);
    })
    .join("\n\n---\n\n");

  const allFiles = loaded.documents.flatMap(({ brags }) =>
    brags.flatMap((b) =>
      b.attachments.map((a) => ({
        storageKey: a.storageKey,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
    ),
  );
  const { included, skipped } = pickFilesWithinCap(allFiles, MAX_BINARY_BUNDLE_BYTES);

  const attachments: EmailAttachment[] = [
    {
      filename: "bragbit-data.json",
      content: Buffer.from(json, "utf8"),
      contentType: "application/json",
    },
    {
      filename: "bragbit-wins.md",
      content: Buffer.from(markdown, "utf8"),
      contentType: "text/markdown",
    },
  ];

  const storage = getStorage();
  const seen = new Set(attachments.map((a) => a.filename));
  let skippedCount = skipped.length;
  for (const f of included) {
    try {
      const content = await storage.get(f.storageKey);
      attachments.push({
        filename: uniqueName(f.fileName, seen),
        content,
        contentType: f.mimeType,
      });
    } catch {
      // A missing object shouldn't sink the whole bundle — skip just this file.
      skippedCount += 1;
    }
  }

  const [org] = await db
    .select({
      name: organization.name,
      accentColor: organization.accentColor,
      logoKey: organization.logoKey,
    })
    .from(organization)
    .where(eq(organization.id, scope.workspaceId))
    .limit(1);
  const brand = emailBrandFromOrg({
    name: org?.name ?? loaded.workspace.name,
    accentColor: org?.accentColor,
    logoKey: org?.logoKey,
  });

  await sendEmail({
    to: scope.email,
    subject: `Your ${brand.name} data — a copy for your records`,
    template: MemberRemoved({
      brand,
      workspaceName: brand.name,
      documentCount: loaded.documents.length,
      fileCount: attachments.length - 2, // minus the JSON + Markdown
      skippedCount,
    }),
    attachments,
  });
}
