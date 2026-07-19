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

describe("candidateToBragInput — Linear issues", () => {
  const linear: CandidateForMapping = {
    provider: "linear",
    title: "Harden the webhook endpoint",
    occurredAt: new Date("2026-04-10T12:00:00Z"),
    suggestedCategory: "shipped-work",
    externalUrl: "https://linear.app/acme/issue/ENG-42",
    sourceType: "issue",
    payload: { identifier: "ENG-42", team: "Platform", body: "Retry with backoff on 5xx." },
  };

  it("labels the source link with the issue identifier and team", () => {
    const b = candidateToBragInput(linear);
    expect(b.status).toBe("shipped");
    expect(b.descriptionMd).toBe("Retry with backoff on 5xx.");
    expect(b.impactMd).toBe("");
    expect(b.links).toEqual([
      { url: "https://linear.app/acme/issue/ENG-42", label: "ENG-42 in Platform" },
    ]);
  });

  it("omits the team from the label when absent", () => {
    const b = candidateToBragInput({ ...linear, payload: { identifier: "ENG-7" } });
    expect(b.links[0]!.label).toBe("ENG-7");
  });
});
