"use client";

import Link from "next/link";
import { useState } from "react";

import { CollectionForm } from "@/app/(app)/collection-form";

export function CreateAlbumActions() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <button
          aria-controls="new-album-form"
          aria-expanded={isOpen}
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          {isOpen ? "Cancelar" : "Criar álbum novo"}
        </button>
        <Link
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-950"
          href="/albuns"
        >
          Ver todos os álbuns
        </Link>
      </div>
      <div
        className="mt-5 max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        hidden={!isOpen}
        id="new-album-form"
      >
        <h2 className="mb-5 text-xl font-semibold">Novo álbum</h2>
        <CollectionForm mode="create" />
      </div>
    </div>
  );
}
