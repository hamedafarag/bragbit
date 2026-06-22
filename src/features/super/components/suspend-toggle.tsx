"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { setUserSuspended, setWorkspaceSuspended } from "../actions";

/** Suspend/unsuspend button for a workspace or user row in the /super console. */
export function SuspendToggle({
  kind,
  id,
  suspended,
}: {
  kind: "workspace" | "user";
  id: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const action = kind === "workspace" ? setWorkspaceSuspended : setUserSuspended;
      const res = await action(id, !suspended);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(suspended ? "Unsuspended." : "Suspended.");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={toggle}>
      {suspended ? "Unsuspend" : "Suspend"}
    </Button>
  );
}
