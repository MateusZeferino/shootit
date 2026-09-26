export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando"
      className="flex min-h-screen items-center justify-center bg-stone-50"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
    </main>
  );
}
