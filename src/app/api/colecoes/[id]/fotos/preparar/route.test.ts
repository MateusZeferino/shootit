import { getPhotoAccess } from "@/lib/photos/access";
import { issueUploadTicket } from "@/lib/photos/upload-ticket";
import { R2ConfigurationError, signUpload } from "@/lib/storage/r2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/photos/access", () => ({
  getPhotoAccess: vi.fn(),
  isCrossOrigin: vi.fn(() => false),
  photoAccessResponse: vi.fn(),
}));
vi.mock("@/lib/photos/upload-ticket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/photos/upload-ticket")>()),
  issueUploadTicket: vi.fn(),
}));
vi.mock("@/lib/storage/r2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/r2")>()),
  signUpload: vi.fn(),
}));

const albumId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const photoId = "55555555-5555-4555-8555-555555555555";

function prepare() {
  return POST(new Request(`https://shootit.example/api/colecoes/${albumId}/fotos/preparar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: 123, mimeType: "image/png" }),
  }), { params: Promise.resolve({ id: albumId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPhotoAccess).mockResolvedValue({ status: "ok", userId } as never);
  vi.mocked(issueUploadTicket).mockReturnValue({
    data: { size: 123, mimeType: "image/png", userId, collectionId: albumId, photoId, expiresAt: Date.now() + 1000 },
    ticket: "sensitive-ticket",
  });
  vi.mocked(signUpload).mockResolvedValue("https://storage.example/sensitive-signed-url");
});

afterEach(() => vi.restoreAllMocks());

describe("photo upload preparation diagnostics", () => {
  it("reports only the stage and invalid environment variable names", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(issueUploadTicket).mockImplementationOnce(() => {
      throw new R2ConfigurationError(["R2_ENDPOINT"]);
    });

    const response = await prepare();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Não foi possível preparar o envio. Tente novamente." });
    expect(log).toHaveBeenCalledWith("R2_UPLOAD_PREPARE_FAILED", {
      stage: "ticket", kind: "invalid_r2_environment", fields: ["R2_ENDPOINT"],
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive-ticket");
    expect(signUpload).not.toHaveBeenCalled();
  });

  it("does not log details from an unexpected signing error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(signUpload).mockRejectedValueOnce(new Error("sensitive-key-and-signed-url"));

    const response = await prepare();

    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith("R2_UPLOAD_PREPARE_FAILED", {
      stage: "sign_url", kind: "unexpected",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive-key-and-signed-url");
    expect(JSON.stringify(await response.json())).not.toContain("sensitive-key-and-signed-url");
  });

  it("preserves the successful upload response", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await prepare();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      ticket: "sensitive-ticket", uploadUrl: "https://storage.example/sensitive-signed-url",
    });
    expect(log).not.toHaveBeenCalled();
  });
});
