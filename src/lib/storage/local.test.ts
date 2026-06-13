import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LocalDiskStorage } from "./local";

describe("LocalDiskStorage", () => {
  let dir: string;
  let storage: LocalDiskStorage;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "bragbit-storage-"));
    storage = new LocalDiskStorage(dir);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips put → get", async () => {
    await storage.put("ws1/avatars/a.png", Buffer.from("hello"));
    expect((await storage.get("ws1/avatars/a.png")).toString()).toBe("hello");
  });

  it("creates nested key paths under the root", async () => {
    await storage.put("ws1/avatars/nested/b.png", Buffer.from("x"));
    const onDisk = await readFile(path.join(dir, "ws1/avatars/nested/b.png"));
    expect(onDisk.toString()).toBe("x");
  });

  it("treats delete of a missing key as a no-op", async () => {
    await expect(storage.delete("ws1/avatars/missing.png")).resolves.toBeUndefined();
  });

  it("refuses keys that escape the storage root", async () => {
    // The file-serving route hands user-derived keys to the storage layer, so
    // traversal must be rejected here, not just upstream.
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(/Illegal storage key/);
    await expect(storage.put("../escape.png", Buffer.from("x"))).rejects.toThrow(
      /Illegal storage key/,
    );
    await expect(storage.delete("ws1/../../escape.png")).rejects.toThrow(/Illegal storage key/);
  });
});
