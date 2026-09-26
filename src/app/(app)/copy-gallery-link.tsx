"use client";

import { useState } from "react";

export function CopyGalleryLink({ publicToken }: { publicToken: string }) {
  const path = `/g/${publicToken}`;
  const [message, setMessage] = useState("");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setMessage("Link copiado.");
    } catch {
      setMessage(`Não foi possível copiar. Use: ${new URL(path, window.location.origin).href}`);
    }
  }

  return (
    <div>
      <a
        className="block break-all rounded-xl bg-stone-50 p-3 font-mono text-sm text-slate-700 underline hover:text-slate-950"
        href={path}
        rel="noopener noreferrer"
        target="_blank"
      >
        {path}
      </a>
      <button
        className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-stone-50"
        onClick={copyLink}
        type="button"
      >
        Copiar link
      </button>
      <span aria-live="polite" className="ml-3 break-all text-sm text-slate-600">{message}</span>
    </div>
  );
}
