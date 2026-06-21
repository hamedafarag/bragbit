"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function AvatarUploader({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
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
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const json: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed.");
        return;
      }
      toast.success("Avatar updated.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-paper-deep font-mono text-lg font-medium text-ink-soft">
        {avatarUrl ? (
          // Plain <img>: next/image optimization needs sharp (ENH-PERF-02); avatars/attachments are also session-gated.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="Your avatar" className="h-full w-full object-cover" />
        ) : (
          initials
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
          {pending ? "Uploading…" : "Change avatar"}
        </Button>
        <p className="font-mono text-[10.5px] text-ink-faint">
          PNG, JPEG, WebP or GIF · up to 5 MB
        </p>
      </div>
    </div>
  );
}
