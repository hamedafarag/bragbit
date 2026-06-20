"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { formatAccessed } from "../format";

/**
 * The active share link's URL row in the ShareDialog: a read-only field, a
 * copy button, and the "last opened" line. Split out of ShareDialog (ENH-CQ-03);
 * the parent owns the copy state and the clipboard handler.
 */
export function ShareLinkRow({
  url,
  lastAccessedAt,
  copied,
  onCopy,
}: {
  url: string;
  lastAccessedAt: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-[12px]"
          aria-label="Share link"
        />
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="font-mono text-[10.5px] text-ink-faint">
        {lastAccessedAt ? `Last opened ${formatAccessed(lastAccessedAt)}` : "Not opened yet."}
      </p>
    </div>
  );
}
