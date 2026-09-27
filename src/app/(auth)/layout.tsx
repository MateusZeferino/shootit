import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-stone-50 px-6 py-6">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link className="text-xl font-semibold tracking-[-0.04em]" href="/login">
          Shootit
        </Link>
        <span className="text-sm text-slate-500">Acesso do fotógrafo</span>
      </header>
      <div className="flex flex-1 items-center justify-center py-12">
        {children}
      </div>
    </main>
  );
}
