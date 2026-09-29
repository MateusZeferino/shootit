// @vitest-environment node
import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readR2Env, removeObjects, removeUserObjects, signDownload, signUpload } from "./r2";

vi.mock("server-only", () => ({}));

beforeEach(() => {
  vi.stubEnv("R2_ENDPOINT", "https://test-account.r2.cloudflarestorage.com");
  vi.stubEnv("R2_BUCKET", "test-bucket");
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-access");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("private R2 storage", () => {
  it("signs exact upload size/type and short-lived download without exposing secrets", async () => {
    const upload = new URL(await signUpload("user/album/pending/photo.png", 123, "image/png"));
    expect(upload.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(upload.searchParams.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(upload.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(upload.toString()).not.toContain("test-secret");
    const download = new URL(await signDownload("user/album/photo.png", 60, "foto.png"));
    expect(download.searchParams.get("response-content-disposition")).toBe('attachment; filename="foto.png"');
    expect(download.searchParams.get("response-cache-control")).toBe("private, no-store");
    expect(download.searchParams.get("X-Amz-Expires")).toBe("60");
  });
  it("rejects invalid configuration without printing its value", () => {
    vi.stubEnv("R2_ENDPOINT", "https://credential-inside.invalid/path");
    expect(readR2Env).toThrow("R2_ENDPOINT");
    try { readR2Env(); } catch (error) { expect(String(error)).not.toContain("credential-inside"); }
  });
  it("removes every page only under the verified user/album prefix", async () => {
    const user = randomUUID(), album = randomUUID();
    const prefix = `${user}/${album}/`;
    const objects = Array.from({ length: 1001 }, (_, i) => `${prefix}${i}.png`);
    const removed: string[] = [];
    vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        expect(command.input.Prefix).toBe(prefix);
        return { Contents: objects.slice(0, 1000).map((Key) => ({ Key })) };
      }
      if (command instanceof DeleteObjectsCommand) {
        const keys = command.input.Delete!.Objects!.map((object) => object.Key!);
        removed.push(...keys);
        objects.splice(0, keys.length);
        return {};
      }
      throw new Error("Unexpected command");
    });
    await removeUserObjects(user, album);
    expect(removed).toHaveLength(1001);
    expect(objects).toHaveLength(0);
    await expect(removeUserObjects("../other-user")).rejects.toThrow();
  });
  it("propagates object-level deletion errors even when the batch HTTP request succeeds", async () => {
    vi.spyOn(S3Client.prototype, "send").mockResolvedValue({ Errors: [{ Key: "test", Code: "AccessDenied" }] } as never);
    await expect(removeObjects(["test"])).rejects.toThrow("Não foi possível remover todos os arquivos.");
  });
});
