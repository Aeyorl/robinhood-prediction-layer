import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end vertical slice: a real browser (installed Chrome via channel) is
 * pointed at the web app, and an injected EIP-1193 provider signs with an
 * anvil dev key so approve → enter → claim can be clicked through for real.
 *
 * Environment orchestration (anvil + forge deploy + next dev) lives in
 * e2e/global-setup.ts. Set E2E_REUSE=1 to attach to an already-running local
 * env instead of spawning a fresh one (web URL then comes from E2E_WEB_URL,
 * default http://127.0.0.1:3000).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://127.0.0.1:3100",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
