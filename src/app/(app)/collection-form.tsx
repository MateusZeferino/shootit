"use client";

import { useActionState } from "react";

import { createCollection, renameCollection } from "@/app/(app)/collections-actions";
import type { CollectionFormState } from "@/lib/collections/validation";

type Props =
  | { mode: "create"; collectionId?: never; initialName?: never }
  | { mode: "rename"; collectionId: string; initialName: string };

export function CollectionForm({ mode, collectionId, initialName }: Props) {
  const isCreate = mode === "create";
  const [state, formAction, pending] = useActionState<CollectionFormState, FormData>(
    isCreate ? createCollection : renameCollection,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      {!isCreate && <input name="id" type="hidden" value={collectionId} />}
      <label className="block text-sm font-medium text-slate-700" htmlFor={isCreate ? "new-name" : "collection-name"}>
        Nome do álbum
        <input
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-slate-950"
          defaultValue={initialName}
          id={isCreate ? "new-name" : "collection-name"}
          maxLength={120}
          name="name"
          required
          type="text"
          aria-invalid={Boolean(state.nameError)}
        />
      </label>
      {state.nameError && <p className="text-sm text-red-700" role="alert">{state.nameError}</p>}
      {state.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      {state.success && <p className="text-sm text-green-800" role="status">{state.success}</p>}
      <button
        className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Salvando..." : isCreate ? "Criar álbum" : "Salvar nome"}
      </button>
    </form>
  );
}
