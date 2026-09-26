import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getPhotoAccess(collectionId: string) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (authError || !userId) return { status: "unauthorized" as const };

  const { data: collection, error } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) return { status: "error" as const };
  if (!collection) return { status: "not_found" as const };
  return { status: "ok" as const, supabase, userId };
}

export function photoAccessResponse(status: "unauthorized" | "not_found" | "error") {
  switch (status) {
    case "unauthorized":
      return Response.json({ error: "Faça login para continuar." }, { status: 401 });
    case "not_found":
      return Response.json({ error: "Coleção não encontrada." }, { status: 404 });
    case "error":
      return Response.json({ error: "Não foi possível verificar a coleção." }, { status: 500 });
  }
}

export function isCrossOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("host") ?? new URL(request.url).host;
    const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
    return originUrl.host !== host || originUrl.protocol !== `${protocol}:`;
  } catch {
    return true;
  }
}
