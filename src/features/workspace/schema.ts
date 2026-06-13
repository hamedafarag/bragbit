import { z } from "zod";

// Shared workspace-branding schema (client form + server action). The accent is
// a validated hex applied through the `--primary` CSS variable; the logo is a
// separate upload (see /api/upload/logo), so it isn't part of this payload.
export const brandingSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(120),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #e8590c"),
});

export type BrandingInput = z.infer<typeof brandingSchema>;
