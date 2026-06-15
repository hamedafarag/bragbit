import type { BragWithRelations } from "@/features/brag/queries";
import { BRAG_CATEGORIES } from "@/features/brag/schema";

/** Input for the Markdown assembler — a document plus its (already-filtered) brags. */
export type ExportDocumentData = {
  title: string;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  goalsMd: string | null;
  brags: BragWithRelations[];
};

const CATEGORY_LABEL = new Map<string, string>(BRAG_CATEGORIES.map((c) => [c.value, c.label]));
const STATUS_LABEL: Record<string, string> = { shipped: "Shipped", in_progress: "In progress" };

const longDate: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

function fmtDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", longDate);
}

function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Human-readable file size for the attachment manifest (export is text-only). */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${fmtDate(start)} — ${fmtDate(end)}`;
  return start ? `From ${fmtDate(start)}` : `Until ${fmtDate(end!)}`;
}

/** One brag → its Markdown block (heading, meta line, impact, description, relations). */
function bragToMarkdown(brag: BragWithRelations): string[] {
  const lines: string[] = [`### ${brag.title}`, ""];

  const meta = [`**${fmtDate(brag.date)}**`];
  const cat = brag.category ? CATEGORY_LABEL.get(brag.category) : null;
  if (cat) meta.push(cat);
  if (brag.status && STATUS_LABEL[brag.status]) meta.push(STATUS_LABEL[brag.status]!);
  lines.push(meta.join(" · "), "");

  if (brag.impactMd) lines.push(`> ${brag.impactMd.replace(/\n/g, "\n> ")}`, "");
  if (brag.descriptionMd) lines.push(brag.descriptionMd, "");

  if (brag.links.length > 0) {
    const rendered = brag.links.map((l) => `[${l.label || l.url}](${l.url})`).join(", ");
    lines.push(`**Links:** ${rendered}`, "");
  }
  if (brag.attachments.length > 0) {
    const rendered = brag.attachments
      .map((a) => `${a.fileName} (${formatBytes(a.sizeBytes)})`)
      .join(", ");
    lines.push(`**Attachments:** ${rendered}`, "");
  }
  if (brag.collaborators && brag.collaborators.length > 0) {
    lines.push(`**Collaborators:** ${brag.collaborators.join(", ")}`, "");
  }
  if (brag.attribution) lines.push(`**Recognized by:** ${brag.attribution}`, "");
  if (brag.tags.length > 0) lines.push(brag.tags.map((t) => `#${t}`).join(" "), "");

  return lines;
}

/**
 * A document and its brags → a self-contained Markdown export (PLAN.md §6/§7):
 * metadata + goals, then brags grouped by month newest-first, with the genre's
 * fields, Markdown links, and a text attachment manifest (sizes; the binaries
 * aren't bundled here). Pure — visibility filtering happens upstream, so whatever
 * brags are passed are exported as-is. High-trust string assembly, no escaping
 * games: titles/descriptions are the user's own Markdown, included verbatim.
 */
export function documentToMarkdown(doc: ExportDocumentData): string {
  const lines: string[] = [`# ${doc.title}`, ""];

  const period = formatPeriod(doc.periodStart, doc.periodEnd);
  if (period) lines.push(`_${period}_`, "");
  if (doc.description) lines.push(doc.description, "");
  if (doc.goalsMd) lines.push("## Goals & focus areas", "", doc.goalsMd, "");

  if (doc.brags.length === 0) {
    lines.push("---", "", "_No wins to show._", "");
    return lines.join("\n").trimEnd() + "\n";
  }

  let currentMonth = "";
  for (const brag of doc.brags) {
    const key = brag.date.slice(0, 7); // YYYY-MM (brags arrive newest-first)
    if (key !== currentMonth) {
      currentMonth = key;
      lines.push("---", "", `## ${monthLabel(key)}`, "");
    }
    lines.push(...bragToMarkdown(brag));
  }

  return lines.join("\n").trimEnd() + "\n";
}
