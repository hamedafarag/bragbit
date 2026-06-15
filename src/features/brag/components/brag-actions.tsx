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

import { deleteBrag } from "../actions";
import { BragEditor, type BragFormValues } from "./brag-editor";

/** Edit (reuses BragEditor) + delete (confirmed) controls for one brag. */
export function BragActions({
  bragId,
  documentId,
  title,
  initial,
}: {
  bragId: string;
  documentId: string;
  title: string;
  initial: BragFormValues;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onDelete() {
    start(async () => {
      const result = await deleteBrag(bragId);
      if (result.ok) {
        toast.success("Brag deleted.");
        setConfirmDelete(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <BragEditor
        documentId={documentId}
        bragId={bragId}
        initial={initial}
        trigger={
          <Button type="button" variant="ghost" size="sm">
            Edit
          </Button>
        }
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-destructive">
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this brag?</DialogTitle>
            <DialogDescription>
              “{title}” will be permanently removed. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>
              {pending ? "Deleting…" : "Delete brag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
