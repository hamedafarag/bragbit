import { z } from "zod";

// The invitee sets up their account; the email is fixed by the invitation.
export const acceptInviteSchema = z.object({
  name: z.string().min(1, "Your name is required").max(120),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
