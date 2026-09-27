import Link from "next/link";

import { signOut } from "@/app/(app)/actions";

export function AppHeader({ showBack = false }: { showBack?: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 pb-5">
      <Link className="text-xl font-semibold tracking-[-0.04em]" href="/dashboard">
        Shootit
      </Link>
      <div className="flex items-center gap-2">
        {showBack && (
          <Link
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-slate-950"
            href="/dashboard"
          >
            Voltar
          </Link>
        )}
        <form action={signOut}>
          <button
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-slate-950"
            type="submit"
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
