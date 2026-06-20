import type { LinkRow } from "./components/links-field";
import { bragSchema } from "./schema";

/**
 * Parse the brag editor's submitted FormData (plus the state-managed links and
 * tags) through `bragSchema`. Pure — no DOM — so it's unit-testable apart from the
 * dialog (ENH-CQ-03). The "private" checkbox maps to the visibility enum, and
 * blank link rows are dropped here so an empty row never trips URL validation.
 */
export function parseBragForm(fd: FormData, links: LinkRow[], tags: string[]) {
  return bragSchema.safeParse({
    title: String(fd.get("title") ?? ""),
    date: String(fd.get("date") ?? ""),
    category: String(fd.get("category") ?? ""),
    status: String(fd.get("status") ?? ""),
    descriptionMd: String(fd.get("descriptionMd") ?? ""),
    impactMd: String(fd.get("impactMd") ?? ""),
    collaborators: String(fd.get("collaborators") ?? ""),
    attribution: String(fd.get("attribution") ?? ""),
    links: links.filter((l) => l.url.trim() !== ""),
    tags,
    visibility: fd.get("private") ? "private" : "shared",
  });
}
