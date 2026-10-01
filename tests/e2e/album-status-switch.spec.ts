import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Configure .env.local antes do E2E.");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

test("interruptor desativa e reativa o mesmo link sem confirmação", async ({ page, browser }) => {
  const email = `switch-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: "Teste Interruptor" },
  });
  expect(created.error).toBeNull();
  const userId = created.data.user!.id;

  try {
    const inserted = await admin.from("collections")
      .insert({ owner_id: userId, name: "Álbum interruptor E2E" })
      .select("id,public_token,is_active")
      .single();
    expect(inserted.error).toBeNull();
    const album = inserted.data!;
    expect(album.is_active).toBe(true);
    const galleryPath = `/g/${album.public_token}`;

    await page.goto("/login");
    await page.getByRole("textbox", { name: "E-mail" }).fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto(`/colecoes/${album.id}`);

    let dialogs = 0;
    page.on("dialog", (dialog) => {
      dialogs += 1;
      void dialog.dismiss();
    });

    const toggle = page.getByRole("switch", { name: "Compartilhamento público" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Inativo", { exact: true })).toBeVisible();
    await expect(page.locator('a[href^="/g/"]')).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toBeAttached();

    const visitorContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
    try {
      const visitor = await visitorContext.newPage();
      await visitor.goto(galleryPath);
      await expect(visitor.getByRole("heading", { name: "Álbum indisponível" })).toBeVisible();

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(page.locator(`a[href="${galleryPath}"]`)).toBeVisible();
      await visitor.reload();
      await expect(visitor.getByRole("heading", { name: "Álbum interruptor E2E" })).toBeVisible();
    } finally {
      await visitorContext.close();
    }

    expect(dialogs).toBe(0);
    const persisted = await admin.from("collections")
      .select("is_active,public_token")
      .eq("id", album.id)
      .single();
    expect(persisted.error).toBeNull();
    expect(persisted.data).toEqual({ is_active: true, public_token: album.public_token });
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});
