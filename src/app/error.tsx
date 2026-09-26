"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErrorPage({ retry }: ErrorPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <section className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-amber-700">Erro inesperado</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Não foi possível carregar esta página.
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          Tente novamente. Se o problema continuar, volte em alguns instantes.
        </p>
        <button
          className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
          onClick={() => retry()}
          type="button"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
