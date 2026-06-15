import type { BragWithRelations } from "@/features/brag/queries";
import type { DocumentRow } from "@/features/document/queries";

/**
 * The shape of a full-data JSON export (PLAN §7 — full portability). Explicitly
 * mapped (not raw rows) so internal columns — the FTS `search` vector, the
 * workspace/user foreign keys — never leak, and the format is a stable contract.
 * Includes EVERYTHING the owner owns: archived documents and private brags too
 * (this is their own copy, not a share). Attachment binaries aren't inlined; their
 * metadata is, and the files download from the app.
 */
export type DataExport = {
  version: 1;
  exportedAt: string;
  workspace: { name: string; type: string };
  account: { email: string; displayName: string | null };
  documents: Array<{
    id: string;
    title: string;
    description: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    goalsMd: string | null;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string;
    brags: Array<{
      id: string;
      date: string;
      title: string;
      category: string | null;
      status: string | null;
      visibility: string;
      descriptionMd: string | null;
      impactMd: string | null;
      collaborators: string[];
      attribution: string | null;
      tags: string[];
      links: Array<{ url: string; label: string | null; position: number }>;
      attachments: Array<{ fileName: string; mimeType: string; sizeBytes: number }>;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
};

export type DataExportInput = {
  exportedAt: string;
  workspace: { name: string; type: string };
  account: { email: string; displayName: string | null };
  documents: Array<{ document: DocumentRow; brags: BragWithRelations[] }>;
};

/** Shape loaded rows into the export contract — pure, so it's unit-testable. */
export function toDataExport(input: DataExportInput): DataExport {
  return {
    version: 1,
    exportedAt: input.exportedAt,
    workspace: input.workspace,
    account: input.account,
    documents: input.documents.map(({ document: d, brags }) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      goalsMd: d.goalsMd,
      archivedAt: d.archivedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      brags: brags.map((b) => ({
        id: b.id,
        date: b.date,
        title: b.title,
        category: b.category,
        status: b.status,
        visibility: b.visibility,
        descriptionMd: b.descriptionMd,
        impactMd: b.impactMd,
        collaborators: b.collaborators ?? [],
        attribution: b.attribution,
        tags: b.tags,
        links: b.links.map((l) => ({ url: l.url, label: l.label, position: l.position })),
        attachments: b.attachments.map((a) => ({
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    })),
  };
}
