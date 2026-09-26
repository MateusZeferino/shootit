import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold text-amber-700">Erro 404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          O endereço informado não existe ou não está mais disponível.
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
          href="/"
        >
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
