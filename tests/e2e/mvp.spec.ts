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
    await page.goto("/login");
    await page.getByRole("textbox", { name: "E-mail" }).fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Sua primeira coleção começa aqui")).toBeVisible();

    await page.getByLabel("Nome da coleção").fill("Galeria E2E");
    await page.getByRole("button", { name: "Criar coleção" }).click();
    await expect(page).toHaveURL(/\/colecoes\/[0-9a-f-]+$/);
    const collectionUrl = page.url();
    const collectionId = collectionUrl.split("/").at(-1)!;
    const panelResponse = await page.request.get(collectionUrl);
    expect(panelResponse.headers()["cache-control"]).toContain("no-store");
    const galleryLink = page.locator('a[href^="/g/"]').first();
    const galleryPath = await galleryLink.getAttribute("href");
    expect(galleryPath).toMatch(/^\/g\/[0-9a-f-]+$/);

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
    } finally {
      await publicContext.close();
    }

    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).icons).toHaveLength(3);
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
    await page.getByRole("button", { name: "Excluir coleção" }).click();
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
