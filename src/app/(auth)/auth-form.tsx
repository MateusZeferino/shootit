"use client";

import { useActionState } from "react";

import { signIn, signUp } from "@/app/(auth)/actions";
import type { AuthFormState } from "@/lib/auth/validation";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignUp = mode === "signup";
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    isSignUp ? signUp : signIn,
    {},
  );

  return (
    <form action={formAction} className="mt-7 space-y-4">
      {isSignUp && (
        <label className="block text-sm font-medium text-slate-700" htmlFor="name">
          Nome
          <input
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-slate-950"
            id="name"
            maxLength={120}
            minLength={2}
            name="name"
            required
            type="text"
            aria-invalid={Boolean(state.fieldErrors?.name)}
          />
          {state.fieldErrors?.name && (
            <span className="mt-1 block text-sm text-red-700">{state.fieldErrors.name[0]}</span>
          )}
        </label>
      )}
      <label className="block text-sm font-medium text-slate-700" htmlFor="email">
        E-mail
        <input
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-slate-950"
          id="email"
          maxLength={254}
          name="email"
          required
          type="email"
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {state.fieldErrors?.email && (
          <span className="mt-1 block text-sm text-red-700">{state.fieldErrors.email[0]}</span>
        )}
      </label>
      <label className="block text-sm font-medium text-slate-700" htmlFor="password">
        Senha
        <input
          autoComplete={isSignUp ? "new-password" : "current-password"}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-slate-950"
          id="password"
          minLength={isSignUp ? 8 : 1}
          name="password"
          required
          type="password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        {state.fieldErrors?.password && (
          <span className="mt-1 block text-sm text-red-700">{state.fieldErrors.password[0]}</span>
        )}
      </label>
      {state.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      {state.success && <p className="text-sm text-green-800" role="status">{state.success}</p>}
      <button
        className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Aguarde..." : isSignUp ? "Criar conta" : "Entrar"}
      </button>
    </form>
  );
}
