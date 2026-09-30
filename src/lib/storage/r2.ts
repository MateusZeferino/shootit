import "server-only";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";

const envSchema = z.object({
  R2_ENDPOINT: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".r2.cloudflarestorage.com") &&
      url.pathname === "/" && !url.search && !url.username && !url.password;
  }),
  R2_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/),
  R2_ACCESS_KEY_ID: z.string().trim().min(1),
  R2_SECRET_ACCESS_KEY: z.string().trim().min(1),
});

const r2EnvFields = ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;

export class R2ConfigurationError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(`Configuração R2 inválida: ${fields.join(", ")}.`);
    this.name = "R2ConfigurationError";
  }
}

export function readR2Env() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const fields = r2EnvFields.filter((field) =>
      result.error.issues.some((issue) => issue.path[0] === field));
    throw new R2ConfigurationError(fields);
  }
  return result.data;
}

let client: S3Client | undefined;

function r2() {
  const env = readR2Env();
  client ??= new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: env.R2_BUCKET };
}

export function isMissingObject(error: unknown): boolean {
  return error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound");
}

export function isExistingObject(error: unknown): boolean {
  return error instanceof Error && error.name === "PreconditionFailed";
}

export async function signUpload(key: string, size: number, contentType: string) {
  const { client, bucket } = r2();
  return getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket, Key: key, ContentLength: size, ContentType: contentType,
  }), {
    expiresIn: 5 * 60,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

export async function signDownload(key: string, expiresIn: number, filename?: string) {
  const { client, bucket } = r2();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseCacheControl: "private, no-store",
    ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
  }), { expiresIn });
}

export async function readObject(key: string, maxBytes: number) {
  const { client, bucket } = r2();
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = result.Body;
  if (!body) throw new Error("Objeto sem conteúdo.");
  if (!result.ContentLength || result.ContentLength > maxBytes) {
    await body.transformToWebStream().cancel();
    throw new Error("Tamanho de objeto inválido.");
  }
  const reader = body.transformToWebStream().getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Objeto excedeu o tamanho permitido.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return { body: Buffer.concat(chunks), contentType: result.ContentType };
}

export async function writeObject(key: string, body: Buffer, contentType: string, immutable = false) {
  const { client, bucket } = r2();
  await client.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: body, ContentType: contentType,
    CacheControl: "private, no-store",
    ...(immutable ? { IfNoneMatch: "*" } : {}),
  }));
}

export async function removeObjects(keys: string[]) {
  if (keys.length === 0) return;
  const { client, bucket } = r2();
  for (let offset = 0; offset < keys.length; offset += 1000) {
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: bucket, Delete: { Objects: keys.slice(offset, offset + 1000).map((Key) => ({ Key })) },
    }));
    if (result.Errors?.length) throw new Error("Não foi possível remover todos os arquivos.");
  }
}

export async function removeUserObjects(userId: string, collectionId?: string) {
  z.uuid().parse(userId);
  if (collectionId) z.uuid().parse(collectionId);
  const prefix = collectionId ? `${userId}/${collectionId}/` : `${userId}/`;
  const { client, bucket } = r2();
  // Read each first page again after deleting it; no offset can skip remaining keys.
  while (true) {
    const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1000 }));
    const keys = (result.Contents ?? []).map((entry) => entry.Key!);
    if (keys.length === 0) break;
    if (keys.some((key) => !key.startsWith(prefix))) throw new Error("Prefixo de armazenamento inválido.");
    await removeObjects(keys);
  }
}
