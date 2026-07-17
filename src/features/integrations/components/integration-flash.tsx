"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// Flashes the outcome of the OAuth round-trip. The callback route redirects to
// /settings?integration=<status>#integrations; this reads the status the server
// passed in, toasts once, and strips the query so a refresh doesn't re-toast.

const MESSAGES: Record<string, { kind: "success" | "error"; text: string }> = {
  github_connected: { kind: "success", text: "GitHub connected." },
  github_failed: { kind: "error", text: "Couldn't connect GitHub. Please try again." },
  github_unavailable: {
    kind: "error",
    text: "GitHub OAuth isn't set up on this instance — paste a token instead.",
  },
};

export function IntegrationFlash({ status }: { status?: string }) {
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (!status || shown.current) return;
    shown.current = true;
    const message = MESSAGES[status];
    if (message) toast[message.kind](message.text);
    // Drop the query param so a reload doesn't fire the toast again.
    router.replace("/settings#integrations");
  }, [status, router]);

  return null;
}
