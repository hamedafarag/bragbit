import { z } from "zod";

// Shared auth form schemas (client + any server use).
export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const requestResetSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export const resendVerificationSchema = z.object({
  email: z.email("Enter a valid email address"),
});
