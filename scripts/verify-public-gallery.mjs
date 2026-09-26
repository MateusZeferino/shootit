import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { JSDOM } from "jsdom";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.argv[2];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!appUrl || !supabaseUrl || !publicKey || !serviceKey) {
  throw new Error("Use: node --env-file=.env.local scripts/verify-public-gallery.mjs http://localhost:3000");
}

const admin = createClient(supabaseUrl, serviceKey);
const owner = createClient(supabaseUrl, publicKey);
const visitor = createClient(supabaseUrl, publicKey, { auth: { persistSession: false } });
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const paths = [];
let testUserId;

async function getPage(path, headers) {
  const response = await fetch(`${appUrl}${path}`, { headers, redirect: "manual" });
  const html = await response.text();
  return { response, document: new JSDOM(html).window.document, html };
}

async function ownerCookies(email, password) {
  const cookies = new Map();
  const client = createServerClient(supabaseUrl, publicKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return [...cookies].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
}

try {
  const email = `gallery-e2e-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: "Gallery Test" },
  });
  assert.ifError(created.error);
  testUserId = created.data.user.id;
  const signedIn = await owner.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);

  const first = await owner.from("collections")
    .insert({ name: "Galeria E2E com fotos" }).select("id,name,public_token").single();
  assert.ifError(first.error);
  const second = await owner.from("collections")
    .insert({ name: "Galeria E2E vazia" }).select("id,name,public_token").single();
  assert.ifError(second.error);
  assert.notEqual(first.data.public_token, second.data.public_token);

  const empty = await getPage(`/g/${second.data.public_token}`);
  assert.equal(empty.response.status, 200);
  assert.match(empty.document.querySelector("h1")?.textContent ?? "", /Galeria E2E vazia/);
  assert.match(empty.document.body.textContent ?? "", /ainda não tem fotos/);

  const photoId = randomUUID();
  const path = `${testUserId}/${first.data.id}/${photoId}.png`;
  const uploaded = await owner.storage.from("photos").upload(path, image, {
    contentType: "image/png", upsert: false,
  });
  assert.ifError(uploaded.error);
  paths.push(path);
  const inserted = await owner.from("photos").insert({
    id: photoId, collection_id: first.data.id, storage_path: path,
    mime_type: "image/png", file_size_bytes: image.length,
  });
  assert.ifError(inserted.error);

  const panelCookies = await ownerCookies(email, password);
  const panel = await getPage(`/colecoes/${first.data.id}`, { Cookie: panelCookies });
  assert.equal(panel.response.status, 200);
  assert.match(panel.document.body.textContent ?? "", /Copiar link/);
  assert.ok(panel.document.querySelector(`a[href="/g/${first.data.public_token}"]`));

  const gallery = await getPage(`/g/${first.data.public_token}`);
  assert.equal(gallery.response.status, 200);
  assert.match(gallery.document.querySelector("h1")?.textContent ?? "", /Galeria E2E com fotos/);
  assert.match(gallery.document.querySelector('meta[name="robots"]')?.content ?? "", /noindex/);
  assert.doesNotMatch(gallery.document.body.textContent ?? "", /Excluir foto|Renomear coleção|Copiar link/);
  const photo = gallery.document.querySelector('img[src*="/storage/v1/object/sign/"]');
  assert.ok(photo, "A página pública não trouxe uma URL assinada para a imagem.");
  assert.equal(photo.getAttribute("loading"), "lazy");
  const imageResponse = await fetch(photo.src);
  assert.equal(imageResponse.status, 200);
  assert.match(imageResponse.headers.get("content-type") ?? "", /image\/png/);

  const token = new URL(photo.src).searchParams.get("token");
  assert.ok(token);
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
  assert.ok(payload.exp - Math.floor(Date.now() / 1000) <= 300);

  for (const badToken of ["invalido", randomUUID()]) {
    const missing = await getPage(`/g/${badToken}`);
    assert.equal(missing.response.status, 404);
    assert.doesNotMatch(missing.document.body.textContent ?? "", /Galeria E2E com fotos/);
  }

  const anonymousList = await visitor.from("collections").select("id");
  assert.ok(anonymousList.error || anonymousList.data.length === 0);
  const anonymousCreate = await visitor.from("collections").insert({ name: "Invasão" });
  assert.ok(anonymousCreate.error);
  const anonymousUpdate = await visitor.from("collections")
    .update({ name: "Invasão" }).eq("id", first.data.id).select("id");
  assert.ok(anonymousUpdate.error || anonymousUpdate.data.length === 0);
  const anonymousDelete = await visitor.from("photos")
    .delete().eq("id", photoId).select("id");
  assert.ok(anonymousDelete.error || anonymousDelete.data.length === 0);
  await visitor.storage.from("photos").remove([path]);
  const stillThere = await admin.from("photos").select("id").eq("id", photoId).single();
  assert.ifError(stillThere.error);
  const stillAccessible = await fetch(photo.src);
  assert.equal(stillAccessible.status, 200);

  const removed = await owner.storage.from("photos").remove([path]);
  assert.ifError(removed.error);
  const deleted = await owner.from("collections").delete().eq("id", first.data.id);
  assert.ifError(deleted.error);
  const deletedPage = await getPage(`/g/${first.data.public_token}`);
  assert.equal(deletedPage.response.status, 404);
  const otherStillWorks = await getPage(`/g/${second.data.public_token}`);
  assert.equal(otherStillWorks.response.status, 200);

  console.log("OK: compartilhamento anônimo, imagem privada assinada, 404, tokens distintos e mutações bloqueadas.");
} finally {
  if (paths.length) await admin.storage.from("photos").remove(paths);
  if (testUserId) await admin.auth.admin.deleteUser(testUserId);
}
