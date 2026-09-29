import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, deleteR2Prefix, listR2Objects } from "./r2-client.mjs";

const appUrl = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) throw new Error("Configure .env.local antes do teste.");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const r2 = createR2Client();
const users = [];
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==", "base64");

async function user() {
  const email = `r2-test-${randomUUID()}@example.invalid`, password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "Teste R2 temporário" } });
  assert.ifError(created.error);
  users.push(created.data.user.id);
  const jar = new Map();
  const client = createServerClient(url, publicKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
  const cookie = [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
  const album = await client.from("collections").insert({ name: "Álbum R2 temporário" }).select("id,public_token").single();
  assert.ifError(album.error);
  return { id: created.data.user.id, client, cookie, album: album.data };
}

async function call(path, owner, method = "GET", data, origin = appUrl) {
  return fetch(`${appUrl}${path}`, {
    method, redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: origin, ...(owner ? { Cookie: owner.cookie } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}

try {
  const a = await user(), b = await user();
  const base = `/api/colecoes/${a.album.id}/fotos`;
  const metadata = { size: image.length, mimeType: "image/png" };
  assert.equal((await call(`${base}/preparar`, null, "POST", metadata)).status, 401);
  assert.equal((await call(`${base}/preparar`, b, "POST", metadata)).status, 404);
  assert.equal((await call(`${base}?offset=0`, b)).status, 404);
  assert.equal((await call(`${base}/preparar`, a, "POST", metadata, "https://attacker.invalid")).status, 403);
  assert.equal((await call(`${base}/preparar`, a, "POST", { ...metadata, mimeType: "image/svg+xml" })).status, 400);
  assert.equal((await call(`${base}/preparar`, a, "POST", { ...metadata, size: 10 * 1024 * 1024 + 1 })).status, 400);

  const prepared = await call(`${base}/preparar`, a, "POST", metadata);
  assert.equal(prepared.status, 200);
  const { uploadUrl, ticket } = await prepared.json();
  const altered = await call(`${base}/finalizar`, a, "POST", { ticket: ticket + "changed" });
  assert.equal(altered.status, 400);
  const otherAlbum = await call(`/api/colecoes/${b.album.id}/fotos/finalizar`, b, "POST", { ticket });
  assert.equal(otherAlbum.status, 400);
  const wrongMime = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: image });
  assert.equal(wrongMime.ok, false);
  const beforeUpload = await a.client.from("photos").select("id").eq("collection_id", a.album.id);
  assert.equal(beforeUpload.data.length, 0);
  assert.ok((await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: image })).ok);
  const finalized = await call(`${base}/finalizar`, a, "POST", { ticket });
  assert.equal(finalized.status, 201);
  const { id: photoId } = await finalized.json();
  assert.equal((await call(`${base}/finalizar`, a, "POST", { ticket })).status, 200);
  const rows = await a.client.from("photos").select("id,storage_path").eq("collection_id", a.album.id);
  assert.equal(rows.data.length, 1);
  const path = rows.data[0].storage_path;
  const stored = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: path }));
  assert.deepEqual(Buffer.from(await stored.Body.transformToByteArray()), image);
  assert.equal((await listR2Objects(r2, `${a.id}/`)).length, 3);

  // Replaying the temporary PUT must never change the finalized original.
  assert.ok((await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: Buffer.alloc(image.length) })).ok);
  assert.equal((await call(`${base}/finalizar`, a, "POST", { ticket })).status, 200);
  const unchanged = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: path }));
  assert.deepEqual(Buffer.from(await unchanged.Body.transformToByteArray()), image);

  const publicPath = `/g/${a.album.public_token}`;
  const gallery = await call(`${publicPath}/fotos?offset=0`);
  assert.equal(gallery.status, 200);
  const photos = (await gallery.json()).photos;
  assert.equal(photos.length, 1);
  assert.ok(!("originalUrl" in photos[0]));
  for (const field of ["thumbnailUrl", "previewUrl"]) {
    const response = await fetch(photos[0][field]);
    assert.ok(response.ok);
    assert.match(response.headers.get("content-type"), /image\/webp/);
  }
  assert.equal((await call(`/g/${randomUUID()}/fotos?offset=0`)).status, 404);
  assert.equal((await call(`/g/${b.album.public_token}/fotos/${photoId}/download`)).status, 404);
  const download = await call(`${publicPath}/fotos/${photoId}/download`);
  assert.equal(download.status, 302);
  const original = await fetch(download.headers.get("location"));
  assert.deepEqual(Buffer.from(await original.arrayBuffer()), image);
  assert.match(original.headers.get("content-disposition"), /attachment/);
  assert.equal((await call(`${base}/${photoId}`, b, "DELETE")).status, 404);
  assert.equal((await call(`${base}/${photoId}`, null, "DELETE")).status, 401);
  assert.equal((await call(`${base}/${photoId}`, a, "DELETE")).status, 200);
  assert.equal((await listR2Objects(r2, `${a.id}/`)).length, 0);

  // An invalid second upload cannot undo a completed one or enter the database.
  const invalidPrepared = await call(`${base}/preparar`, a, "POST", metadata);
  const invalidTicket = await invalidPrepared.json();
  await fetch(invalidTicket.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: Buffer.alloc(image.length) });
  assert.equal((await call(`${base}/finalizar`, a, "POST", { ticket: invalidTicket.ticket })).status, 400);
  assert.equal((await listR2Objects(r2, `${a.id}/`)).length, 0);
  console.log("OK: usuários A/B e visitante isolados; upload validado, repetição segura, WebP público, original íntegro e exclusão R2.");
} catch (error) {
  console.error("Falha no teste HTTP R2:", error.name);
  if (error instanceof assert.AssertionError) console.error("Falha de asserção:", error.operator, error.actual, error.expected);
  process.exitCode = 1;
} finally {
  for (const id of users) {
    await deleteR2Prefix(r2, `${id}/`);
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) { console.error("Falha ao limpar usuário temporário."); process.exitCode = 1; }
  }
  r2.destroy();
}
