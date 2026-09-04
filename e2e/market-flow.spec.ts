import { expect, test } from "@playwright/test";

import { ensureConnected, injectWallet } from "./lib/browser.js";
import {
  BOB_ADDRESS,
  BOB_KEY,
  balanceOf,
  hasClaimed,
  lockAndResolve,
  marketBySlug,
  marketStatus,
  readManifest,
  readMarketUint,
  secondWalletEntersNo,
} from "./lib/chain.js";
import { CHAIN_ID, readState } from "./lib/state.js";

const AMOUNT = 100_000_000_000_000_000_000n; // 100 USDG
const OPPONENT = 50_000_000_000_000_000_000n; // 50 USDG
const WIN_PRICE = 30_000_000_000_000_000_000n; // 30 USDG < strike 50 → YES wins
const SLUG = "delta-below-50";

/**
 * Vertical slice through the real browser UI:
 * connect → faucet demo USDG → approve → enter YES → opposing NO wallet →
 * (node) lock + fresh oracle answer + resolve → reload → claim → portfolio.
 */
test("approve → enter → resolve → claim against anvil", async ({ page }) => {
  test.setTimeout(240_000);
  const state = readState();
  const { rpcUrl } = state;
  const manifest = readManifest();
  const usdg = manifest.usdg as `0x${string}`;
  const market = marketBySlug(SLUG);
  const marketAddress = market.address as `0x${string}`;
  const feed = market.feed as `0x${string}`;

  test.info().annotations.push({ type: "chain", description: `${rpcUrl} · market ${SLUG}` });

  // Debug: surface page errors + key state if the connect step fails.
  const consoleLines: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleLines.push(m.text().slice(0, 400));
  });
  page.on("pageerror", (e) =>
    consoleLines.push(`pageerror: ${(e.stack ?? e.message).slice(0, 600)}`),
  );

  // Start every navigation with the injected wallet (BOB).
  injectWallet(page, { rpcUrl, privateKey: BOB_KEY, chainId: CHAIN_ID });

  // ------------------------------------------------------------------
  // 1. Market page → connect → faucet demo USDG
  // ------------------------------------------------------------------
  await page.goto(`/market/${SLUG}`);
  // Guard: the page must be showing the live market, not an offline state.
  await expect(page.getByText(/Will the price of DELTA/).first()).toBeVisible({ timeout: 60_000 });
  try {
    await ensureConnected(page, BOB_ADDRESS);
  } catch (err) {
    console.error("[e2e-console]", consoleLines.slice(0, 20).join("\n"));
    try {
      const diag = await page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>;
        return {
          ethereum: typeof w.ethereum,
          shim: w.__PL_E2E_PROVIDER__ ?? false,
          connectDisabled: [...document.querySelectorAll("button")].some(
            (b) => b.textContent?.includes("Connect wallet") && (b as HTMLButtonElement).disabled,
          ),
          body: document.body.innerText.slice(0, 400),
        };
      });
      console.error("[e2e-diag]", JSON.stringify(diag));
    } catch {
      console.error("[e2e-diag] page already closed");
    }
    throw err;
  }

  const faucet = page.getByRole("button", { name: "Get 100,000 demo USDG (local only)" });
  await expect(faucet).toBeVisible();
  await faucet.click();
  await expect(page.getByText(/Minted 100,000 demo USDG/)).toBeVisible({ timeout: 30_000 });

  // ------------------------------------------------------------------
  // 2. Approve USDG then enter YES 100
  // ------------------------------------------------------------------
  await page.locator("#amount").fill("100");

  const approve = page.getByRole("button", { name: "Approve USDG", exact: true });
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByText(/USDG approved for this market/)).toBeVisible({ timeout: 30_000 });

  const enterYes = page.getByRole("button", { name: "Enter YES", exact: true });
  await expect(enterYes).toBeEnabled({ timeout: 30_000 });
  await enterYes.click();
  await expect(page.getByText(/Position entered on YES/)).toBeVisible({ timeout: 30_000 });

  // Onchain: BOB's YES stake landed.
  expect(await readMarketUint(rpcUrl, marketAddress, "yesPool")).toBe(AMOUNT);

  // ------------------------------------------------------------------
  // 3. Opposing wallet enters NO 50 (node-side, real signed txs)
  // ------------------------------------------------------------------
  await secondWalletEntersNo(rpcUrl, usdg, marketAddress, OPPONENT);
  expect(await readMarketUint(rpcUrl, marketAddress, "yesPool")).toBe(AMOUNT);
  expect(await readMarketUint(rpcUrl, marketAddress, "noPool")).toBe(OPPONENT);

  // The page re-reads state per request → pools show after reload.
  await page.reload();
  await ensureConnected(page, BOB_ADDRESS);
  await expect(page.getByText("Volume 150 USDG")).toBeVisible();

  // ------------------------------------------------------------------
  // 4. Lock → fresh oracle answer → resolve (YES wins)
  // ------------------------------------------------------------------
  await lockAndResolve(rpcUrl, marketAddress, feed, WIN_PRICE, BOB_KEY);
  const resolved = await marketStatus(rpcUrl, marketAddress);
  expect(resolved.status).toBe(2); // RESOLVED
  expect(resolved.winner).toBe(1); // YES
  expect(resolved.price).toBe(WIN_PRICE);

  // ------------------------------------------------------------------
  // 5. Reload → claim payout in the browser
  // ------------------------------------------------------------------
  await page.reload();
  await ensureConnected(page, BOB_ADDRESS);

  const claimButton = page.getByRole("button", { name: "Claim payout", exact: true });
  await expect(claimButton).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Claiming pays/)).toBeVisible();

  const balanceBefore = await balanceOf(rpcUrl, usdg, BOB_ADDRESS);
  await claimButton.click();
  await expect(page.getByText(/Payout claimed/)).toBeVisible({ timeout: 30_000 });

  // Parimutuel payout: stake 100 on YES of a 150 pool → gross 150, fee 0.
  expect(await hasClaimed(rpcUrl, marketAddress, BOB_ADDRESS)).toBe(true);
  expect(await balanceOf(rpcUrl, usdg, BOB_ADDRESS)).toBe(
    balanceBefore + 150_000_000_000_000_000_000n,
  );
  expect(await balanceOf(rpcUrl, usdg, marketAddress)).toBe(0n);

  // ------------------------------------------------------------------
  // 6. Portfolio reflects the resolved + claimed position
  // ------------------------------------------------------------------
  await page.goto("/portfolio");
  await ensureConnected(page, BOB_ADDRESS);
  await page.getByRole("button", { name: "History", exact: true }).click();
  // The card renders "Claimed · final" — match the substring.
  await expect(page.getByText(/Claimed/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(market.question).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// Guard: the demo tokens/mocks must never leak into production-looking state.
// ---------------------------------------------------------------------------
test("demo assets are clearly local (mocked collateral on chain 46630)", async () => {
  const state = readState();
  const manifest = readManifest();
  expect(state.chainId).toBe(46630);
  expect(manifest.chainId).toBe(46630);
  // USDG here is the local MockUSDG — never an invented mainnet address.
  expect(manifest.usdg).not.toBe("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
});
