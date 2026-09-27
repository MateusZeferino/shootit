export function photoVariantPaths(storagePath: string) {
  const base = storagePath.replace(/\.(?:jpg|png|webp)$/i, "");
  if (base === storagePath) throw new Error("Caminho de foto inválido.");

  return {
    thumbnail: `${base}-thumb.webp`,
    preview: `${base}-preview.webp`,
  };
}
