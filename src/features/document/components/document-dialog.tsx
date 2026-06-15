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
import { Textarea } from "@/components/ui/textarea";

import { createDocument, updateDocument } from "../actions";
import { documentSchema } from "../schema";

// The form's values are all strings (the action maps "" → null). Kept here, not
// imported from the server-only queries module, so client components can share it.
export type DocumentFormValues = {
  title: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  goalsMd: string;
};

const EMPTY: DocumentFormValues = {
  title: "",
  description: "",
  periodStart: "",
  periodEnd: "",
  goalsMd: "",
};

/**
 * Create or edit a document in a dialog. Passing `documentId` switches it to edit
 * mode (prefilled from `initial`); otherwise it creates. The dialog content
 * remounts each time it opens, so `defaultValue` reflects the latest `initial`.
 */
export function DocumentDialog({
  trigger,
  documentId,
  initial,
}: {
  trigger: React.ReactNode;
  documentId?: string;
  initial?: DocumentFormValues;
}) {
  const isEdit = documentId !== undefined;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const values = initial ?? EMPTY;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = documentSchema.safeParse({
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      periodStart: String(fd.get("periodStart") ?? ""),
      periodEnd: String(fd.get("periodEnd") ?? ""),
      goalsMd: String(fd.get("goalsMd") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      const result = isEdit
        ? await updateDocument(documentId, parsed.data)
        : await createDocument(parsed.data);
      if (result.ok) {
        toast.success(isEdit ? "Document updated." : "Document created.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit document" : "New document"}</DialogTitle>
          <DialogDescription>
            A document is a review period — a year, a half, or a promotion case — that collects the
            wins you log against it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              name="title"
              defaultValue={values.title}
              placeholder="2026"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-description">Subtitle</Label>
            <Input
              id="doc-description"
              name="description"
              defaultValue={values.description}
              placeholder="The year of shipping"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-period-start">Period start</Label>
              <Input
                id="doc-period-start"
                name="periodStart"
                type="date"
                defaultValue={values.periodStart}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doc-period-end">Period end</Label>
              <Input
                id="doc-period-end"
                name="periodEnd"
                type="date"
                defaultValue={values.periodEnd}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="doc-goals">Goals &amp; focus areas</Label>
            <Textarea
              id="doc-goals"
              name="goalsMd"
              rows={3}
              defaultValue={values.goalsMd}
              placeholder="Own platform reliability · grow toward Staff scope · mentor two juniors."
            />
            <p className="font-mono text-[10.5px] text-ink-faint">
              Markdown supported — shown at the top of the document.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
