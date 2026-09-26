import type { Metadata } from "next";
import Link from "next/link";

import { AuthForm } from "@/app/(auth)/auth-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-2 leading-7 text-slate-600">
        Acesse suas coleções com e-mail e senha.
      </p>
      <AuthForm mode="login" />
      <p className="mt-6 text-center text-sm text-slate-600">
        Ainda não tem conta?{" "}
        <Link className="font-semibold text-slate-950 underline" href="/cadastro">
          Cadastre-se
        </Link>
      </p>
    </section>
  );
}
