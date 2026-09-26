"use client";

import { useActionState } from "react";

import { deleteCollection } from "@/app/(app)/collections-actions";
import type { CollectionFormState } from "@/lib/collections/validation";

export function DeleteCollectionForm({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState<CollectionFormState, FormData>(
    deleteCollection,
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Excluir a coleção “${name}”? Esta ação não pode ser desfeita.`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={id} />
      {state.error && <p className="mb-3 text-sm text-red-700" role="alert">{state.error}</p>}
      <button
        className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Excluindo..." : "Excluir coleção"}
      </button>
    </form>
  );
}
