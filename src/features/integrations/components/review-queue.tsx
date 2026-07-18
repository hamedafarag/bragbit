"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { approveCandidate, dismissCandidate } from "../actions";
import type { Provider } from "../schema";

export type CandidateView = {
  id: string;
  provider: Provider;
  title: string;
  externalUrl: string;
  occurredAt: string | null;
};

export type DocumentOption = { id: string; title: string };

const selectClass =
  "h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/**
 * The approve-each-entry queue: imported items awaiting review. Approving creates a
 * brag in the chosen document (defaulting to the most recent) and attaches the
 * source link; dismissing drops the item. Both refresh the list.
 */
export function ReviewQueue({
  candidates,
  documents,
}: {
  candidates: CandidateView[];
  documents: DocumentOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [docId, setDocId] = useState<string>(documents[0]?.id ?? "");

  const noDocuments = documents.length === 0;

  function act(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    setBusyId(id);
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(ok);
      else toast.error(res.error ?? "Something went wrong.");
      setBusyId(null);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-[13px] text-ink-soft">
          {candidates.length} imported {candidates.length === 1 ? "item" : "items"} to review.
          Approving logs a brag with a link back to the source.
        </p>
        {!noDocuments && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-target">Add approved brags to</Label>
            <select
              id="import-target"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className={selectClass}
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {noDocuments && (
        <p className="rounded-md border border-dashed border-line bg-paper px-3 py-2 text-[12px] text-ink-soft">
          Create a document first — approved imports need somewhere to live.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-line">
        {candidates.map((c) => {
          const busy = pending && busyId === c.id;
          return (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <a
                  href={c.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-ink-soft hover:text-ink"
                >
                  {c.occurredAt ? new Date(c.occurredAt).toLocaleDateString() : "View source"}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    act(c.id, () => approveCandidate(c.id, docId || null), "Brag added.")
                  }
                  disabled={pending || noDocuments}
                >
                  {busy ? "…" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(c.id, () => dismissCandidate(c.id), "Dismissed.")}
                  disabled={pending}
                >
                  Dismiss
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
