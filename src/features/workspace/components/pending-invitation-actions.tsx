"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { resendInvitation, revokeInvitation, type ActionResult } from "../actions";

export function PendingInvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(action: (id: string) => Promise<ActionResult>, okMessage: string) {
    start(async () => {
      const result = await action(invitationId);
      if (result.ok) {
        toast.success(okMessage);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(resendInvitation, "Invitation resent.")}
      >
        Resend
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => run(revokeInvitation, "Invitation revoked.")}
      >
        Revoke
      </Button>
    </div>
  );
}
