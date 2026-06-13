"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

import { changeEmailSchema } from "../schema";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = changeEmailSchema.safeParse({ newEmail: String(fd.get("newEmail") ?? "") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    if (parsed.data.newEmail === currentEmail) {
      toast.error("That's already your email address.");
      return;
    }

    start(async () => {
      const { error } = await authClient.changeEmail({
        newEmail: parsed.data.newEmail,
        callbackURL: "/settings",
      });
      if (error) {
        toast.error(error.message ?? "Could not start the email change.");
        return;
      }
      // Email is verified, so the confirmation goes to the CURRENT inbox; the
      // address only changes once that link is clicked.
      toast.success("Check your current inbox to confirm the change.");
      (e.target as HTMLFormElement).reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentEmail">Current email</Label>
        <Input id="currentEmail" value={currentEmail} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newEmail">New email</Label>
        <Input
          id="newEmail"
          name="newEmail"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Sending…" : "Change email"}
      </Button>
    </form>
  );
}
