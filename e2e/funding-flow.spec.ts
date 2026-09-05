import { expect, test } from "@playwright/test";
import { erc20Abi, parseUnits } from "viem";
import { ensureConnected, injectWallet } from "./lib/browser.js";
import {
  BOB_ADDRESS,
  BOB_KEY,
  balanceOf,
  hasClaimed,
  lockAndResolve,
  marketBySlug,
  publicClient,
  readManifest,
  readMarketUint,
  secondWalletEntersNo,
  walletClient,
} from "./lib/chain.js";
import { CHAIN_ID, readState } from "./lib/state.js";

test("PONS → USDG → entry, recover after rejection, attribution → resolve → claim", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const state = readState();
  const manifest = readManifest();
  const market = marketBySlug("pons-above-100");
  const client = publicClient(state.rpcUrl);
  const wallet = walletClient(state.rpcUrl, BOB_KEY);
  const api = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "13001"}`;
  const snapshotResponse = await request.post(state.rpcUrl, {
    data: { jsonrpc: "2.0", id: 1, method: "evm_snapshot", params: [] },
  });
  const snapshot = (await snapshotResponse.json()).result;
  try {
    const pons = manifest.mocks.PONS!.address as `0x${string}`;
    const usdg = manifest.usdg as `0x${string}`;
    const marketAddress = market.address as `0x${string}`;
    const mintHash = await wallet.writeContract({
      address: pons,
      abi: [
        ...erc20Abi,
        {
          type: "function",
          name: "mint",
          inputs: [{ type: "address" }, { type: "uint256" }],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ] as const,
      functionName: "mint",
      args: [BOB_ADDRESS, parseUnits("2", 18)],
    });
    await client.waitForTransactionReceipt({ hash: mintHash });
    await expect
      .poll(
        async () => ((await (await request.get(`${api}/v1/markets`)).json()).markets ?? []).length,
      )
      .toBeGreaterThan(0);
    await injectWallet(page, { rpcUrl: state.rpcUrl, privateKey: BOB_KEY, chainId: CHAIN_ID });
    await page.goto(`/market/${market.slug}`);
    await ensureConnected(page, BOB_ADDRESS);
    await page.getByRole("button", { name: "Pay with another token" }).click();
    await expect(page.getByRole("option", { name: /PONS/ })).toBeAttached({ timeout: 60_000 });
    await page.getByLabel("Funding token", { exact: true }).selectOption(pons.toLowerCase());
    await page.getByLabel("Token amount", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Get quote", exact: true }).click();
    await expect(page.getByText("Expected 120 USDG")).toBeVisible();
    await page.screenshot({ path: ".e2e/funding-quote-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Confirm funding flow" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: ".e2e/funding-quote-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    // Reject only the market entry signature once; approvals and swap execute normally.
    await page.evaluate((marketAddress) => {
      const ethereum = (
        window as unknown as {
          ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
        }
      ).ethereum;
      const original = ethereum.request.bind(ethereum);
      let rejected = false;
      ethereum.request = async (args) => {
        const tx = args.params?.[0] as { to?: string } | undefined;
        if (
          !rejected &&
          args.method === "eth_sendTransaction" &&
          tx?.to?.toLowerCase() === marketAddress.toLowerCase()
        ) {
          rejected = true;
          throw Object.assign(new Error("User rejected entry"), { code: 4001 });
        }
        return original(args);
      };
    }, marketAddress);
    await page.getByRole("button", { name: "Confirm funding flow" }).click();
    await expect(page.locator("dialog").getByRole("alert")).toContainText(/reject/i, {
      timeout: 60_000,
    });
    expect(await balanceOf(state.rpcUrl, pons, BOB_ADDRESS)).toBe(parseUnits("1", 18));
    await page.reload();
    await ensureConnected(page, BOB_ADDRESS);
    await page.getByRole("button", { name: "Pay with another token" }).click();
    await expect(page.getByText(/Swap: 0x/)).toBeVisible();
    await page.getByRole("button", { name: "Resume funding flow" }).click();
    await expect(page.getByText("Position entered and funding attribution saved.")).toBeVisible({
      timeout: 60_000,
    });
    expect(await readMarketUint(state.rpcUrl, marketAddress, "yesPool")).toBe(
      parseUnits("120", 18),
    );
    expect(await balanceOf(state.rpcUrl, pons, BOB_ADDRESS)).toBe(parseUnits("1", 18)); // no duplicate swap
    await expect
      .poll(async () => {
        const response = await request.get(`${api}/v1/wallets/${BOB_ADDRESS}/trades`);
        const data = await response.json();
        return data.trades?.find(
          (t: { marketAddress: string }) => t.marketAddress === marketAddress.toLowerCase(),
        )?.attribution;
      })
      .toBe("SESSION_CORRELATED");
    await secondWalletEntersNo(state.rpcUrl, usdg, marketAddress, parseUnits("60", 18));
    await lockAndResolve(
      state.rpcUrl,
      marketAddress,
      market.feed as `0x${string}`,
      parseUnits("150", 18),
      BOB_KEY,
    );
    await page.reload();
    await ensureConnected(page, BOB_ADDRESS);
    const before = await balanceOf(state.rpcUrl, usdg, BOB_ADDRESS);
    await page.getByRole("button", { name: "Claim payout", exact: true }).click();
    await expect.poll(() => hasClaimed(state.rpcUrl, marketAddress, BOB_ADDRESS)).toBe(true);
    expect(await balanceOf(state.rpcUrl, usdg, BOB_ADDRESS)).toBe(before + parseUnits("180", 18));
    await page.goto("/portfolio");
    await ensureConnected(page, BOB_ADDRESS);
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByText(/Claimed/).first()).toBeVisible();
    await page.screenshot({ path: ".e2e/funding-portfolio.png", fullPage: true });
  } finally {
    await request.post(state.rpcUrl, {
      data: { jsonrpc: "2.0", id: 2, method: "evm_revert", params: [snapshot] },
    });
  }
});
