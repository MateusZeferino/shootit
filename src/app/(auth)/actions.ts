"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { signInSchema, signUpSchema, type AuthFormState } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    if (error.code === "email_address_invalid") {
      return { fieldErrors: { email: ["Use um e-mail real; domínios de exemplo não são aceitos."] } };
    }
    if (error.code === "email_address_not_authorized") {
      return { error: "Este e-mail não pode receber a confirmação neste projeto. Fale com o responsável pelo projeto." };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["A senha não atende aos requisitos de segurança do projeto."] } };
    }
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    }
    return { error: "Não foi possível criar sua conta. Confira os dados e tente novamente." };
  }

  if (!data.session) {
    return { success: "Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Verifique sua caixa de entrada." };
  }

  redirect("/dashboard");
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirme seu e-mail antes de entrar." };
    }
    if (error.code === "over_request_rate_limit") {
      return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    }
    return { error: "E-mail ou senha incorretos, ou conta ainda não confirmada." };
  }

  redirect("/dashboard");
}
