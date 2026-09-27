"use client";

import { useActionState, useState } from "react";

import { deleteAccount, type DeleteAccountState } from "@/app/(app)/account-actions";

export function DeleteAccountForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    {},
  );

  return (
    <section className="border-t border-slate-200 py-8" aria-labelledby="delete-account-title">
      <h2 className="text-lg font-semibold" id="delete-account-title">Excluir conta</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
        A exclusão é definitiva e remove sua conta, seus álbuns e todas as fotos.
      </p>

      <button
        aria-expanded={open}
        className="mt-4 rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {open ? "Fechar confirmação" : "Excluir minha conta"}
      </button>
      {open && (
        <form action={formAction} className="mt-4 max-w-md space-y-4" id="delete-account-confirmation">
          <label className="block text-sm font-medium text-slate-700" htmlFor="delete-account-password">
            Confirme sua senha
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-red-600"
              id="delete-account-password"
              name="password"
              required
              type="password"
            />
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input className="mt-1" name="confirm" required type="checkbox" value="yes" />
            Entendo que não poderei recuperar minha conta, meus álbuns nem minhas fotos.
          </label>
          {state.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Excluindo..." : "Excluir conta definitivamente"}
            </button>
            <button
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold transition hover:border-slate-950 disabled:opacity-60"
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
