import { z } from "zod";

// Shared profile schema (client form + server action). Optional text fields
// default to "" so the form can always submit strings; the action maps "" → null.
const optionalText = (max: number) => z.string().trim().max(max).default("");

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(120),
  roleTitle: optionalText(120),
  team: optionalText(120),
  bio: optionalText(2000),
});

export type ProfileInput = z.infer<typeof profileSchema>;
