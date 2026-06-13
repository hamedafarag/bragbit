"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accentVars } from "@/lib/utils";

import { updateWorkspaceBranding } from "../actions";
import { brandingSchema } from "../schema";

const PRESETS = ["#e8590c", "#0f766e", "#4338ca", "#9f1239", "#b08a2e", "#3f8a82"];

export function BrandingForm({ initial }: { initial: { name: string; accentColor: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [accent, setAccent] = useState(initial.accentColor);
  const validHex = /^#[0-9a-fA-F]{6}$/.test(accent);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = brandingSchema.safeParse({
      name: String(fd.get("name") ?? ""),
      accentColor: accent,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      const result = await updateWorkspaceBranding(parsed.data);
      if (result.ok) {
        toast.success("Branding saved.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" defaultValue={initial.name} maxLength={120} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Accent color</Label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccent(c)}
              aria-label={`Accent ${c}`}
              className={`h-7 w-7 rounded-full outline outline-1 outline-line ${
                accent.toLowerCase() === c ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <Input
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Accent hex"
            className="w-28 font-mono"
            placeholder="#e8590c"
          />
        </div>

        <div
          className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper p-3"
          style={accentVars(accent)}
        >
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
            Preview
          </span>
          <Button type="button" size="sm" className="pointer-events-none">
            Primary button
          </Button>
          <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 font-mono text-[11px] font-medium text-primary">
            highlight
          </span>
        </div>
        {!validHex ? (
          <p className="text-[12px] text-destructive">Use a hex color like #e8590c.</p>
        ) : null}
      </div>

      <Button type="submit" disabled={pending || !validHex} className="mt-1 self-start">
        {pending ? "Saving…" : "Save branding"}
      </Button>
    </form>
  );
}
