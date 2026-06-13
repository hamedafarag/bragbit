"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

import { resetPasswordSchema } from "../schema";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!token) {
    return (
      <p className="text-[13.5px] text-ink-soft">
        This reset link is invalid or has expired. Request a new one from{" "}
        <span className="text-ink">Forgot password</span>.
      </p>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = resetPasswordSchema.safeParse({ password: String(fd.get("password") ?? "") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      const { error } = await authClient.resetPassword({
        newPassword: parsed.data.password,
        token: token!,
      });
      if (error) {
        toast.error(error.message ?? "Could not reset password.");
        return;
      }
      toast.success("Password updated — sign in with your new password.");
      router.push("/sign-in");
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}
