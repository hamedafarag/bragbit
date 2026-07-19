import { BRAG_CATEGORY_VALUES, type BragInput } from "@/features/brag/schema";

import type { Provider, SourceType } from "./schema";

// Pure candidate → brag mapping (docs/specs/integrations.md §GitHub → brag mapping).
// The import fills the "what" — title, date, source link; the user adds the "why it
// mattered + result" (impact) on approve. No db, no env, no server-only, so it's
// unit-testable in isolation and safe to reuse from the approve action.

/**
 * The parsed `payload` subset the mapping reads. A union of every provider's extras:
 * GitHub PRs carry `number`/`repo`, Linear issues carry `identifier`/`team`; `body`
 * (the source description) is shared. Stored as JSON, so this is a widening, not a schema.
 */
export type CandidatePayload = {
  number?: number;
  repo?: string;
  identifier?: string;
  team?: string;
  body?: string;
};

/** The candidate fields the mapping needs (a subset of the import_candidate row, payload parsed). */
export type CandidateForMapping = {
  provider: Provider;
  title: string;
  occurredAt: Date | null;
  suggestedCategory: string | null;
  externalUrl: string;
  sourceType: SourceType;
  payload: CandidatePayload | null;
};

/** A calendar date (YYYY-MM-DD) for the brag; falls back to today when the source has none. */
function toDateString(d: Date | null): string {
  return (d ?? new Date()).toISOString().slice(0, 10);
}

/** A human label for the source link, e.g. "PR #123 in acme/web" or "ENG-42 in Platform". */
function linkLabel(c: CandidateForMapping): string {
  if (c.provider === "github" && c.sourceType === "pull_request" && c.payload?.number) {
    const where = c.payload.repo ? ` in ${c.payload.repo}` : "";
    return `PR #${c.payload.number}${where}`;
  }
  if (c.provider === "linear" && c.sourceType === "issue" && c.payload?.identifier) {
    const where = c.payload.team ? ` in ${c.payload.team}` : "";
    return `${c.payload.identifier}${where}`;
  }
  return "Source";
}

/** Map a candidate to brag editor input, defaulting the fields the source can fill. */
export function candidateToBragInput(c: CandidateForMapping): BragInput {
  const category = (BRAG_CATEGORY_VALUES as readonly string[]).includes(c.suggestedCategory ?? "")
    ? (c.suggestedCategory as BragInput["category"])
    : "";
  return {
    title: c.title,
    date: toDateString(c.occurredAt),
    category,
    status: "shipped", // a merged PR (or resolved issue) shipped
    descriptionMd: c.payload?.body?.trim() || "",
    impactMd: "", // the user adds the "why it mattered + result"
    collaborators: "",
    attribution: "",
    links: [{ url: c.externalUrl, label: linkLabel(c) }],
    tags: [],
    visibility: "shared",
  };
}
