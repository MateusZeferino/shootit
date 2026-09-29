import { signDownload } from "@/lib/storage/r2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPhotoAccess } from "@/lib/photos/access";
import { GET } from "./route";

vi.mock("@/lib/photos/access", () => ({
  getPhotoAccess: vi.fn(),
  isCrossOrigin: vi.fn(),
  photoAccessResponse: vi.fn((status: string) => Response.json({ error: status }, { status: status === "unauthorized" ? 401 : 404 })),
}));
vi.mock("@/lib/photos/image-variants", () => ({
  createImageVariants: vi.fn(),
  InvalidPhotoError: class extends Error {},
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({ signDownload: vi.fn(async (path: string) => `https://storage.example/${path}`) }));

const albumId = "33333333-3333-4333-8333-333333333333";

function request(offset = "0", id = albumId) {
  return GET(
    new Request(`https://shootit.example/api/colecoes/${id}/fotos?offset=${offset}`),
    { params: Promise.resolve({ id }) },
  );
}

function mockAccess(rows: { id: string; storage_path: string }[]) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  const sign = vi.mocked(signDownload);
  const supabase = {
    from: vi.fn(() => query),
  };
  vi.mocked(getPhotoAccess).mockResolvedValue({ status: "ok", userId: "owner", supabase } as never);
  return { query, sign };
}

beforeEach(() => vi.clearAllMocks());

describe("authenticated photo pagination", () => {
  it("rejects invalid album IDs and offsets before checking access", async () => {
    expect((await request("0", "not-a-uuid")).status).toBe(404);
    expect((await request("-1")).status).toBe(400);
    expect((await request("1")).status).toBe(400);
    expect((await request("1.5")).status).toBe(400);
    expect(getPhotoAccess).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and other-user album requests", async () => {
    vi.mocked(getPhotoAccess).mockResolvedValueOnce({ status: "unauthorized" } as never)
      .mockResolvedValueOnce({ status: "not_found" } as never);

    const anonymous = await request();
    const otherUser = await request();

    expect(anonymous.status).toBe(401);
    expect(otherUser.status).toBe(404);
    expect(otherUser.headers.get("cache-control")).toContain("no-store");
    expect(getPhotoAccess).toHaveBeenCalledWith(albumId);
  });

  it("returns at most 24 photos only after access validation", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: `photo-${index + 1}`,
      storage_path: `owner/${albumId}/photo-${index + 1}.jpg`,
    }));
    const { query, sign } = mockAccess(rows);

    const response = await request();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(query.eq).toHaveBeenCalledWith("collection_id", albumId);
    expect(query.range).toHaveBeenCalledWith(0, 24);
    expect(sign).toHaveBeenCalledTimes(48);
    expect(body.photos).toHaveLength(24);
    expect(body.hasMore).toBe(true);
    expect(body.photos[0]).toEqual({
      id: "photo-1",
      thumbnailUrl: `https://storage.example/owner/${albumId}/photo-1-thumb.webp`,
      previewUrl: `https://storage.example/owner/${albumId}/photo-1-preview.webp`,
    });
    expect(JSON.stringify(body)).not.toContain("storage_path");
    expect(JSON.stringify(body)).not.toContain("originalUrl");
    expect(JSON.stringify(body)).not.toContain("photo-25");
  });
});
