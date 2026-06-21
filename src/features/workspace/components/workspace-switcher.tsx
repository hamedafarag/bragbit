"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { switchWorkspace } from "../actions";

/**
 * A workspace the caller belongs to. Defined here (a client module) rather than
 * imported from the server-only queries module, so both the switcher and its query
 * can share the shape — mirrors how DocumentDialog keeps DocumentFormValues local.
 */
export type UserWorkspace = {
  id: string;
  name: string;
  type: string; // 'personal' | 'organization'
  role: string; // owner | admin | member
  isActive: boolean;
};

/**
 * Workspace switcher (hosted) — lists every workspace the caller belongs to
 * (personal + orgs), switches the active one through the server action (which
 * re-themes/re-scopes the app on refresh), and offers "Create organization". The
 * header renders it whenever the caller has at least one workspace.
 */
export function WorkspaceSwitcher({ workspaces }: { workspaces: UserWorkspace[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const active = workspaces.find((w) => w.isActive);

  function switchTo(id: string) {
    start(async () => {
      const res = await switchWorkspace(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      // Land on the dashboard — the previous page (e.g. a document) may not exist
      // in the workspace we just switched into.
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Switch workspace"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11.5px] text-ink-soft hover:bg-accent hover:text-ink"
        >
          <span className="max-w-[120px] truncate">{active?.name ?? "Workspace"}</span>
          <ChevronsUpDown className="size-3.5 shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Switch workspace</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-1">
          {workspaces.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                disabled={pending || w.isActive}
                onClick={() => switchTo(w.id)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left text-[13px] hover:bg-accent disabled:opacity-100"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-ink">{w.name}</span>
                  <span className="font-mono text-[10.5px] text-ink-faint uppercase">
                    {w.type === "personal" ? "Personal" : "Organization"} · {w.role}
                  </span>
                </span>
                {w.isActive ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            </li>
          ))}
        </ul>
        <Link
          href="/organizations/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] text-ink-soft no-underline hover:bg-accent hover:text-ink"
        >
          <Plus className="size-3.5" /> Create organization
        </Link>
      </DialogContent>
    </Dialog>
  );
}
