import { z } from "zod";

// Shared document schema (client form + server action). Optional text fields
// default to "" so the form can always submit strings; the action maps "" → null.
// Period bounds are calendar dates ("YYYY-MM-DD" from an <input type="date">, or
// "" when unset) — they stay strings end to end (the column is a string-mode date).
const optionalText = (max: number) => z.string().trim().max(max).default("");
const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-01-01")])
  .default("");

export const documentSchema = z
  .object({
    title: z.string().trim().min(1, "Give your document a title").max(200),
    description: optionalText(500),
    periodStart: optionalDate,
    periodEnd: optionalDate,
    goalsMd: optionalText(5000),
  })
  // Lexicographic comparison is correct for ISO "YYYY-MM-DD" dates.
  .refine((d) => !d.periodStart || !d.periodEnd || d.periodStart <= d.periodEnd, {
    message: "The period end can't be before the start.",
    path: ["periodEnd"],
  });

export type DocumentInput = z.infer<typeof documentSchema>;
