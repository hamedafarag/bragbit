"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { deleteAttachment } from "../actions";

export type AttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Manage a brag's attachments. Uploads go straight to the multipart route (not
 * the brag form) so they're independent of "Save changes"; delete uses the
 * scoped Server Action. Optimistic local state keeps the list snappy, and a
 * router.refresh() updates the card's chips underneath the dialog.
 */
export function AttachmentManager({
  bragId,
  initial,
}: {
  bragId: string;
  initial: AttachmentItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<AttachmentItem[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    fd.set("bragId", bragId);
    for (const file of Array.from(files)) fd.append("files", file);

    setUploading(true);
    try {
      const res = await fetch("/api/upload/attachment", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed.");
        return;
      }
      const added: AttachmentItem[] = data.attachments;
      setItems((prev) => [...prev, ...added]);
      toast.success(`Attached ${added.length} file${added.length === 1 ? "" : "s"}.`);
      router.refresh();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDelete(id: string) {
    start(async () => {
      const res = await deleteAttachment(id);
      if (res.ok) {
        setItems((prev) => prev.filter((a) => a.id !== id));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-line-soft bg-paper px-2 py-1.5"
            >
              {a.mimeType.startsWith("image/") ? (
                // Plain <img>: next/image optimization needs sharp (ENH-PERF-02); avatars/attachments are also session-gated.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="size-8 shrink-0 rounded object-cover" />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded bg-paper-deep text-ink-faint">
                  <FileText className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-[13px] text-ink no-underline hover:underline"
                >
                  {a.fileName}
                </a>
                <div className="font-mono text-[10px] text-ink-faint">
                  {formatBytes(a.sizeBytes)}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-ink-faint hover:text-destructive"
                disabled={pending}
                onClick={() => onDelete(a.id)}
                aria-label={`Remove ${a.fileName}`}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip /> {uploading ? "Uploading…" : "Attach files"}
      </Button>
    </div>
  );
}
