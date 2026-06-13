import "server-only";

import { env } from "@/lib/env";

import { LocalDiskStorage } from "./local";

/**
 * Storage adapter (PLAN.md §6). One interface, two drivers selected by
 * STORAGE_DRIVER: `LocalDiskStorage` (default, a STORAGE_DIR volume) and
 * `S3Storage` (any S3-compatible endpoint, added in Phase 4). Keys are prefixed
 * per workspace for isolation + quota accounting; attachments stream through an
 * authorizing route, while org logos and avatars are the deliberate public
 * exception.
 */
export interface PutOptions {
  /** Stored as object metadata by S3; ignored by local disk (derived from key). */
  contentType?: string;
}

export interface Storage {
  /** Write (or overwrite) an object at `key`. */
  put(key: string, body: Buffer, opts?: PutOptions): Promise<void>;
  /** Read a whole object into memory — small files only (avatars, logos). */
  get(key: string): Promise<Buffer>;
  /** Delete an object; a missing key is not an error. */
  delete(key: string): Promise<void>;
  /** Stream an object for ranged / large downloads (Phase 4 attachments). */
  stream(key: string): Promise<ReadableStream<Uint8Array>>;
}

let cached: Storage | undefined;

/** The configured storage driver (memoized for the process). */
export function getStorage(): Storage {
  if (cached) return cached;
  if (env.STORAGE_DRIVER === "s3") {
    // S3Storage lands in Phase 4 (PLAN.md §8). Fail loudly rather than silently
    // serving from the local disk.
    throw new Error(
      "STORAGE_DRIVER=s3 is not available yet (lands in Phase 4); set STORAGE_DRIVER=local.",
    );
  }
  cached = new LocalDiskStorage(env.STORAGE_DIR);
  return cached;
}

/** Image types accepted for avatar/logo uploads → the extension we store under. */
export const IMAGE_MIME_EXT: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_CONTENT_TYPE: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** Best-effort `Content-Type` for a stored key, from its extension. */
export function contentTypeForKey(key: string): string {
  const dot = key.lastIndexOf(".");
  const ext = dot === -1 ? "" : key.slice(dot + 1).toLowerCase();
  return EXT_CONTENT_TYPE[ext] ?? "application/octet-stream";
}
