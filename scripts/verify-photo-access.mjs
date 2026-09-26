import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) {
  throw new Error("Configure as credenciais em .env.local antes deste teste.");
}

const admin = createClient(url, serviceKey);
const users = [];
const paths = [];
const collections = [];
const appUrl = process.argv[2];
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

async function createTestUser(suffix) {
  const email = `photo-test-${randomUUID()}-${suffix}@example.invalid`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: "Photo Test" },
  });
  assert.ifError(error);
  users.push(data.user.id);
  const client = createClient(url, publicKey);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { client, id: data.user.id, email, password };
}

async function uploadPhoto(client, userId, collectionId) {
  const id = randomUUID();
  const path = `${userId}/${collectionId}/${id}.png`;
  const { error: uploadError } = await client.storage.from("photos").upload(path, image, {
    contentType: "image/png", upsert: false,
  });
  assert.ifError(uploadError);
  paths.push(path);
  const { error: insertError } = await client.from("photos").insert({
    id, collection_id: collectionId, storage_path: path,
    mime_type: "image/png", file_size_bytes: image.length,
  });
  assert.ifError(insertError);
  return { id, path };
}

async function appCookies(email, password) {
  const cookies = new Map();
  const client = createServerClient(url, publicKey, {
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
  const a = await createTestUser("a");
  const b = await createTestUser("b");
  const { data: collection, error: collectionError } = await a.client
    .from("collections").insert({ name: "Stage 4 test" }).select("id").single();
  assert.ifError(collectionError);
  collections.push({ userId: a.id, id: collection.id });

  const photo = await uploadPhoto(a.client, a.id, collection.id);
  const ownPhotos = await a.client.from("photos").select("id").eq("collection_id", collection.id);
  assert.ifError(ownPhotos.error);
  assert.equal(ownPhotos.data.length, 1);

  const foreignPhotos = await b.client.from("photos").select("id").eq("collection_id", collection.id);
  assert.ifError(foreignPhotos.error);
  assert.equal(foreignPhotos.data.length, 0);
  const foreignInsert = await b.client.from("photos").insert({
    id: randomUUID(), collection_id: collection.id,
    storage_path: `${b.id}/${collection.id}/${randomUUID()}.png`,
    mime_type: "image/png", file_size_bytes: image.length,
  });
  assert.ok(foreignInsert.error);
  const foreignUpload = await b.client.storage.from("photos").upload(
    `${a.id}/${collection.id}/${randomUUID()}.png`, image, { contentType: "image/png", upsert: false },
  );
  assert.ok(foreignUpload.error);
  await b.client.storage.from("photos").remove([photo.path]);
  const ownSigned = await a.client.storage.from("photos").createSignedUrl(photo.path, 300);
  assert.ifError(ownSigned.error);
  assert.ok(ownSigned.data.signedUrl);
  const foreignSigned = await b.client.storage.from("photos").createSignedUrl(photo.path, 300);
  assert.ok(foreignSigned.error);

  const remove = await a.client.storage.from("photos").remove([photo.path]);
  assert.ifError(remove.error);
  const deletePhoto = await a.client.from("photos").delete().eq("id", photo.id);
  assert.ifError(deletePhoto.error);

  const cascading = await uploadPhoto(a.client, a.id, collection.id);
  const removeForCollection = await a.client.storage.from("photos").remove([cascading.path]);
  assert.ifError(removeForCollection.error);
  const deleteCollection = await a.client.from("collections").delete().eq("id", collection.id);
  assert.ifError(deleteCollection.error);
  const remaining = await admin.from("photos").select("id").eq("id", cascading.id);
  assert.ifError(remaining.error);
  assert.equal(remaining.data.length, 0);
  const objects = await admin.storage.from("photos").list(`${a.id}/${collection.id}`);
  assert.ifError(objects.error);
  assert.equal(objects.data.length, 0);

  if (appUrl) {
    const email = `photo-http-${randomUUID()}@example.invalid`;
    const password = `${randomUUID()}Aa1!`;
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name: "Photo Test" },
    });
    assert.ifError(created.error);
    users.push(created.data.user.id);
    const cookies = await appCookies(email, password);
    const httpClient = createClient(url, publicKey);
    const signedIn = await httpClient.auth.signInWithPassword({ email, password });
    assert.ifError(signedIn.error);
    const newCollection = await httpClient.from("collections")
      .insert({ name: "Stage 4 HTTP test" }).select("id").single();
    assert.ifError(newCollection.error);
    collections.push({ userId: created.data.user.id, id: newCollection.data.id });
    const endpoint = `${appUrl}/api/colecoes/${newCollection.data.id}/fotos`;
    const unauthenticated = await fetch(endpoint, { method: "POST", headers: { Origin: appUrl } });
    assert.equal(unauthenticated.status, 401);
    const badOrigin = await fetch(endpoint, {
      method: "POST", headers: { Cookie: cookies, Origin: "https://other.invalid" },
    });
    assert.equal(badOrigin.status, 403);
    const invalidBody = new FormData();
    invalidBody.append("file", new Blob(["<svg></svg>"], { type: "image/svg+xml" }), "bad.svg");
    const invalid = await fetch(endpoint, {
      method: "POST", headers: { Cookie: cookies, Origin: appUrl }, body: invalidBody,
    });
    assert.equal(invalid.status, 400);
    const body = new FormData();
    body.append("file", new Blob([image], { type: "image/png" }), "tiny.png");
    const response = await fetch(endpoint, {
      method: "POST", headers: { Cookie: cookies, Origin: appUrl }, body,
    });
    const result = await response.json();
    assert.equal(response.status, 201, JSON.stringify(result));
    const row = await admin.from("photos").select("id,storage_path")
      .eq("id", result.id).single();
    assert.ifError(row.error);
    paths.push(row.data.storage_path);
    const rejectedAfterSuccess = await fetch(endpoint, {
      method: "POST", headers: { Cookie: cookies, Origin: appUrl }, body: invalidBody,
    });
    assert.equal(rejectedAfterSuccess.status, 400);
    const stillUploaded = await admin.from("photos").select("id").eq("id", result.id);
    assert.ifError(stillUploaded.error);
    assert.equal(stillUploaded.data.length, 1);
    const secondBody = new FormData();
    secondBody.append("file", new Blob([image], { type: "image/png" }), "second.png");
    const secondResponse = await fetch(endpoint, {
      method: "POST", headers: { Cookie: cookies, Origin: appUrl }, body: secondBody,
    });
    const secondResult = await secondResponse.json();
    assert.equal(secondResponse.status, 201, JSON.stringify(secondResult));
    const secondRow = await admin.from("photos").select("id,storage_path")
      .eq("id", secondResult.id).single();
    assert.ifError(secondRow.error);
    paths.push(secondRow.data.storage_path);
    const page = await fetch(`${appUrl}/colecoes/${newCollection.data.id}`, {
      headers: { Cookie: cookies }, redirect: "manual",
    });
    assert.equal(page.status, 200);
    const markup = await page.text();
    assert.ok(markup.includes("Adicionar fotos"));
    assert.ok(markup.includes("Ampliar foto"));
    const foreignCookies = await appCookies(b.email, b.password);
    const foreignDelete = await fetch(`${endpoint}/${secondResult.id}`, {
      method: "DELETE", headers: { Cookie: foreignCookies, Origin: appUrl },
    });
    assert.equal(foreignDelete.status, 404);
    const foreignResponse = await fetch(`${appUrl}/api/colecoes/${collection.id}/fotos`, {
      method: "POST", headers: { Cookie: cookies, Origin: appUrl }, body: new FormData(),
    });
    assert.equal(foreignResponse.status, 404);
    const deleted = await fetch(`${endpoint}/${result.id}`, {
      method: "DELETE", headers: { Cookie: cookies, Origin: appUrl },
    });
    assert.equal(deleted.status, 200, await deleted.text());
    const afterDelete = await admin.from("photos").select("id").eq("id", result.id);
    assert.ifError(afterDelete.error);
    assert.equal(afterDelete.data.length, 0);
    const missingObject = await httpClient.storage.from("photos").remove([secondRow.data.storage_path]);
    assert.ifError(missingObject.error);
    const pageWithMissingObject = await fetch(`${appUrl}/colecoes/${newCollection.data.id}`, {
      headers: { Cookie: cookies }, redirect: "manual",
    });
    assert.equal(pageWithMissingObject.status, 200);
    assert.ok((await pageWithMissingObject.text()).includes("Arquivo indisponível"));
    const secondDelete = await fetch(`${endpoint}/${secondResult.id}`, {
      method: "DELETE", headers: { Cookie: cookies, Origin: appUrl },
    });
    assert.equal(secondDelete.status, 200, await secondDelete.text());
  }

  console.log("OK: upload, RLS entre dois usuários, URLs assinadas, exclusões e rotas HTTP solicitadas.");
} finally {
  if (paths.length) await admin.storage.from("photos").remove(paths);
  for (const collection of collections) {
    const listed = await admin.storage.from("photos").list(`${collection.userId}/${collection.id}`);
    if (listed.data?.length) {
      await admin.storage.from("photos").remove(
        listed.data.map((object) => `${collection.userId}/${collection.id}/${object.name}`),
      );
    }
  }
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
