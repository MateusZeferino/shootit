"use client";

import { useState } from "react";

import { AlbumCard, type AlbumSummary } from "@/app/(app)/album-card";

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function AlbumSearch({ albums }: { albums: AlbumSummary[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeName(query.trim());
  const filteredAlbums = albums.filter((album) =>
    normalizeName(album.name).includes(normalizedQuery),
  );

  return (
    <>
      <label className="block max-w-xl text-sm font-medium text-slate-700" htmlFor="album-search">
        Buscar álbuns pelo nome
        <input
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-slate-950"
          id="album-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Digite o nome de um álbum"
          type="search"
          value={query}
        />
      </label>

      <h1 className="mt-9 text-4xl font-semibold tracking-tight">Todos os álbuns</h1>
      {albums.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
          Você ainda não criou nenhum álbum.
        </p>
      ) : filteredAlbums.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600" role="status">
          Nenhum álbum encontrado para essa busca.
        </p>
      ) : (
        <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Álbuns cadastrados">
          {filteredAlbums.map((album) => <AlbumCard album={album} key={album.id} />)}
        </section>
      )}
    </>
  );
}
