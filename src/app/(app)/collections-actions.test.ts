import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateCollectionStatus } from "@/app/(app)/collections-actions";
import { requireUser } from "@/lib/auth/user";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/user", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/storage/r2", () => ({ removeUserObjects: vi.fn() }));

const albumId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const publicToken = "55555555-5555-4555-8555-555555555555";

function form(status: string, id = albumId) {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("status", status);
  return formData;
}

function mockUpdate(result: { data: unknown; error: unknown }) {
  const query = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  const supabase = { from: vi.fn(() => query) };
  vi.mocked(requireUser).mockResolvedValue({ supabase, userId } as never);
  return { query, supabase };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notFound).mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });
});

describe("updateCollectionStatus", () => {
  it.each([
    ["inactive", false, "Álbum inativado. O compartilhamento foi desativado."],
    ["active", true, "Álbum ativado. O compartilhamento está disponível."],
  ] as const)("sets an owned album to %s", async (status, isActive, message) => {
    const { query, supabase } = mockUpdate({ data: { id: albumId, public_token: publicToken }, error: null });

    const result = await updateCollectionStatus({}, form(status));

    expect(result).toEqual({ success: message });
    expect(supabase.from).toHaveBeenCalledWith("collections");
    expect(query.update).toHaveBeenCalledWith({ is_active: isActive });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", albumId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "owner_id", userId);
    expect(query.select).toHaveBeenCalledWith("id,public_token");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/albuns");
    expect(revalidatePath).toHaveBeenCalledWith(`/colecoes/${albumId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/g/${publicToken}`);
  });

  it("rejects an unsupported status without updating the database", async () => {
    const { query } = mockUpdate({ data: null, error: null });

    const result = await updateCollectionStatus({}, form("archived"));

    expect(result).toEqual({ error: "Status do álbum inválido." });
    expect(query.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not reveal whether an album belongs to another user", async () => {
    mockUpdate({ data: null, error: null });

    await expect(updateCollectionStatus({}, form("inactive"))).rejects.toThrow("NOT_FOUND");

    expect(notFound).toHaveBeenCalledOnce();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a safe error when the database update fails", async () => {
    mockUpdate({ data: null, error: { message: "sensitive database detail" } });

    const result = await updateCollectionStatus({}, form("inactive"));

    expect(result).toEqual({ error: "Não foi possível atualizar o status do álbum. Tente novamente." });
    expect(JSON.stringify(result)).not.toContain("sensitive database detail");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
