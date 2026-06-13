import { z } from "zod";

// Account-settings form schemas (client-side; the mutations themselves run
// through the Better Auth client, which re-validates and authorizes server-side).
export const changeEmailSchema = z.object({
  newEmail: z.email("Enter a valid email address"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Use at least 8 characters").max(128),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm"),
});
