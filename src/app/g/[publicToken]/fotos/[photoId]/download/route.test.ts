import { signDownload } from "@/lib/storage/r2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import { GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/storage/r2", () => ({ signDownload: vi.fn() }));

const token = "22222222-2222-4222-8222-222222222222";
const albumId = "33333333-3333-4333-8333-333333333333";
const photoId = "44444444-4444-4444-8444-444444444444";

function query(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

function request(publicToken = token, id = photoId) {
  return GET(
    new Request(`https://shootit.example/g/${publicToken}/fotos/${id}/download`),
    { params: Promise.resolve({ publicToken, photoId: id }) },
  );
}

beforeEach(() => vi.clearAllMocks());

describe("public photo download", () => {
  it("rejects invalid identifiers before accessing the database", async () => {
    const response = await request("not-a-token");
    expect(response.status).toBe(404);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("does not sign a photo outside the album identified by the public token", async () => {
    const albumQuery = query({ data: { id: albumId, is_active: true }, error: null });
    const photoQuery = query({ data: null, error: null });
    const sign = vi.mocked(signDownload);
    sign.mockResolvedValue("https://storage.example/signed?download=foto.png");
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table) => table === "collections" ? albumQuery : photoQuery),
    } as never);

    const response = await request();
    expect(response.status).toBe(404);
    expect(photoQuery.eq).toHaveBeenCalledWith("collection_id", albumId);
    expect(sign).not.toHaveBeenCalled();
  });

  it("does not read or sign a photo from an inactive album", async () => {
    const albumQuery = query({ data: { id: albumId, is_active: false }, error: null });
    const photoQuery = query({ data: null, error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table) => table === "collections" ? albumQuery : photoQuery),
    } as never);

    const response = await request();

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Álbum indisponível.");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(photoQuery.select).not.toHaveBeenCalled();
    expect(signDownload).not.toHaveBeenCalled();
  });

  it("creates a fresh download URL only for a photo in the shared album", async () => {
    const path = `owner/${albumId}/${photoId}.png`;
    const albumQuery = query({ data: { id: albumId, is_active: true }, error: null });
    const photoQuery = query({ data: { id: photoId, storage_path: path, mime_type: "image/png" }, error: null });
    const sign = vi.mocked(signDownload);
    sign.mockResolvedValue("https://storage.example/signed?download=foto.png");
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table) => table === "collections" ? albumQuery : photoQuery),
    } as never);

    const response = await request();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://storage.example/signed?download=foto.png");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(albumQuery.eq).toHaveBeenCalledWith("public_token", token);
    expect(photoQuery.eq).toHaveBeenCalledWith("id", photoId);
    expect(sign).toHaveBeenCalledWith(path, 60, `foto-${photoId}.png`);
  });
});
