import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    channel: process.platform === "win32" ? "msedge" : undefined,
  },
  webServer: {
    command: "npm run start -- -p 3000",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
