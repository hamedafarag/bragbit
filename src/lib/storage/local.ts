import "server-only";

import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import type { Storage } from "./index";

/**
 * Local-disk storage driver (the default). Objects live under STORAGE_DIR as
 * plain files at their key path — a Docker volume in production. Keys are
 * workspace-prefixed by callers; this class only resolves them safely under the
 * root and refuses any path that escapes it. The file-serving route passes
 * URL-derived keys, so traversal protection here is load-bearing, not cosmetic.
 */
export class LocalDiskStorage implements Storage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  /** Resolve `key` under the root, rejecting anything that escapes via `..`. */
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    const rel = path.relative(this.root, full);
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(`Illegal storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async stream(key: string): Promise<ReadableStream<Uint8Array>> {
    const node = createReadStream(this.resolve(key));
    return Readable.toWeb(node) as unknown as ReadableStream<Uint8Array>;
  }
}
