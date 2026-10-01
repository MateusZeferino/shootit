import Link from "next/link";

import { CopyGalleryLink } from "@/app/(app)/copy-gallery-link";

export type AlbumSummary = {
  id: string;
  name: string;
  public_token: string;
  is_active: boolean;
};

export function AlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h3 className="break-words text-xl font-semibold">{album.name}</h3>
        <span className={album.is_active
          ? "shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
          : "shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"}
        >
          {album.is_active ? "Ativo" : "Inativo"}
        </span>
      </div>
      {album.is_active ? (
        <>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Galeria pública
          </p>
          <div className="mt-2"><CopyGalleryLink publicToken={album.public_token} /></div>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-slate-600">
          Compartilhamento desativado.
        </div>
      )}
      <div className="mt-auto pt-6">
        <Link
          className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          href={`/colecoes/${album.id}`}
        >
          Abrir álbum
        </Link>
      </div>
    </article>
  );
}
