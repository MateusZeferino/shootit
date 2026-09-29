import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, putR2Object } from "./r2-client.mjs";

const apply = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure as variáveis do Supabase antes de continuar.");

const admin = createClient(url, key, { auth: { persistSession: false } });
const r2 = createR2Client();
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
    const needed = [];
    for (let index = 0; index < paths.length; index++) {
      try { await r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: paths[index] })); }
      catch (error) {
        if (error.name === "NotFound" || error.name === "NoSuchKey") needed.push(variants[index]);
        else failed++;
      }
    }
    if (needed.length === 0) continue;
    missing += needed.length;
    if (!apply) continue;

    try {
      const original = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: photo.storage_path }));
      if (!original.ContentLength || original.ContentLength > 10 * 1024 * 1024) {
        original.Body?.destroy();
        throw new Error("invalid_size");
      }
      const bytes = Buffer.from(await original.Body.transformToByteArray());
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
        await putR2Object(r2, `${base}${variant.suffix}`, output, "image/webp");
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
r2.destroy();
