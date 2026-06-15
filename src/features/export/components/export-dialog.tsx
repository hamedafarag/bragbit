"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Owner-side export controls for a document. Downloads stream from the
 * `/api/export/[documentId]` route (which the attachment Content-Disposition turns
 * into a download, no navigation). v1: Markdown, with an opt-in to include private
 * brags (excluded by default — they never leave in a share). PDF/JSON join here in
 * later Phase 7 slices.
 */
export function ExportDialog({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [includePrivate, setIncludePrivate] = useState(false);

  const privateParam = includePrivate ? "1" : "0";

  function downloadMarkdown() {
    const url = `/api/export/${documentId}?format=md&private=${privateParam}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setOpen(false);
  }

  function openPrintView() {
    window.open(`/print/${documentId}?private=${privateParam}`, "_blank", "noopener");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Download className="size-3.5" aria-hidden />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export this document</DialogTitle>
          <DialogDescription>
            Take your logbook with you. Markdown keeps every win portable and readable anywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(e) => setIncludePrivate(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Include private brags
          </label>
          <p className="font-mono text-[10.5px] text-ink-faint">
            Private brags are left out by default — they never appear in a share. Check the box to
            include them in your own copy.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={downloadMarkdown}>
              <Download className="size-3.5" aria-hidden />
              Download Markdown
            </Button>
            <Button type="button" variant="outline" onClick={openPrintView}>
              <Printer className="size-3.5" aria-hidden />
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
