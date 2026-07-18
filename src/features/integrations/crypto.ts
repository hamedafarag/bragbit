import "server-only";

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Reversible encryption for stored provider tokens (docs/specs/integrations.md).
 * Unlike share passwords (one-way argon2), integration access/refresh tokens must
 * be recovered to call the provider API, so they're encrypted with AES-256-GCM —
 * authenticated, so tampering is detected on decrypt.
 *
 * The 256-bit key is derived (HKDF-SHA256) from INTEGRATIONS_TOKEN_KEY when set,
 * else BETTER_AUTH_SECRET — mirroring the reminder unsubscribe token's "keyed by
 * the app secret" pattern. A fixed `info` domain-separates it from any other use of
 * the same secret. Rotating the source secret invalidates existing ciphertext
 * (connections must reconnect) — called out in .env.example.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const TAG_BYTES = 16; // 128-bit auth tag
const VERSION = "v1"; // ciphertext format marker, so the scheme can evolve

const HKDF_SALT = "bragbit:integrations";
const HKDF_INFO = "integration-token-encryption:v1";

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (!cachedKey) {
    const ikm = env.INTEGRATIONS_TOKEN_KEY || env.BETTER_AUTH_SECRET;
    cachedKey = Buffer.from(hkdfSync("sha256", ikm, HKDF_SALT, HKDF_INFO, 32));
  }
  return cachedKey;
}

/** Encrypt a token → `v1.<base64url(iv|tag|ciphertext)>`. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

/** Decrypt a `v1.…` payload; throws if the format is unrecognized or the data was tampered. */
export function decryptToken(payload: string): string {
  const dot = payload.indexOf(".");
  const version = dot === -1 ? "" : payload.slice(0, dot);
  if (version !== VERSION) throw new Error("Unrecognized integration token ciphertext");

  const buf = Buffer.from(payload.slice(dot + 1), "base64url");
  if (buf.length < IV_BYTES + TAG_BYTES) throw new Error("Malformed integration token ciphertext");

  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
