import { z } from "zod";

// Shared Zod schema for the first-run setup wizard. Used by both the client
// form and the server action (the form↔action validation pattern).
export const setupSchema = z.object({
  // owner account
  name: z.string().min(1, "Your name is required").max(120),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(128),
  // workspace
  workspaceName: z.string().min(1, "Workspace name is required").max(120),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #e8590c")
    .optional(),
  // required only when the instance sets SETUP_TOKEN
  setupToken: z.string().optional(),
});

export type SetupInput = z.infer<typeof setupSchema>;
