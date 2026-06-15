import { describe, expect, it } from "vitest";

import type { BragWithRelations } from "@/features/brag/queries";

import { documentToMarkdown, type ExportDocumentData } from "./markdown";

function brag(over: Partial<BragWithRelations> & { id: string; title: string; date: string }) {
  return {
    documentId: "doc",
    descriptionMd: null,
    impactMd: null,
    category: null,
    status: null,
    visibility: "shared",
    collaborators: null,
    attribution: null,
    search: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    links: [],
    attachments: [],
    tags: [],
    ...over,
  } as unknown as BragWithRelations;
}

const baseDoc: ExportDocumentData = {
  title: "2026",
  description: "The year of shipping",
  periodStart: "2026-01-01",
  periodEnd: "2026-12-31",
  goalsMd: "Own platform reliability.",
  brags: [],
};

describe("documentToMarkdown", () => {
  it("renders the document metadata, period, and goals", () => {
    const md = documentToMarkdown(baseDoc);
    expect(md).toContain("# 2026");
    expect(md).toContain("_Jan 1, 2026 — Dec 31, 2026_");
    expect(md).toContain("The year of shipping");
    expect(md).toContain("## Goals & focus areas");
    expect(md).toContain("Own platform reliability.");
    expect(md.endsWith("\n")).toBe(true);
  });

  it("groups brags by month newest-first with the genre's fields", () => {
    const md = documentToMarkdown({
      ...baseDoc,
      brags: [
        brag({
          id: "b1",
          title: "Shipped the heatmap",
          date: "2026-06-12",
          category: "shipped-work",
          status: "shipped",
          impactMd: "Cart abandonment 40% → 28%",
          descriptionMd: "Led the rollout.",
          links: [
            { id: "l1", bragId: "b1", url: "https://x.test/pr/1", label: "PR #1", position: 0 },
          ],
          attachments: [
            {
              id: "a1",
              bragId: "b1",
              storageKey: "k",
              fileName: "dash.png",
              mimeType: "image/png",
              sizeBytes: 1536,
              createdAt: new Date(),
            },
          ],
          tags: ["platform"],
        }),
        brag({ id: "b2", title: "Mentored two juniors", date: "2026-05-03" }),
      ],
    });

    expect(md).toContain("## June 2026");
    expect(md).toContain("### Shipped the heatmap");
    expect(md).toContain("**Jun 12, 2026** · Shipped work · Shipped");
    expect(md).toContain("> Cart abandonment 40% → 28%");
    expect(md).toContain("[PR #1](https://x.test/pr/1)");
    expect(md).toContain("**Attachments:** dash.png (1.5 KB)");
    expect(md).toContain("#platform");
    expect(md).toContain("## May 2026");
    // newest month comes first
    expect(md.indexOf("## June 2026")).toBeLessThan(md.indexOf("## May 2026"));
  });

  it("omits optional sections cleanly and handles an empty document", () => {
    const minimal = documentToMarkdown({
      title: "Empty",
      description: null,
      periodStart: null,
      periodEnd: null,
      goalsMd: null,
      brags: [],
    });
    expect(minimal).toContain("# Empty");
    expect(minimal).not.toContain("Goals & focus areas");
    expect(minimal).toContain("_No wins to show._");
  });
});
