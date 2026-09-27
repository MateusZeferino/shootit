"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/user";
import { readPublicEnv } from "@/lib/env";
import { deleteUserPhotos } from "@/lib/photos/delete-user-photos";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeleteAccountState = { error?: string };

export async function deleteAccount(
  _previousState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const { supabase, userId } = await requireUser();
  const password = formData.get("password");

  if (formData.get("confirm") !== "yes" || typeof password !== "string" || !password) {
    return { error: "Confirme a exclusão e informe sua senha." };
  }

  // getUser checks the account with Auth, rather than trusting a possibly stale JWT.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.id !== userId || !user.email) {
    return { error: "Sua sessão não pôde ser verificada. Entre novamente e tente de novo." };
  }

  const env = readPublicEnv();
  const verifier = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } },
  );
  const { data: verified, error: passwordError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (passwordError?.code === "invalid_credentials") {
    return { error: "Senha incorreta. A conta não foi excluída." };
  }
  if (passwordError || verified.user?.id !== userId) {
    return { error: "Não foi possível confirmar sua senha. Tente novamente." };
  }

  const admin = createAdminClient();
  try {
    await deleteUserPhotos(admin.storage, userId);
  } catch {
    return { error: "A conta foi mantida, mas algumas fotos podem ter sido removidas. Tente novamente." };
  }

  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  } catch {
    return { error: "Não foi possível excluir a conta. As fotos já foram removidas; tente novamente." };
  }

  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
