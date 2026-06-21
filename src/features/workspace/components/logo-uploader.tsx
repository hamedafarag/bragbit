"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { thumbUrl } from "@/lib/utils";

export function LogoUploader({
  logoUrl,
  workspaceName,
}: {
  logoUrl: string | null;
  workspaceName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    start(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const json: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed.");
        return;
      }
      toast.success("Logo updated.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-paper-deep">
        {logoUrl ? (
          // Plain <img> served as a `?w=` webp thumbnail (ENH-PERF-02); next/image can't fetch the session-gated files route.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(logoUrl, 400)}
            alt={`${workspaceName} logo`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="font-serif text-lg font-semibold text-ink-soft">
            {workspaceName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onPick}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Uploading…" : "Change logo"}
        </Button>
        <p className="font-mono text-[10.5px] text-ink-faint">
          PNG, JPEG, WebP or GIF · up to 2 MB
        </p>
      </div>
    </div>
  );
}
