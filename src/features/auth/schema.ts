import { z } from "zod";

// Shared auth form schemas (client + any server use).
export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Open signup (hosted only). Password floor matches the reset-password rule.
export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").max(128),
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
