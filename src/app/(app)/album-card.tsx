import Link from "next/link";

import { CopyGalleryLink } from "@/app/(app)/copy-gallery-link";

export type AlbumSummary = {
  id: string;
  name: string;
  public_token: string;
};

export function AlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="break-words text-xl font-semibold">{album.name}</h3>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        Galeria pública
      </p>
      <div className="mt-2"><CopyGalleryLink publicToken={album.public_token} /></div>
      <Link
        className="mt-6 inline-flex self-start rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        href={`/colecoes/${album.id}`}
      >
        Abrir álbum
      </Link>
    </article>
  );
}
