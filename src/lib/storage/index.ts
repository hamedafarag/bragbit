import "server-only";

import { env } from "@/lib/env";

import { LocalDiskStorage } from "./local";
import { S3Storage } from "./s3";

/**
 * Storage adapter (PLAN.md §6). One interface, two drivers selected by
 * STORAGE_DRIVER: `LocalDiskStorage` (default, a STORAGE_DIR volume) and
 * `S3Storage` (any S3-compatible endpoint — MinIO/R2/S3). Keys are prefixed
 * per workspace for isolation + quota accounting; attachments stream through an
 * authorizing route, while org logos and avatars are the deliberate public
 * exception.
 */
export interface PutOptions {
  /** Stored as object metadata by S3; ignored by local disk (derived from key). */
  contentType?: string;
}

/** An inclusive byte range, per HTTP `Range` semantics (`bytes=start-end`). */
export interface ByteRange {
  start: number;
  end: number;
}

export interface Storage {
  /** Write (or overwrite) an object at `key`. */
  put(key: string, body: Buffer, opts?: PutOptions): Promise<void>;
  /** Read a whole object into memory — small files only (avatars, logos). */
  get(key: string): Promise<Buffer>;
  /** Delete an object; a missing key is not an error. */
  delete(key: string): Promise<void>;
  /** Object size in bytes — for `Content-Length` and range validation. */
  stat(key: string): Promise<{ size: number }>;
  /** Stream an object, optionally a byte range (inclusive), for ranged downloads. */
  stream(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>>;
}

let cached: Storage | undefined;

/** The configured storage driver (memoized for the process). */
export function getStorage(): Storage {
  if (cached) return cached;
  if (env.STORAGE_DRIVER === "s3") {
    cached = new S3Storage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  } else {
    cached = new LocalDiskStorage(env.STORAGE_DIR);
  }
  return cached;
}

/** Image types accepted for avatar/logo uploads → the extension we store under. */
export const IMAGE_MIME_EXT: Readonly<Record<string, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Attachment types accepted on a brag → the stored extension. Images, PDFs, and
 * common office/text docs (screenshots, praise emails, dashboards). The MIME
 * type is also persisted on the row and used verbatim when serving.
 */
export const ATTACHMENT_MIME_EXT: Readonly<Record<string, string>> = {
  ...IMAGE_MIME_EXT,
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/markdown": "md",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
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
