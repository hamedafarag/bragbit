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

import { archiveDocument, deleteDocument, unarchiveDocument, type ActionResult } from "../actions";
import { DocumentDialog, type DocumentFormValues } from "./document-dialog";

/**
 * Edit / archive / delete controls for one document. The active variant offers
 * Edit (reusing DocumentDialog) + Archive (reversible, fires directly); the
 * archived variant offers Restore instead. Both share Delete, which is
 * destructive (cascades the document's brags) so it confirms first. Each
 * refreshes the dashboard on success.
 */
export function DocumentActions({
  documentId,
  title,
  initial,
  archived = false,
}: {
  documentId: string;
  title: string;
  initial: DocumentFormValues;
  archived?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(action: (id: string) => Promise<ActionResult>, okMessage: string) {
    start(async () => {
      const result = await action(documentId);
      if (result.ok) {
        toast.success(okMessage);
        setConfirmDelete(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {archived ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(unarchiveDocument, "Document restored.")}
        >
          Restore
        </Button>
      ) : (
        <>
          <DocumentDialog
            documentId={documentId}
            initial={initial}
            trigger={
              <Button type="button" variant="ghost" size="sm">
                Edit
              </Button>
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(archiveDocument, "Document archived.")}
          >
            Archive
          </Button>
        </>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-destructive">
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{title}”?</DialogTitle>
            <DialogDescription>
              This permanently deletes the document and every brag in it. This can&apos;t be undone
              {archived ? "." : " — archive it instead if you just want it off your dashboard."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => run(deleteDocument, "Document deleted.")}
            >
              {pending ? "Deleting…" : "Delete document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
