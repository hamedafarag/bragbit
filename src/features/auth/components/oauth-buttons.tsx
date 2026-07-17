"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import type { OAuthProvider } from "@/lib/oauth";

const LABELS: Record<OAuthProvider, string> = { github: "GitHub", google: "Google" };

export function OAuthButtons({
  providers,
  callbackURL = "/",
}: {
  providers: OAuthProvider[];
  // Where to land after social sign-in. Defaults to the app; set to the MCP
  // authorize endpoint to resume an OAuth connect flow.
  callbackURL?: string;
}) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  if (providers.length === 0) return null;

  async function signInWith(provider: OAuthProvider) {
    setPending(provider);
    // On success Better Auth redirects the browser to the provider; we only fall
    // through here if initiating the request fails client-side. OAuth errors
    // (e.g. no linked account in an invite-only instance) come back to
    // /sign-in?error=… via errorCallbackURL.
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL,
      errorCallbackURL: "/sign-in",
    });
    if (error) {
      toast.error(error.message ?? "Could not start sign-in.");
      setPending(null);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      {providers.map((p) => (
        <Button
          key={p}
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => signInWith(p)}
        >
          {pending === p ? "Redirecting…" : `Continue with ${LABELS[p]}`}
        </Button>
      ))}
    </div>
  );
}
