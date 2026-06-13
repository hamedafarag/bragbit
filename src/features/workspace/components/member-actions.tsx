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

import { removeMember, transferOwnership, type ActionResult } from "../actions";

export function MemberActions({
  memberId,
  memberName,
  workspaceName,
  canRemove,
  canTransfer,
}: {
  memberId: string;
  memberName: string;
  workspaceName: string;
  canRemove: boolean;
  canTransfer: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<"none" | "remove" | "transfer">("none");

  function run(action: (id: string) => Promise<ActionResult>, okMessage: string) {
    start(async () => {
      const result = await action(memberId);
      if (result.ok) {
        toast.success(okMessage);
        setOpen("none");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex justify-end gap-2">
      {canTransfer ? (
        <Dialog open={open === "transfer"} onOpenChange={(o) => setOpen(o ? "transfer" : "none")}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Make owner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Make {memberName} the owner?</DialogTitle>
              <DialogDescription>
                {memberName} becomes the owner of {workspaceName} and you step down to admin. Only
                an owner can transfer ownership, so you can&apos;t undo this yourself.
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
                disabled={pending}
                onClick={() => run(transferOwnership, "Ownership transferred.")}
              >
                {pending ? "Transferring…" : "Make owner"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canRemove ? (
        <Dialog open={open === "remove"} onOpenChange={(o) => setOpen(o ? "remove" : "none")}>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              Remove
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove {memberName}?</DialogTitle>
              <DialogDescription>
                They lose access to {workspaceName} immediately. This can&apos;t be undone.
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
                onClick={() => run(removeMember, "Member removed.")}
              >
                {pending ? "Removing…" : "Remove member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
