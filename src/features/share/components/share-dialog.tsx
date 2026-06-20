"use client";

import { Link2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  createShareLink,
  removeSharePassword,
  revokeShareLink,
  rotateShareLink,
  setSharePassword,
} from "../actions";
import type { ShareLinkView } from "../queries";
import { ShareLinkRow } from "./share-link-row";
import { SharePasswordPanel } from "./share-password-panel";

/**
 * Owner-side share controls for a document: create the link, copy it, rotate it
 * (revoke + mint a fresh token), or stop sharing entirely. `initial` is the
 * server's current view; local state mirrors mutations so the dialog updates
 * immediately, and a router.refresh() resyncs the page for the next open.
 */
export function ShareDialog({
  documentId,
  initial,
}: {
  documentId: string;
  initial: ShareLinkView | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<ShareLinkView | null>(initial);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [pw, setPw] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setLink(initial);
    setCopied(false);
    setPw("");
  }

  function onCreate() {
    start(async () => {
      const result = await createShareLink(documentId);
      if (result.ok) {
        setLink(result.link);
        toast.success("Share link created.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRotate() {
    start(async () => {
      const result = await rotateShareLink(documentId);
      if (result.ok) {
        setLink(result.link);
        setCopied(false);
        setPw("");
        toast.success("New link generated — the old one no longer works.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRevoke() {
    start(async () => {
      const result = await revokeShareLink(documentId);
      if (result.ok) {
        setLink(null);
        toast.success("Sharing stopped.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function onCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  }

  function onSetPassword() {
    start(async () => {
      const result = await setSharePassword(documentId, pw);
      if (result.ok) {
        setLink((l) => (l ? { ...l, hasPassword: true } : l));
        setPw("");
        toast.success("Password set. Viewers will need it to open the link.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRemovePassword() {
    start(async () => {
      const result = await removeSharePassword(documentId);
      if (result.ok) {
        setLink((l) => (l ? { ...l, hasPassword: false } : l));
        setPw("");
        toast.success("Password removed.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Link2 className="size-3.5" aria-hidden />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this document</DialogTitle>
          <DialogDescription>
            A read-only link to a clean, branded timeline — anyone with it can view, no login
            needed. Private brags stay hidden. You can stop sharing or rotate the link anytime.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-4">
            <ShareLinkRow
              url={link.url}
              lastAccessedAt={link.lastAccessedAt}
              copied={copied}
              onCopy={onCopy}
            />

            <SharePasswordPanel
              hasPassword={link.hasPassword}
              pw={pw}
              onPwChange={setPw}
              pending={pending}
              onSet={onSetPassword}
              onRemove={onRemovePassword}
            />

            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRotate}>
                <RefreshCw className="size-3.5" aria-hidden />
                Rotate link
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={pending}
                onClick={onRevoke}
              >
                Stop sharing
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13.5px] text-ink-soft">
              This document isn&apos;t shared yet. Create a secret link to show your timeline to a
              manager or mentor.
            </p>
            <Button type="button" disabled={pending} onClick={onCreate} className="self-start">
              {pending ? "Creating…" : "Create share link"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
