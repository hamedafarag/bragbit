import { describe, expect, it } from "vitest";

import { bragSchema } from "./schema";
import { BRAG_TEMPLATES, templateToInitial, type BragTemplate } from "./templates";

const TODAY = "2026-06-21";

describe("BRAG_TEMPLATES", () => {
  it("has unique ids and non-empty labels + scaffolds", () => {
    const ids = BRAG_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of BRAG_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.descriptionMd.length).toBeGreaterThan(0);
    }
  });

  it("seeds a scaffold that becomes a valid brag once a title is added", () => {
    for (const t of BRAG_TEMPLATES) {
      const parsed = bragSchema.safeParse({ ...templateToInitial(t, TODAY), title: t.label });
      expect(parsed.success).toBe(true);
    }
  });
});

describe("templateToInitial", () => {
  const withStatus: BragTemplate = {
    id: "x",
    label: "X",
    category: "shipped-work",
    status: "shipped",
    descriptionMd: "d",
  };
  const withoutStatus: BragTemplate = {
    id: "y",
    label: "Y",
    category: "leadership",
    descriptionMd: "d2",
  };

  it("seeds category, status, description, and the injected date", () => {
    const v = templateToInitial(withStatus, TODAY);
    expect(v.category).toBe("shipped-work");
    expect(v.status).toBe("shipped");
    expect(v.descriptionMd).toBe("d");
    expect(v.date).toBe(TODAY);
  });

  it("defaults status to '' when the template has none", () => {
    expect(templateToInitial(withoutStatus, TODAY).status).toBe("");
  });

  it("leaves the rest of the form at empty defaults", () => {
    const v = templateToInitial(withStatus, TODAY);
    expect(v.title).toBe("");
    expect(v.impactMd).toBe("");
    expect(v.collaborators).toBe("");
    expect(v.attribution).toBe("");
    expect(v.visibility).toBe("shared");
    expect(v.links).toEqual([]);
    expect(v.tags).toEqual([]);
    expect(v.attachments).toEqual([]);
  });
});
