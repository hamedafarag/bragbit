import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { ByteRange, PutOptions, Storage } from "./index";

export interface S3Config {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

/**
 * S3-compatible storage driver (MinIO, Cloudflare R2, AWS S3…), selected by
 * STORAGE_DRIVER=s3. Path-style addressing (`S3_FORCE_PATH_STYLE`, default on) is
 * required for MinIO, which doesn't do virtual-host buckets. Keys are
 * workspace-prefixed by callers, exactly as for local disk; objects stay private
 * and are served only through the authorizing file route.
 */
export class S3Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    if (!config.bucket) throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET.");
    if (!config.accessKeyId || !config.secretAccessKey) {
      throw new Error("STORAGE_DRIVER=s3 requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
    }
    this.bucket = config.bucket;
    this.client = new S3Client({
      // MinIO ignores the region, but the SDK requires one.
      region: config.region || "us-east-1",
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async put(key: string, body: Buffer, opts?: PutOptions): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentLength: body.byteLength,
        ContentType: opts?.contentType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    // S3 DeleteObject is idempotent — deleting a missing key is not an error.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async stat(key: string): Promise<{ size: number }> {
    const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return { size: res.ContentLength ?? 0 };
  }

  async stream(key: string, range?: ByteRange): Promise<ReadableStream<Uint8Array>> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    return res.Body!.transformToWebStream();
  }
}
