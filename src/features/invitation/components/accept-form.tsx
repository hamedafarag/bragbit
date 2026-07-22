"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { acceptInvitation, registerInvitee } from "../actions";
import { acceptInviteSchema } from "../schema";

export function AcceptForm({
  invitationId,
  email,
  organizationName,
}: {
  invitationId: string;
  email: string;
  organizationName: string;
}) {
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = acceptInviteSchema.safeParse({
      name: String(fd.get("name") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      // 1) register + verify + sign in (sets the session cookie)
      const reg = await registerInvitee(invitationId, parsed.data);
      if (!reg.ok) {
        toast.error(reg.error);
        return;
      }
      // 2) accept — a separate request so it carries the new session cookie. On
      //    success it redirects to /dashboard server-side (see acceptInvitation),
      //    which avoids the client soft-nav race with this route's post-accept
      //    revalidation; it only returns here when the accept fails.
      const acc = await acceptInvitation(invitationId);
      if (acc && !acc.ok) {
        toast.error(acc.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" defaultValue={email} disabled />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
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
        {pending ? "Joining…" : `Join ${organizationName}`}
      </Button>
    </form>
  );
}
