import { z } from "zod";

// The password an owner sets on a share link. Short minimum (a share password is a
// light gate in front of an already-secret URL, not an account credential), capped
// so an absurd input can't tie up the argon2 hash.
export const sharePasswordSchema = z.object({
  password: z.string().min(6, "Use at least 6 characters").max(128, "That password is too long"),
});
export type SharePasswordInput = z.infer<typeof sharePasswordSchema>;
