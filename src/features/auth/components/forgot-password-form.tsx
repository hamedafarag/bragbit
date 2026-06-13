"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

import { requestResetSchema } from "../schema";

export function ForgotPasswordForm() {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = requestResetSchema.safeParse({ email: String(fd.get("email") ?? "") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      // Always show the same outcome regardless of whether the email exists.
      await authClient.requestPasswordReset({
        email: parsed.data.email,
        redirectTo: "/reset-password",
      });
      setSent(true);
      toast.success("If that email has an account, a reset link is on its way.");
    });
  }

  if (sent) {
    return (
      <p className="text-[13.5px] text-ink-soft">
        Check your inbox for a password-reset link. You can close this tab.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
