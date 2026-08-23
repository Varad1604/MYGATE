import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

/**
 * Object-storage abstraction. `local` driver keeps files on disk with
 * HMAC-signed expiring download URLs (dev default); the S3 driver implements
 * the same contract against any S3-compatible endpoint (MinIO/AWS).
 */
export interface PutResult {
  key: string;
  size: number;
}

export interface IStorage {
  put(key: string, data: Buffer, contentType: string): Promise<PutResult>;
  get(key: string): Promise<{ data: Buffer; contentType: string }>;
  remove(key: string): Promise<void>;
  signedUrl(key: string, ttlSeconds?: number): Promise<string>;
}

function safeKey(key: string): string {
  // Prevent traversal — keys are opaque server-generated paths.
  if (!/^[\w\-./]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  return key.replace(/^\/+/, "");
}

export class LocalStorageDriver implements IStorage {
  constructor(
    private readonly rootDir: string,
    private readonly signingSecret: string,
    private readonly publicBaseUrl: string,
    private readonly defaultTtl = 600,
  ) {}

  async put(key: string, data: Buffer, _contentType: string): Promise<PutResult> {
    const k = safeKey(key);
    const target = path.join(this.rootDir, k);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return { key: k, size: data.byteLength };
  }

  async get(key: string): Promise<{ data: Buffer; contentType: string }> {
    const target = path.join(this.rootDir, safeKey(key));
    const data = await readFile(target);
    return { data, contentType: guessContentType(key) };
  }

  async remove(key: string): Promise<void> {
    await rm(path.join(this.rootDir, safeKey(key)), { force: true });
  }

  /** Signed URL is served by FilesController (GET /files/:key?exp&sig). */
  async signedUrl(key: string, ttlSeconds = this.defaultTtl): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(key, exp);
    return `${this.publicBaseUrl}/files/${key}?exp=${exp}&sig=${sig}`;
  }

  verify(key: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    const expected = this.sign(key, exp);
    return expected.length === sig.length && expected === sig;
  }

  private sign(key: string, exp: number): string {
    return createHmac("sha256", this.signingSecret).update(`${key}:${exp}`).digest("base64url");
  }
}

/** S3-compatible driver; SDK is imported lazily so dev installs stay light. */
export class S3StorageDriver implements IStorage {
  constructor(
    private readonly opts: {
      endpoint?: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl: string;
    },
  ) {}

  private async sdk() {
    const [{ S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand }, { getSignedUrl: presign }] =
      await Promise.all([
        import("@aws-sdk/client-s3"),
        import("@aws-sdk/s3-request-presigner"),
      ]);
    const client = new S3Client({
      region: this.opts.region,
      endpoint: this.opts.endpoint,
      forcePathStyle: Boolean(this.opts.endpoint),
      credentials: {
        accessKeyId: this.opts.accessKeyId,
        secretAccessKey: this.opts.secretAccessKey,
      },
    });
    return { client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, presign };
  }

  async put(key: string, data: Buffer, contentType: string): Promise<PutResult> {
    const { client, PutObjectCommand } = await this.sdk();
    await client.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: data, ContentType: contentType }));
    return { key, size: data.byteLength };
  }

  async get(key: string): Promise<{ data: Buffer; contentType: string }> {
    const { client, GetObjectCommand } = await this.sdk();
    const res = await client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return { data: Buffer.from(bytes ?? []), contentType: res.ContentType ?? guessContentType(key) };
  }

  async remove(key: string): Promise<void> {
    const { client, DeleteObjectCommand } = await this.sdk();
    await client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }

  async signedUrl(key: string, ttlSeconds = 600): Promise<string> {
    const { client, GetObjectCommand, presign } = await this.sdk();
    return presign(client, new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }), {
      expiresIn: ttlSeconds,
    });
  }
}

function guessContentType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".csv": "text/csv",
  };
  return map[ext] ?? "application/octet-stream";
}

export function newStorageKey(namespace: string, originalName: string): string {
  const ext = path.extname(originalName).slice(0, 12).replace(/[^\w.]/g, "") || "";
  return `${namespace}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`;
}
