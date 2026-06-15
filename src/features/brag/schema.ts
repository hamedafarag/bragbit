import { z } from "zod";

// Fixed category taxonomy (PLAN.md §5), paired with the 8 logbook category
// colors. The `dot` classes are written as literals so Tailwind generates them.
export const BRAG_CATEGORY_VALUES = [
  "shipped-work",
  "technical-contribution",
  "collaboration-mentoring",
  "leadership",
  "recognition-feedback",
  "skills-learning",
  "glue-process-work",
  "other",
] as const;

export const bragCategorySchema = z.enum(BRAG_CATEGORY_VALUES);
export type BragCategory = (typeof BRAG_CATEGORY_VALUES)[number];

export const BRAG_CATEGORIES: { value: BragCategory; label: string; dot: string }[] = [
  { value: "shipped-work", label: "Shipped work", dot: "bg-cat-shipped" },
  { value: "technical-contribution", label: "Technical", dot: "bg-cat-technical" },
  { value: "collaboration-mentoring", label: "Collaboration", dot: "bg-cat-collaboration" },
  { value: "leadership", label: "Leadership", dot: "bg-cat-leadership" },
  { value: "recognition-feedback", label: "Recognition", dot: "bg-cat-recognition" },
  { value: "skills-learning", label: "Skills & learning", dot: "bg-cat-skills" },
  { value: "glue-process-work", label: "Glue work", dot: "bg-cat-glue" },
  { value: "other", label: "Other", dot: "bg-cat-other" },
];

export const BRAG_STATUS_VALUES = ["shipped", "in_progress"] as const;
export const bragStatusSchema = z.enum(BRAG_STATUS_VALUES);
export type BragStatus = (typeof BRAG_STATUS_VALUES)[number];

const optionalText = (max: number) => z.string().trim().max(max).default("");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-06-15");

// A link attached to a brag (a PR, doc, dashboard…). The URL must be absolute
// (it opens in a new tab); the label is optional. Order is the array index.
export const bragLinkSchema = z.object({
  url: z.url("Enter a full URL (https://…)").max(2000),
  label: z.string().trim().max(200).default(""),
});
export type BragLinkInput = z.infer<typeof bragLinkSchema>;

// Quick-add — the soul: only a title, plus the date the client stamps as today.
export const quickAddSchema = z.object({
  title: z.string().trim().min(1, "A title is all you need").max(300),
  date: dateString,
});
export type QuickAddInput = z.infer<typeof quickAddSchema>;

// The full editor. Optional selects use "" for "none"; the action maps "" → null,
// and the comma-separated collaborators string is split into a text[].
export const bragSchema = z.object({
  title: z.string().trim().min(1, "Give your brag a title").max(300),
  date: dateString,
  category: z.union([z.literal(""), bragCategorySchema]).default(""),
  status: z.union([z.literal(""), bragStatusSchema]).default(""),
  descriptionMd: optionalText(5000),
  impactMd: optionalText(1000),
  collaborators: optionalText(500),
  attribution: optionalText(300),
  links: z.array(bragLinkSchema).max(20).default([]),
  // Tag names, normalized to lowercase; the action create-or-finds them per
  // user+workspace and dedupes. Monochrome in v1 (no color).
  tags: z.array(z.string().trim().toLowerCase().min(1).max(50)).max(30).default([]),
  // 'private' hides the brag from shared views and exports (filtered at the query layer).
  visibility: z.enum(["shared", "private"]).default("shared"),
});
export type BragInput = z.infer<typeof bragSchema>;
