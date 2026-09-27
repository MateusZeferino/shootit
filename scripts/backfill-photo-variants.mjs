import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure as variáveis do Supabase antes de continuar.");

const admin = createClient(url, key, { auth: { persistSession: false } });
const bucket = admin.storage.from("photos");
const pageSize = 100;
const variants = [
  { suffix: "-thumb.webp", dimension: 640, quality: 72 },
  { suffix: "-preview.webp", dimension: 1600, quality: 80 },
];

let scanned = 0;
let missing = 0;
let created = 0;
let failed = 0;

for (let offset = 0; ; offset += pageSize) {
  const { data: photos, error } = await admin.from("photos")
    .select("storage_path")
    .order("id")
    .range(offset, offset + pageSize - 1);
  if (error || !photos) throw new Error("Não foi possível listar os registros de fotos.");

  for (const photo of photos) {
    scanned++;
    const base = photo.storage_path.replace(/\.(?:jpg|png|webp)$/i, "");
    if (base === photo.storage_path) {
      failed++;
      continue;
    }
    const paths = variants.map((variant) => `${base}${variant.suffix}`);
    const { data: signed, error: signedError } = await bucket.createSignedUrls(paths, 60);
    if (signedError || !signed) {
      failed++;
      continue;
    }
    const needed = variants.filter((_, index) => !signed[index]?.signedUrl);
    if (needed.length === 0) continue;
    missing += needed.length;
    if (!apply) continue;

    try {
      const { data: original, error: downloadError } = await bucket.download(photo.storage_path);
      if (downloadError || !original) throw new Error("download");
      const bytes = Buffer.from(await original.arrayBuffer());
      const inputOptions = { failOn: "warning", limitInputPixels: 50_000_000 };
      const metadata = await sharp(bytes, inputOptions).metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 50_000_000 ||
          !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
        throw new Error("invalid_image");
      }

      for (const variant of needed) {
        const output = await sharp(bytes, inputOptions)
          .autoOrient()
          .resize(variant.dimension, variant.dimension, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: variant.quality })
          .toBuffer();
        const { error: uploadError } = await bucket.upload(`${base}${variant.suffix}`, output, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });
        if (uploadError) throw new Error("upload");
        created++;
      }
    } catch {
      failed++;
    }
  }

  if (photos.length < pageSize) break;
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", scanned, missing, created, failed }));
if (failed > 0) process.exitCode = 1;
