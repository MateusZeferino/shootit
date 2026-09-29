// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { issueUploadTicket, uploadPaths, verifyUploadTicket } from "./upload-ticket";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({ readR2Env: () => ({ R2_SECRET_ACCESS_KEY: "test-secret" }) }));

describe("upload authorization", () => {
  it("binds the file to its owner, album, metadata and expiration", () => {
    const user = randomUUID(), album = randomUUID();
    const { ticket, data } = issueUploadTicket(user, album, { size: 100, mimeType: "image/png" });
    expect(verifyUploadTicket(ticket, user, album)).toEqual(data);
    expect(verifyUploadTicket(ticket, randomUUID(), album)).toBeNull();
    expect(verifyUploadTicket(ticket, user, randomUUID())).toBeNull();
    const [payload, signature] = ticket.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...data, size: 500 })).toString("base64url");
    expect(verifyUploadTicket(`${tampered}.${signature}`, user, album)).toBeNull();
    expect(verifyUploadTicket(`${payload}.invalid`, user, album)).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(data.expiresAt + 1);
    expect(verifyUploadTicket(ticket, user, album)).toBeNull();
    vi.restoreAllMocks();
  });
  it("separates browser-writable staging from the immutable original", () => {
    const { data } = issueUploadTicket(randomUUID(), randomUUID(), { size: 100, mimeType: "image/jpeg" });
    const paths = uploadPaths(data);
    expect(paths.pending).toContain("/pending/");
    expect(paths.original).toBe(`${data.userId}/${data.collectionId}/${data.photoId}.jpg`);
  });
});
