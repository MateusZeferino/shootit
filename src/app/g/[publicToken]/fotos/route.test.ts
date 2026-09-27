import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("server-only", () => ({}));

const token = "22222222-2222-4222-8222-222222222222";
const albumId = "33333333-3333-4333-8333-333333333333";

function request(offset = "0", publicToken = token) {
  return GET(
    new Request(`https://shootit.example/g/${publicToken}/fotos?offset=${offset}`),
    { params: Promise.resolve({ publicToken }) },
  );
}

function mockAdmin(photos: { id: string; storage_path: string }[], collection: { id: string; name: string } | null = { id: albumId, name: "Ensaio" }) {
  const collectionQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: collection, error: null }),
  };
  const photoQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: photos, error: null }),
  };
  const sign = vi.fn().mockImplementation(async (paths: string[]) => ({
    data: paths.map((path) => path.endsWith("-thumb.webp") || path.endsWith("-preview.webp")
      ? { path, error: "Object not found", signedUrl: null }
      : { path, error: null, signedUrl: `https://storage.example/${path}` }).reverse(),
    error: null,
  }));
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table) => table === "collections" ? collectionQuery : photoQuery),
    storage: { from: vi.fn(() => ({ createSignedUrls: sign })) },
  } as never);
  return { collectionQuery, photoQuery, sign };
}

beforeEach(() => vi.clearAllMocks());

describe("public photo pagination", () => {
  it("rejects an invalid token without querying the database", async () => {
    const response = await request("0", "invalid-token");
    expect(response.status).toBe(404);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each(["-1", "1", "1.5", "abc", "999999999999999999999999"])("rejects invalid offset %s", async (offset) => {
    const response = await request(offset);
    expect(response.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 404 when the token does not identify an album", async () => {
    const { photoQuery } = mockAdmin([], null);
    const response = await request();
    expect(response.status).toBe(404);
    expect(photoQuery.range).not.toHaveBeenCalled();
  });

  it("returns at most 24 photos with signed originals as fallback", async () => {
    const photos = Array.from({ length: 25 }, (_, index) => ({
      id: `photo-${index + 1}`,
      storage_path: `owner/${albumId}/photo-${index + 1}.jpg`,
    }));
    const { collectionQuery, photoQuery, sign } = mockAdmin(photos);

    const response = await request();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(collectionQuery.eq).toHaveBeenCalledWith("public_token", token);
    expect(photoQuery.eq).toHaveBeenCalledWith("collection_id", albumId);
    expect(photoQuery.range).toHaveBeenCalledWith(0, 24);
    expect(sign).toHaveBeenCalledTimes(1);
    expect(sign.mock.calls[0][0]).toHaveLength(72);
    expect(result.hasMore).toBe(true);
    expect(result.photos).toHaveLength(24);
    expect(result.photos[0]).toEqual({
      id: "photo-1",
      thumbnailUrl: null,
      previewUrl: null,
      originalUrl: `https://storage.example/owner/${albumId}/photo-1.jpg`,
    });
    expect(JSON.stringify(result)).not.toContain("storage_path");
    expect(JSON.stringify(result)).not.toContain("photo-25");
  });
});
