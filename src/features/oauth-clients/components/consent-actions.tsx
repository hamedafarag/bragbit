"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Approve/Deny for the OAuth consent screen. Posts the decision to Better Auth's
 * consent endpoint (mounted by the mcp plugin) and follows the returned
 * `redirectURI` back to the client — with an authorization code on approve, or an
 * `access_denied` error on deny.
 */
export function ConsentActions({ consentCode }: { consentCode: string }) {
  const [pending, setPending] = useState<"accept" | "deny" | null>(null);

  async function decide(accept: boolean) {
    setPending(accept ? "accept" : "deny");
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accept, consent_code: consentCode }),
      });
      const data = (await res.json().catch(() => null)) as {
        redirectURI?: string;
        message?: string;
        error_description?: string;
      } | null;
      if (res.ok && data?.redirectURI) {
        // Full navigation — this leaves the app for the client's redirect_uri.
        window.location.href = data.redirectURI;
        return;
      }
      toast.error(data?.message ?? data?.error_description ?? "Could not complete authorization.");
      setPending(null);
    } catch {
      toast.error("Network error. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="mt-6 flex gap-3">
      <Button
        type="button"
        variant="outline"
        className="flex-1"
        disabled={pending !== null}
        onClick={() => decide(false)}
      >
        {pending === "deny" ? "Denying…" : "Deny"}
      </Button>
      <Button
        type="button"
        className="flex-1"
        disabled={pending !== null}
        onClick={() => decide(true)}
      >
        {pending === "accept" ? "Authorizing…" : "Authorize"}
      </Button>
    </div>
  );
}
