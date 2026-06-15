import { describe, expect, it } from "vitest";

import type { BragWithRelations } from "@/features/brag/queries";
import type { DocumentRow } from "@/features/document/queries";

import { toDataExport, type DataExportInput } from "./json";

const at = new Date("2026-06-01T00:00:00Z");

function doc(over: Partial<DocumentRow> & { id: string; title: string }): DocumentRow {
  return {
    workspaceId: "ws",
    userId: "u",
    description: null,
    periodStart: null,
    periodEnd: null,
    goalsMd: null,
    archivedAt: null,
    createdAt: at,
    updatedAt: at,
    ...over,
  } as DocumentRow;
}

function brag(over: Partial<BragWithRelations> & { id: string; title: string }): BragWithRelations {
  return {
    documentId: "d1",
    date: "2026-06-12",
    descriptionMd: null,
    impactMd: null,
    category: null,
    status: null,
    visibility: "shared",
    collaborators: null,
    attribution: null,
    search: null,
    createdAt: at,
    updatedAt: at,
    links: [],
    attachments: [],
    tags: [],
    ...over,
  } as unknown as BragWithRelations;
}

const input: DataExportInput = {
  exportedAt: "2026-06-15T12:00:00.000Z",
  workspace: { name: "Ada's Logbook", type: "personal" },
  account: { email: "ada@test.local", displayName: "Ada" },
  documents: [
    {
      document: doc({ id: "d1", title: "2026", archivedAt: at }),
      brags: [
        brag({ id: "b1", title: "Public win", visibility: "shared", tags: ["platform"] }),
        brag({ id: "b2", title: "Secret win", visibility: "private" }),
      ],
    },
  ],
};

describe("toDataExport", () => {
  it("produces a versioned, self-describing structure", () => {
    const out = toDataExport(input);
    expect(out.version).toBe(1);
    expect(out.exportedAt).toBe("2026-06-15T12:00:00.000Z");
    expect(out.workspace).toEqual({ name: "Ada's Logbook", type: "personal" });
    expect(out.account).toEqual({ email: "ada@test.local", displayName: "Ada" });
  });

  it("includes archived documents and private brags (it's the owner's full copy)", () => {
    const out = toDataExport(input);
    expect(out.documents[0]!.archivedAt).toBe(at.toISOString());
    const visibilities = out.documents[0]!.brags.map((b) => b.visibility);
    expect(visibilities).toContain("private");
    expect(out.documents[0]!.brags).toHaveLength(2);
  });

  it("maps explicitly — no internal columns leak", () => {
    const out = toDataExport(input);
    const firstBrag = out.documents[0]!.brags[0]!;
    expect(firstBrag).not.toHaveProperty("search");
    expect(firstBrag).not.toHaveProperty("documentId");
    expect(out.documents[0]).not.toHaveProperty("workspaceId");
    expect(out.documents[0]).not.toHaveProperty("userId");
    // Dates are serialized to ISO strings.
    expect(firstBrag.createdAt).toBe(at.toISOString());
  });
});
