"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/user";

export async function signOut() {
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Não foi possível encerrar sua sessão. Tente novamente.");
  }

  redirect("/login");
}
