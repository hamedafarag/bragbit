"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-fetch this route's server data when the tab becomes visible again. Authorizing
 * an MCP client happens out-of-band — the OAuth flow runs in the assistant (or the
 * MCP Inspector), a different tab — so a Settings page opened beforehand wouldn't
 * show the new connection until a manual reload. Refreshing on return closes that
 * gap: switch back to Settings and the just-authorized app appears with its Revoke
 * button. router.refresh() re-runs the server component while preserving client state.
 */
export function RefreshOnReturn() {
  const router = useRouter();

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  return null;
}
