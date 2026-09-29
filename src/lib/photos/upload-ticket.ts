import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { readR2Env } from "@/lib/storage/r2";
import { MAX_PHOTO_BYTES, photoExtension } from "./validation";

export const uploadMetadataSchema = z.object({
  size: z.number().int().positive().max(MAX_PHOTO_BYTES),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const ticketSchema = uploadMetadataSchema.extend({
  photoId: z.uuid(), userId: z.uuid(), collectionId: z.uuid(), expiresAt: z.number().int(),
});
export type UploadTicket = z.infer<typeof ticketSchema>;

function signature(payload: string) {
  return createHmac("sha256", readR2Env().R2_SECRET_ACCESS_KEY)
    .update(`shootit-upload-v1:${payload}`).digest();
}

export function issueUploadTicket(userId: string, collectionId: string, metadata: z.infer<typeof uploadMetadataSchema>) {
  const data = ticketSchema.parse({
    ...metadata, userId, collectionId, photoId: randomUUID(), expiresAt: Date.now() + 15 * 60 * 1000,
  });
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return { data, ticket: `${payload}.${signature(payload).toString("base64url")}` };
}

export function verifyUploadTicket(value: unknown, userId: string, collectionId: string): UploadTicket | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  const [payload, encodedSignature, extra] = value.split(".");
  if (!payload || !encodedSignature || extra !== undefined) return null;
  const actual = Buffer.from(encodedSignature, "base64url");
  const expected = signature(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed = ticketSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    if (!parsed.success) return null;
    const data = parsed.data;
    return data.userId === userId && data.collectionId === collectionId && data.expiresAt > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function uploadPaths(ticket: UploadTicket) {
  const prefix = `${ticket.userId}/${ticket.collectionId}`;
  const filename = `${ticket.photoId}.${photoExtension(ticket.mimeType)}`;
  return { original: `${prefix}/${filename}`, pending: `${prefix}/pending/${filename}` };
}
