"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { completeSetup } from "../actions";
import { setupSchema } from "../schema";

const ACCENTS = ["#e8590c", "#0f766e", "#4338ca", "#9f1239", "#b08a2e"];

export function SetupForm({
  mode,
  requiresToken,
}: {
  mode: "private-org" | "private-solo";
  requiresToken: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accent, setAccent] = useState(ACCENTS[0]);
  const isOrg = mode === "private-org";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = setupSchema.safeParse({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      workspaceName: String(fd.get("workspaceName") ?? ""),
      accentColor: accent,
      setupToken: requiresToken ? String(fd.get("setupToken") ?? "") : undefined,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    startTransition(async () => {
      const result = await completeSetup(parsed.data);
      if (result.ok) {
        toast.success("Workspace created — welcome to BragBit.");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workspaceName">{isOrg ? "Organization name" : "Workspace name"}</Label>
        <Input
          id="workspaceName"
          name="workspaceName"
          placeholder={isOrg ? "WakeCap" : "My logbook"}
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Accent color</Label>
        <div className="flex gap-2">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              aria-label={`Accent ${c}`}
              className={`h-7 w-7 rounded-full outline outline-1 outline-line ${
                accent === c ? "border-2 border-ink" : "border-2 border-card"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {requiresToken ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="setupToken">Setup token</Label>
          <Input
            id="setupToken"
            name="setupToken"
            placeholder="From your SETUP_TOKEN env var"
            required
          />
        </div>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Creating…" : isOrg ? "Create organization" : "Create workspace"}
      </Button>
    </form>
  );
}
