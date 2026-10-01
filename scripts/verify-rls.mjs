import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) {
  throw new Error("Configure .env.local antes de testar as políticas.");
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const visitor = createClient(url, publicKey, { auth: { persistSession: false } });
const users = [];
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

async function createTestUser() {
  const email = `rls-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: "RLS Test" },
  });
  assert.ifError(created.error);
  users.push(created.data.user.id);
  const client = createClient(url, publicKey, { auth: { persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { client, id: created.data.user.id };
}

try {
  const a = await createTestUser();
  const b = await createTestUser();

  const anonymousProfile = await visitor.from("profiles").select("id");
  assert.ok(anonymousProfile.error, "Visitante não pode consultar perfis.");
  const anonymousCollections = await visitor.from("collections").select("id");
  assert.ok(anonymousCollections.error, "Visitante não pode consultar coleções.");
  const anonymousPhotos = await visitor.from("photos").select("id");
  assert.ok(anonymousPhotos.error, "Visitante não pode consultar fotos.");

  const profilesA = await a.client.from("profiles").select("id");
  assert.ifError(profilesA.error);
  assert.deepEqual(profilesA.data.map((profile) => profile.id), [a.id]);
  const profilesB = await b.client.from("profiles").select("id");
  assert.ifError(profilesB.error);
  assert.deepEqual(profilesB.data.map((profile) => profile.id), [b.id]);

  const created = await a.client.from("collections")
    .insert({ name: "RLS Test" }).select("id,owner_id,public_token,is_active").single();
  assert.ifError(created.error);
  const collection = created.data;
  assert.equal(collection.owner_id, a.id);
  assert.ok(collection.public_token);
  assert.equal(collection.is_active, true, "Todo novo álbum deve iniciar ativo.");

  const forgedOwner = await b.client.from("collections")
    .insert({ name: "Invasão", owner_id: a.id });
  assert.ok(forgedOwner.error, "O cliente não pode definir outro proprietário.");
  const forgedToken = await a.client.from("collections")
    .update({ public_token: randomUUID() }).eq("id", collection.id);
  assert.ok(forgedToken.error, "O cliente não pode alterar o token público.");

  const collectionForB = await b.client.from("collections").select("id").eq("id", collection.id);
  assert.ifError(collectionForB.error);
  assert.equal(collectionForB.data.length, 0);
  const renameByB = await b.client.from("collections")
    .update({ name: "Invasão" }).eq("id", collection.id).select("id");
  assert.ok(renameByB.error || renameByB.data.length === 0);
  const deactivateByB = await b.client.from("collections")
    .update({ is_active: false }).eq("id", collection.id).select("id,is_active");
  assert.ok(
    deactivateByB.error || deactivateByB.data.length === 0,
    "Outro usuário não pode alterar o status do álbum.",
  );
  const deactivateByVisitor = await visitor.from("collections")
    .update({ is_active: false }).eq("id", collection.id).select("id");
  assert.ok(deactivateByVisitor.error, "Visitante não pode alterar o status do álbum.");
  const deleteByB = await b.client.from("collections")
    .delete().eq("id", collection.id).select("id");
  assert.ok(deleteByB.error || deleteByB.data.length === 0);

  const deactivated = await a.client.from("collections")
    .update({ is_active: false })
    .eq("id", collection.id)
    .select("id,public_token,is_active")
    .single();
  assert.ifError(deactivated.error);
  assert.equal(deactivated.data.is_active, false);
  assert.equal(
    deactivated.data.public_token,
    collection.public_token,
    "Desativar o álbum não deve trocar seu token público.",
  );

  const photoId = randomUUID();
  const path = `${a.id}/${collection.id}/${photoId}.png`;
  const photo = await a.client.from("photos").insert({
    id: photoId, collection_id: collection.id, storage_path: path,
    mime_type: "image/png", file_size_bytes: image.length,
  });
  assert.ifError(photo.error);
  const photoForB = await b.client.from("photos").select("id").eq("id", photoId);
  assert.ifError(photoForB.error);
  assert.equal(photoForB.data.length, 0);
  const forgedPhoto = await b.client.from("photos").insert({
    id: randomUUID(), collection_id: collection.id,
    storage_path: `${b.id}/${collection.id}/${randomUUID()}.png`,
    mime_type: "image/png", file_size_bytes: image.length,
  });
  assert.ok(forgedPhoto.error);
  const deletePhotoByB = await b.client.from("photos").delete().eq("id", photoId).select("id");
  assert.ok(deletePhotoByB.error || deletePhotoByB.data.length === 0);
  const ownPhoto = await a.client.from("photos").select("id").eq("id", photoId);
  assert.ifError(ownPhoto.error);
  assert.equal(ownPhoto.data.length, 1);

  const inactiveCollectionForOwner = await a.client.from("collections")
    .select("id,is_active").eq("id", collection.id).single();
  assert.ifError(inactiveCollectionForOwner.error);
  assert.equal(inactiveCollectionForOwner.data.is_active, false);

  const reactivated = await a.client.from("collections")
    .update({ is_active: true })
    .eq("id", collection.id)
    .select("public_token,is_active")
    .single();
  assert.ifError(reactivated.error);
  assert.equal(reactivated.data.is_active, true);
  assert.equal(
    reactivated.data.public_token,
    collection.public_token,
    "Reativar o álbum deve restaurar o mesmo link público.",
  );

  console.log("OK: RLS isola visitante e usuários A/B, inclusive ao alternar o status do álbum.");
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
