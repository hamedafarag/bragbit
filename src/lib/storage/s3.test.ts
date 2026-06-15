import { beforeAll, describe, expect, it } from "vitest";

import { S3Storage } from "./s3";

const hasS3 = Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET);

/**
 * Integration test against a real S3-compatible endpoint (MinIO in dev/CI). It's
 * skipped when S3 env isn't configured, so the default DB/service-free Vitest job
 * stays green; a dedicated CI job provides MinIO + S3_* and runs it. Locally:
 *   pnpm dev:up && S3_ENDPOINT=http://localhost:9000 S3_BUCKET=bragbit \
 *     S3_ACCESS_KEY_ID=minioadmin S3_SECRET_ACCESS_KEY=minioadmin pnpm test
 */
describe.skipIf(!hasS3)("S3Storage (MinIO)", () => {
  // Construct in beforeAll, not the describe body — the body runs even when the
  // suite is skipped, and the constructor throws without credentials.
  let storage: S3Storage;
  const key = `test/${crypto.randomUUID()}.txt`;

  beforeAll(() => {
    storage = new S3Storage({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION,
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: true,
    });
  });

  it("round-trips put → get → stat", async () => {
    await storage.put(key, Buffer.from("0123456789"), { contentType: "text/plain" });
    expect((await storage.get(key)).toString()).toBe("0123456789");
    expect((await storage.stat(key)).size).toBe(10);
  });

  it("streams the whole object, and an inclusive byte range", async () => {
    const full = await new Response(await storage.stream(key)).text();
    expect(full).toBe("0123456789");
    const part = await new Response(await storage.stream(key, { start: 2, end: 5 })).text();
    expect(part).toBe("2345");
  });

  it("deletes, and treats deleting a missing key as a no-op", async () => {
    await storage.delete(key);
    await expect(storage.delete(key)).resolves.toBeUndefined();
    await expect(storage.get(key)).rejects.toThrow();
  });
});
