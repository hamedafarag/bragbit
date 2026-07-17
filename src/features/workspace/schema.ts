import { z } from "zod";

// Shared workspace-branding schema (client form + server action). The accent is
// a validated hex applied through the `--primary` CSS variable; the logo is a
// separate upload (see /api/upload/logo), so it isn't part of this payload.
export const brandingSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(120),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #e8590c"),
});

export type BrandingInput = z.infer<typeof brandingSchema>;

// Invitable roles (the owner role is assigned at creation / via transfer, never invited).
export const INVITE_ROLES = ["admin", "member"] as const;
export const roleSchema = z.enum(INVITE_ROLES);
export type InviteRole = (typeof INVITE_ROLES)[number];

// Invite one or more people at once. The form parses its textarea into this array.
export const inviteSchema = z.object({
  emails: z
    .array(z.email("Enter valid email addresses"))
    .min(1, "Enter at least one email address")
    .max(50, "Invite up to 50 people at a time"),
  role: roleSchema,
});

export type InviteInput = z.infer<typeof inviteSchema>;

// Create-organization form (hosted only). Name is required; the accent is optional
// at creation (it can be set later via branding). Mirrors the branding/setup rules.
export const createOrgSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required").max(120),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #e8590c")
    .optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
