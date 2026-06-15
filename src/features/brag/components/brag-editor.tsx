"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  AttachmentManager,
  type AttachmentItem,
} from "@/features/attachment/components/attachment-manager";

import { createBrag, getTagSuggestions, updateBrag } from "../actions";
import { BRAG_CATEGORIES, bragSchema } from "../schema";
import { LinksField, type LinkRow } from "./links-field";
import { MarkdownField } from "./markdown-field";
import { TagsField } from "./tags-field";

// All-strings form values (the action maps "" → null and splits collaborators).
export type BragFormValues = {
  title: string;
  date: string;
  category: string;
  status: string;
  descriptionMd: string;
  impactMd: string;
  collaborators: string;
  attribution: string;
  links: LinkRow[];
  tags: string[];
  attachments: AttachmentItem[];
};

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const selectClass =
  "h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * The full brag editor in a dialog. With `bragId` it edits (prefilled from
 * `initial`); otherwise it creates in `documentId`. The description placeholder
 * teaches the genre's formula. The dialog content remounts on open, so
 * `defaultValue`s reflect the latest `initial`.
 */
export function BragEditor({
  documentId,
  bragId,
  initial,
  trigger,
}: {
  documentId: string;
  bragId?: string;
  initial?: BragFormValues;
  trigger: React.ReactNode;
}) {
  const isEdit = bragId !== undefined;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // Links live in state (not FormData) so rows can be added/removed. The state
  // sits above the dialog content, so reset it to `initial` whenever it opens.
  const [links, setLinks] = useState<LinkRow[]>(initial?.links ?? []);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const v = initial;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setLinks(initial?.links ?? []);
      setTags(initial?.tags ?? []);
      getTagSuggestions()
        .then(setTagSuggestions)
        .catch(() => {});
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = bragSchema.safeParse({
      title: String(fd.get("title") ?? ""),
      date: String(fd.get("date") ?? ""),
      category: String(fd.get("category") ?? ""),
      status: String(fd.get("status") ?? ""),
      descriptionMd: String(fd.get("descriptionMd") ?? ""),
      impactMd: String(fd.get("impactMd") ?? ""),
      collaborators: String(fd.get("collaborators") ?? ""),
      attribution: String(fd.get("attribution") ?? ""),
      links: links.filter((l) => l.url.trim() !== ""),
      tags,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      const result = isEdit
        ? await updateBrag(bragId, parsed.data)
        : await createBrag(documentId, parsed.data);
      if (result.ok) {
        toast.success(isEdit ? "Brag updated." : "Win logged.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit brag" : "Log a win"}</DialogTitle>
          <DialogDescription>
            Capture what you did, why it mattered, and the measurable result.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brag-title">Title</Label>
            <Input
              id="brag-title"
              name="title"
              defaultValue={v?.title ?? ""}
              placeholder="Shipped the real-time crew heatmap to production"
              autoFocus
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brag-date">Date</Label>
              <Input
                id="brag-date"
                name="date"
                type="date"
                defaultValue={v?.date ?? todayLocal()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brag-category">Category</Label>
              <select
                id="brag-category"
                name="category"
                defaultValue={v?.category ?? ""}
                className={selectClass}
              >
                <option value="">— None —</option>
                {BRAG_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brag-status">Status</Label>
              <select
                id="brag-status"
                name="status"
                defaultValue={v?.status ?? ""}
                className={selectClass}
              >
                <option value="">— None —</option>
                <option value="shipped">Shipped</option>
                <option value="in_progress">In progress</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brag-description">Description</Label>
            <MarkdownField
              id="brag-description"
              name="descriptionMd"
              defaultValue={v?.descriptionMd ?? ""}
              rows={4}
              placeholder="What you did + why it mattered + the measurable result — e.g. Redesigned the checkout flow, cutting cart abandonment from 40% to 28%."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brag-impact">Impact</Label>
            <MarkdownField
              id="brag-impact"
              name="impactMd"
              defaultValue={v?.impactMd ?? ""}
              rows={2}
              placeholder="The measurable result — e.g. cart abandonment 40% → 28%"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brag-collaborators">Collaborators</Label>
              <Input
                id="brag-collaborators"
                name="collaborators"
                defaultValue={v?.collaborators ?? ""}
                placeholder="Data team, N. Osei"
              />
              <p className="font-mono text-[10.5px] text-ink-faint">Comma-separated.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brag-attribution">Attribution</Label>
              <Input
                id="brag-attribution"
                name="attribution"
                defaultValue={v?.attribution ?? ""}
                placeholder="Sara M., Director of Engineering"
              />
              <p className="font-mono text-[10.5px] text-ink-faint">Who recognized the work.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Tags</span>
            <TagsField value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Links</span>
            <LinksField value={links} onChange={setLinks} />
            <p className="font-mono text-[10.5px] text-ink-faint">
              A PR, doc, or dashboard — with an optional label.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Attachments</span>
            {bragId ? (
              <AttachmentManager bragId={bragId} initial={v?.attachments ?? []} />
            ) : (
              <p className="text-[13px] text-ink-faint">
                Save this brag, then reopen it to attach files.
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Log win"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
