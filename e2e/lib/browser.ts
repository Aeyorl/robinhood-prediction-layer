import { expect, type Page } from "@playwright/test";

import { SHIM_OUT } from "./state.js";

export interface ShimConfig {
  rpcUrl: string;
  privateKey: `0x${string}`;
  chainId: number;
}

/**
 * Injects the bundled EIP-1193 shim before any app script runs on every
 * navigation. The wallet config was baked in at bundle time by global-setup.
 */
export function injectWallet(page: Page, _config?: ShimConfig): void {
  void _config;
  page.addInitScript({ path: SHIM_OUT });
}

/**
 * Connects the injected wallet. wagmi persists the connection in localStorage,
 * so after a reload the header may auto-reconnect and never show the Connect
 * button again — wait for the address first, and only click Connect when the
 * session did not restore. Re-run after any page.goto.
 */
export async function ensureConnected(page: Page, address: `0x${string}`): Promise<void> {
  const addressText = page.getByText(new RegExp(address.slice(0, 6)), { exact: false }).first();
  try {
    await addressText.waitFor({ state: "visible", timeout: 8_000 });
    return; // session restored from localStorage
  } catch {
    // Not connected yet — fall through to clicking Connect.
  }
  const connectButton = page.getByRole("button", { name: "Connect wallet", exact: true });
  // Fail fast instead of auto-waiting on a never-enabled button (e.g. when
  // hydration or provider detection broke) so callers can dump diagnostics.
  await expect(connectButton).toBeEnabled({ timeout: 20_000 });
  await connectButton.click();
  await expect(addressText).toBeVisible({ timeout: 30_000 });
}
