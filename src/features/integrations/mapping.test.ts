import { describe, expect, it } from "vitest";

import { candidateToBragInput, type CandidateForMapping } from "./mapping";

const base: CandidateForMapping = {
  provider: "github",
  title: "Ship the crew heatmap",
  occurredAt: new Date("2026-03-02T10:00:00Z"),
  suggestedCategory: "shipped-work",
  externalUrl: "https://github.com/acme/web/pull/42",
  sourceType: "pull_request",
  payload: { number: 42, repo: "acme/web", body: "Rendered the realtime heatmap." },
};

describe("candidateToBragInput", () => {
  it("maps a GitHub PR to brag input with a source link and empty impact", () => {
    const b = candidateToBragInput(base);
    expect(b.title).toBe("Ship the crew heatmap");
    expect(b.date).toBe("2026-03-02");
    expect(b.category).toBe("shipped-work");
    expect(b.status).toBe("shipped");
    expect(b.descriptionMd).toBe("Rendered the realtime heatmap.");
    expect(b.impactMd).toBe(""); // the user adds the "why it mattered"
    expect(b.visibility).toBe("shared");
    expect(b.links).toEqual([
      { url: "https://github.com/acme/web/pull/42", label: "PR #42 in acme/web" },
    ]);
  });

  it("drops an unknown category to empty", () => {
    expect(candidateToBragInput({ ...base, suggestedCategory: "not-a-category" }).category).toBe(
      "",
    );
    expect(candidateToBragInput({ ...base, suggestedCategory: null }).category).toBe("");
  });

  it("falls back to today's date when the source has none", () => {
    const b = candidateToBragInput({ ...base, occurredAt: null });
    expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles a missing payload (no body, generic link label)", () => {
    const b = candidateToBragInput({ ...base, payload: null });
    expect(b.descriptionMd).toBe("");
    expect(b.links[0]!.label).toBe("Source");
  });
});
