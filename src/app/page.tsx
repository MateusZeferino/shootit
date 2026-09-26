import Link from "next/link";

const features = [
  {
    title: "Organize",
    description: "Reúna cada ensaio em uma coleção simples e fácil de navegar.",
  },
  {
    title: "Publique",
    description: "Envie suas fotos sem armazenar arquivos dentro do banco.",
  },
  {
    title: "Compartilhe",
    description: "Entregue uma galeria responsiva por meio de um único link.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-stone-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between">
          <span className="text-xl font-semibold tracking-[-0.04em]">Shootit</span>
          <Link
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition hover:border-slate-950"
            href="/login"
          >
            Entrar
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-20 lg:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">
              MVP em construção
            </span>
            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Suas fotos organizadas, prontas para compartilhar.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Uma plataforma direta para fotógrafos criarem coleções, enviarem
              seus trabalhos e entregarem galerias bonitas aos clientes.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="rounded-full bg-slate-950 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                href="/cadastro"
              >
                Criar minha conta
              </Link>
              <Link
                className="rounded-full border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold transition hover:border-slate-950"
                href="/dashboard"
              >
                Abrir meu painel
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <article
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                key={feature.title}
              >
                <span className="text-xs font-semibold text-slate-400">
                  0{index + 1}
                </span>
                <h2 className="mt-8 text-xl font-semibold tracking-tight">
                  {feature.title}
                </h2>
                <p className="mt-2 leading-7 text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-200 py-5 text-sm text-slate-500">
          Shootit · Organize e compartilhe suas fotos
        </footer>
      </div>
    </main>
  );
}
