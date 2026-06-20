"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Collaborators / attribution row of the brag editor. Uncontrolled (read via
 * FormData on submit); split out of BragEditor (ENH-CQ-03).
 */
export function BragAttributionFields({
  collaborators,
  attribution,
}: {
  collaborators?: string;
  attribution?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brag-collaborators">Collaborators</Label>
        <Input
          id="brag-collaborators"
          name="collaborators"
          defaultValue={collaborators ?? ""}
          placeholder="Data team, N. Osei"
        />
        <p className="font-mono text-[10.5px] text-ink-faint">Comma-separated.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="brag-attribution">Attribution</Label>
        <Input
          id="brag-attribution"
          name="attribution"
          defaultValue={attribution ?? ""}
          placeholder="Sara M., Director of Engineering"
        />
        <p className="font-mono text-[10.5px] text-ink-faint">Who recognized the work.</p>
      </div>
    </div>
  );
}
