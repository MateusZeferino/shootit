"use client";

import { useActionState } from "react";

import { updateCollectionStatus } from "@/app/(app)/collections-actions";
import type { CollectionFormState } from "@/lib/collections/validation";

export function AlbumStatusForm({
  collectionId,
  isActive,
}: {
  collectionId: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState<CollectionFormState, FormData>(
    updateCollectionStatus,
    {},
  );

  return (
    <form action={formAction}>
      <input name="id" type="hidden" value={collectionId} />
      <input name="status" type="hidden" value={isActive ? "inactive" : "active"} />
      {state.error && <p className="mb-3 text-sm text-red-700" role="alert">{state.error}</p>}
      {state.success && <p className="mb-3 text-sm text-green-800" role="status">{state.success}</p>}
      <div className="flex items-center gap-3">
        <button
          aria-checked={isActive}
          aria-label="Compartilhamento público"
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${isActive ? "bg-emerald-600" : "bg-slate-300"}`}
          disabled={pending}
          role="switch"
          type="submit"
        >
          <span
            aria-hidden="true"
            className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${isActive ? "translate-x-7" : "translate-x-1"}`}
          />
        </button>
        <span className="text-sm font-medium text-slate-700">Galeria pública</span>
        <span className="sr-only" role="status">{pending ? "Salvando..." : ""}</span>
      </div>
    </form>
  );
}
