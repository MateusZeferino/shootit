import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Configure .env.local antes do E2E.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("fluxo autenticado, upload simples/TUS, compartilhamento e PWA", async ({ page, browser }) => {
  const email = `e2e-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: "Teste E2E" },
  });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;

  try {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole("textbox", { name: "E-mail" }).fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Seus álbuns" })).toBeVisible();
    await expect(page.getByText("Seja bem-vindo, Teste E2E")).toBeVisible();
    await expect(page.getByText("Seu primeiro álbum começa aqui")).toBeVisible();

    await page.getByRole("button", { name: "Criar álbum novo" }).click();
    await page.getByLabel("Nome do álbum").fill("Galeria E2E");
    await page.getByRole("button", { name: "Criar álbum", exact: true }).click();
    await expect(page).toHaveURL(/\/colecoes\/[0-9a-f-]+$/);
    const collectionUrl = page.url();
    const collectionId = collectionUrl.split("/").at(-1)!;
    const panelResponse = await page.request.get(collectionUrl);
    expect(panelResponse.headers()["cache-control"]).toContain("no-store");
    const galleryLink = page.locator('a[href^="/g/"]').first();
    const galleryPath = await galleryLink.getAttribute("href");
    expect(galleryPath).toMatch(/^\/g\/[0-9a-f-]+$/);

    for (const name of ["Ensaio família", "Casamento", "Retratos"]) {
      const inserted = await admin.from("collections").insert({ owner_id: userId, name });
      expect(inserted.error).toBeNull();
    }
    await page.goto("/dashboard");
    const recentAlbums = page.getByRole("region", { name: "Álbuns recentes" });
    await expect(recentAlbums.getByRole("article")).toHaveCount(3);
    await expect(recentAlbums.getByRole("heading", { name: "Galeria E2E" })).toHaveCount(0);
    await page.getByRole("link", { name: "Ver todos os álbuns" }).click();
    await expect(page).toHaveURL(/\/albuns$/);
    const albumGrid = page.getByRole("region", { name: "Álbuns cadastrados" });
    await expect(albumGrid.getByRole("article")).toHaveCount(4);
    expect(await albumGrid.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length)).toBe(3);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await albumGrid.evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
    const albumsResponse = await page.request.get("/albuns");
    expect(albumsResponse.headers()["cache-control"]).toContain("no-store");
    await page.getByRole("searchbox", { name: "Buscar álbuns pelo nome" }).fill("FAMILIA");
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Ensaio família" })).toBeVisible();
    await page.getByRole("link", { name: "Voltar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(collectionUrl);

    await page.locator('input[type="file"]').setInputFiles({
      name: "pequena.png", mimeType: "image/png", buffer: tinyPng,
    });
    await page.getByRole("button", { name: "Enviar 1 foto" }).click();
    await expect(page.getByRole("button", { name: "Ampliar foto 1" })).toBeVisible();

    // The tiny valid PNG can contain trailing bytes; this exercises the TUS branch.
    const largePng = Buffer.concat([tinyPng, Buffer.alloc(6 * 1024 * 1024 + 1)]);
    await page.locator('input[type="file"]').setInputFiles({
      name: "grande.png", mimeType: "image/png", buffer: largePng,
    });
    await page.getByRole("button", { name: "Enviar 1 foto" }).click();
    await expect(page.getByRole("button", { name: "Ampliar foto 2" })).toBeVisible({ timeout: 60_000 });

    await page.goto(galleryPath!);
    await expect(page.getByRole("heading", { name: "Galeria E2E" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const galleryResponse = await page.request.get(galleryPath!);
    expect(galleryResponse.headers()["cache-control"]).toContain("no-store");
    expect(galleryResponse.headers()["x-robots-tag"]).toContain("noindex");

    const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const visitor = await publicContext.newPage();
      await visitor.goto(galleryPath!);
      await expect(visitor.getByRole("heading", { name: "Galeria E2E" })).toBeVisible();
      await expect(visitor.getByRole("button", { name: "Ampliar foto 1" })).toBeVisible();
      await expect.poll(() => visitor.locator("img").first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(visitor.getByText("Excluir foto")).toHaveCount(0);
      const prepareEndpoint = `/api/colecoes/${collectionId}/fotos/preparar`;
      const anonymousPrepare = await visitor.request.post(prepareEndpoint, {
        data: { size: 6 * 1024 * 1024 + 1, mimeType: "image/png" },
      });
      expect(anonymousPrepare.status()).toBe(401);
      const wrongMethod = await visitor.request.get(prepareEndpoint);
      expect(wrongMethod.status()).toBe(405);
      await visitor.getByRole("button", { name: "Ampliar foto 1" }).click();
      await expect(visitor.getByRole("dialog")).toBeVisible();
      await expect(visitor.getByRole("button", { name: "Fechar" })).toBeFocused();
      await visitor.keyboard.press("Tab");
      await expect(visitor.getByRole("button", { name: "Fechar" })).toBeFocused();
      await visitor.keyboard.press("Escape");
      await expect(visitor.getByRole("dialog")).toHaveCount(0);
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await visitor.goto("/albuns");
      await expect(visitor).toHaveURL(/\/login$/);
    } finally {
      await publicContext.close();
    }

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const manifestData = await manifest.json();
    expect(manifestData.start_url).toBe("/login");
    expect(manifestData.icons).toHaveLength(3);
    const worker = await page.request.get("/sw.js");
    expect(worker.ok()).toBe(true);
    expect(worker.headers()["cache-control"]).toContain("no-store");
    const crossOriginPrepare = await page.request.post(`/api/colecoes/${collectionId}/fotos/preparar`, {
      headers: { Origin: "https://attacker.invalid" },
      data: { size: 6 * 1024 * 1024 + 1, mimeType: "image/png" },
    });
    expect(crossOriginPrepare.status()).toBe(403);

    await page.evaluate(() => navigator.serviceWorker.ready);
    const cachedPaths = await page.evaluate(async () => {
      const keys = await caches.keys();
      const entries = await Promise.all(keys.map(async (key) => {
        const cache = await caches.open(key);
        return (await cache.keys()).map((request) => new URL(request.url).pathname);
      }));
      return entries.flat();
    });
    expect(cachedPaths).toContain("/offline.html");
    expect(cachedPaths.every((path) =>
      path === "/offline.html" || path.startsWith("/icon-") || path.startsWith("/_next/static/"),
    )).toBe(true);

    await page.context().setOffline(true);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
    await page.context().setOffline(false);

    await page.goto(collectionUrl);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Excluir foto" }).first().click();
    await expect(page.getByRole("button", { name: "Ampliar foto 2" })).toHaveCount(0);

    const orphanPath = `${userId}/${collectionId}/${randomUUID()}.png`;
    const orphan = await admin.storage.from("photos").upload(orphanPath, tinyPng, {
      contentType: "image/png", upsert: false,
    });
    expect(orphan.error).toBeNull();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Excluir álbum" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const missingGallery = await page.request.get(galleryPath!);
    expect(missingGallery.status()).toBe(404);
    const remainingObjects = await admin.storage.from("photos").list(`${userId}/${collectionId}`);
    expect(remainingObjects.error).toBeNull();
    expect(remainingObjects.data).toHaveLength(0);
  } finally {
    const collections = await admin.from("collections").select("id").eq("owner_id", userId);
    if (collections.data) {
      for (const collection of collections.data) {
        const objects = await admin.storage.from("photos").list(`${userId}/${collection.id}`);
        if (objects.data?.length) {
          await admin.storage.from("photos").remove(
            objects.data.map((object) => `${userId}/${collection.id}/${object.name}`),
          );
        }
      }
    }
    await admin.auth.admin.deleteUser(userId);
  }
});

test("exclusão da conta remove Auth, álbuns, fotos e objetos do Storage", async ({ page }) => {
  const email = `delete-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: "Conta descartável" },
  });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;
  let storagePath: string | undefined;
  let orphanPath: string | undefined;
  let deleted = false;

  try {
    const collection = await admin.from("collections")
      .insert({ owner_id: userId, name: "Álbum descartável" })
      .select("id,public_token")
      .single();
    expect(collection.error).toBeNull();
    const collectionId = collection.data!.id;
    const galleryPath = `/g/${collection.data!.public_token}`;
    const photoId = randomUUID();
    storagePath = `${userId}/${collectionId}/${photoId}.png`;
    const uploaded = await admin.storage.from("photos").upload(storagePath, tinyPng, {
      contentType: "image/png", upsert: false,
    });
    expect(uploaded.error).toBeNull();
    const photo = await admin.from("photos").insert({
      id: photoId, collection_id: collectionId, storage_path: storagePath,
      mime_type: "image/png", file_size_bytes: tinyPng.length,
    });
    expect(photo.error).toBeNull();
    const secondCollection = await admin.from("collections")
      .insert({ owner_id: userId, name: "Outro álbum" })
      .select("id")
      .single();
    expect(secondCollection.error).toBeNull();
    orphanPath = `${userId}/${secondCollection.data!.id}/${randomUUID()}.png`;
    const orphanUpload = await admin.storage.from("photos").upload(orphanPath, tinyPng, {
      contentType: "image/png", upsert: false,
    });
    expect(orphanUpload.error).toBeNull();

    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!publishableKey) throw new Error("Configure a chave publicável para o E2E.");
    const oldSession = createClient(supabaseUrl!, publishableKey, { auth: { persistSession: false } });
    const signedIn = await oldSession.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    await page.goto("/login");
    await page.getByRole("textbox", { name: "E-mail" }).fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await page.getByLabel("Confirme sua senha").fill("senha-incorreta");
    await page.getByRole("checkbox", { name: /Entendo que não poderei recuperar/ }).check();
    await page.getByRole("button", { name: "Excluir conta definitivamente" }).click();
    await expect(page.getByText("Senha incorreta. A conta não foi excluída.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seus álbuns" })).toBeVisible();

    await page.getByLabel("Confirme sua senha").fill(password);
    await page.getByRole("checkbox", { name: /Entendo que não poderei recuperar/ }).check();
    await page.getByRole("button", { name: "Excluir conta definitivamente" }).click();
    await expect(page).toHaveURL(/\/login$/);
    deleted = true;

    const [profileRows, collectionRows, photoRows, objects, gallery] = await Promise.all([
      admin.from("profiles").select("id").eq("id", userId),
      admin.from("collections").select("id").eq("owner_id", userId),
      admin.from("photos").select("id").eq("id", photoId),
      admin.storage.from("photos").list(userId),
      page.request.get(galleryPath),
    ]);
    expect(profileRows.error).toBeNull();
    expect(profileRows.data).toHaveLength(0);
    expect(collectionRows.error).toBeNull();
    expect(collectionRows.data).toHaveLength(0);
    expect(photoRows.error).toBeNull();
    expect(photoRows.data).toHaveLength(0);
    expect(objects.error).toBeNull();
    expect(objects.data).toHaveLength(0);
    expect(gallery.status()).toBe(404);

    const account = await admin.auth.admin.getUserById(userId);
    expect(account.error).not.toBeNull();
    const staleUpload = await oldSession.storage.from("photos").upload(storagePath, tinyPng, {
      contentType: "image/png", upsert: false,
    });
    expect(staleUpload.error).not.toBeNull();
    const loginAgain = await oldSession.auth.signInWithPassword({ email, password });
    expect(loginAgain.error).not.toBeNull();
  } finally {
    if (!deleted) {
      if (storagePath) await admin.storage.from("photos").remove([storagePath]);
      if (orphanPath) await admin.storage.from("photos").remove([orphanPath]);
      await admin.auth.admin.deleteUser(userId);
    }
  }
});
