"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { mcpHintDismissCookie } from "@/lib/mcp/hint";

/**
 * A one-time nudge on the dashboard. The MCP connector has no other surface in
 * the app — without this, the only way to learn it exists is to wander into
 * Settings. Deliberately quiet (a dashed line, not a banner) and dismissible for
 * good. Whether to render at all is decided server-side (no connected app + not
 * dismissed), so it never flashes in and out.
 */
export function ConnectHint() {
  const [gone, setGone] = useState(false);
  if (gone) return null;

  function dismiss() {
    document.cookie = mcpHintDismissCookie();
    setGone(true);
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-card/60 px-4 py-3 shadow-card">
      <Sparkles className="size-4 shrink-0 text-ink-faint" aria-hidden />
      <p className="flex-1 text-[13px] text-ink-soft">
        Log a win without leaving your AI assistant —{" "}
        <Link
          href="/settings#connected-apps"
          className="font-medium text-ink underline-offset-2 hover:underline"
        >
          connect Claude, or any MCP client
        </Link>
        .
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}
