import { readFileSync } from "node:fs";

import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Address,
  type Chain,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { erc20Abi, marketAbi } from "./abis.js";

const FEED_ABI: Abi = [
  {
    type: "function",
    name: "setAnswer",
    stateMutability: "nonpayable",
    inputs: [{ type: "int256", name: "answer_" }],
    outputs: [],
  },
];

const UINT_GETTERS = ["lockTime", "resolutionTime", "yesPool", "noPool"] as const;

import { MANIFEST_PATH } from "./state.js";

// Canonical anvil dev keys (account #1 = browser wallet, #2 = second wallet).
export const BOB_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Address;
export const CAROL_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Address;
export const BOB_ADDRESS = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as Address;
export const CAROL_ADDRESS = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc" as Address;

export interface ManifestMarket {
  address: string;
  slug: string;
  question: string;
  comparator: string;
  strike: string;
  asset: string;
  feed: string;
  minEntry: string;
}

export interface Manifest {
  chainId: number;
  factory: string;
  usdg: string;
  mockSwapAdapter: string;
  predictionEntryRouter: string;
  markets: ManifestMarket[];
  mocks: Record<string, { address: string; symbol: string }>;
}

export function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
}

export function marketBySlug(slug: string): ManifestMarket {
  const market = readManifest().markets.find((m) => m.slug === slug);
  if (!market) throw new Error(`market ${slug} not in manifest`);
  return market;
}

function localChainDef(rpcUrl: string): Chain {
  return {
    id: 46630,
    name: "Robinhood Chain Testnet (local)",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  } as Chain;
}

export function publicClient(rpcUrl: string): PublicClient {
  return createPublicClient({ chain: localChainDef(rpcUrl), transport: http(rpcUrl) });
}

export function walletClient(rpcUrl: string, privateKey: Address) {
  // Return type is inferred so viem knows account + chain are configured and
  // does not demand them on every writeContract call.
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: localChainDef(rpcUrl),
    transport: http(rpcUrl),
  });
}

async function rpc(rpcUrl: string, method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

/** Anvil block helpers (test-only chain manipulation). */
export async function anvilSetTime(rpcUrl: string, seconds: number): Promise<void> {
  await rpc(rpcUrl, "anvil_setNextBlockTimestamp", [seconds]);
  await rpc(rpcUrl, "anvil_mine");
}

export async function anvilReset(rpcUrl: string): Promise<void> {
  await rpc(rpcUrl, "anvil_reset", [{ jsonRpcUrl: rpcUrl }]).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Contract reads
// ---------------------------------------------------------------------------

export async function readMarketUint(
  rpcUrl: string,
  market: Address,
  fn: (typeof UINT_GETTERS)[number],
): Promise<bigint> {
  const value = await publicClient(rpcUrl).readContract({
    address: market,
    abi: marketAbi,
    functionName: fn,
  });
  return value as bigint;
}

export async function balanceOf(rpcUrl: string, token: Address, who: Address): Promise<bigint> {
  return publicClient(rpcUrl).readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [who],
  }) as Promise<bigint>;
}

export async function marketStatus(
  rpcUrl: string,
  market: Address,
): Promise<{ status: number; winner: number; price: bigint }> {
  const client = publicClient(rpcUrl);
  const [status, winner, price] = await Promise.all([
    client.readContract({ address: market, abi: marketAbi, functionName: "status" }),
    client.readContract({ address: market, abi: marketAbi, functionName: "winningOutcome" }),
    client.readContract({ address: market, abi: marketAbi, functionName: "resolvedPrice" }),
  ]);
  return { status: Number(status), winner: Number(winner), price: price as bigint };
}

// ---------------------------------------------------------------------------
// User actions (signed with a wallet client against anvil)
// ---------------------------------------------------------------------------

export async function mintUsdg(
  rpcUrl: string,
  usdg: Address,
  to: Address,
  amount: bigint,
  key: Address,
): Promise<void> {
  const client = walletClient(rpcUrl, key);
  await client.writeContract({
    address: usdg,
    abi: erc20Abi,
    functionName: "mint",
    args: [to, amount],
  });
}

export async function approve(
  rpcUrl: string,
  usdg: Address,
  spender: Address,
  amount: bigint,
  key: Address,
): Promise<void> {
  const client = walletClient(rpcUrl, key);
  await client.writeContract({
    address: usdg,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
}

export async function enterMarket(
  rpcUrl: string,
  market: Address,
  side: 1 | 2,
  amount: bigint,
  key: Address,
): Promise<void> {
  const client = walletClient(rpcUrl, key);
  await client.writeContract({
    address: market,
    abi: marketAbi,
    functionName: "enter",
    args: [side, amount],
  });
}

/** Fund + enter NO on the second anvil account (creates a real losing pool). */
export async function secondWalletEntersNo(
  rpcUrl: string,
  usdg: Address,
  market: Address,
  amount: bigint,
): Promise<void> {
  const allowance = amount * 10n;
  await mintUsdg(rpcUrl, usdg, CAROL_ADDRESS, amount * 10n, CAROL_KEY);
  await approve(rpcUrl, usdg, market, allowance, CAROL_KEY);
  await enterMarket(rpcUrl, market, 2, amount, CAROL_KEY);
}

// ---------------------------------------------------------------------------
// Market lifecycle (lock → advance time → fresh oracle answer → resolve)
// ---------------------------------------------------------------------------

/**
 * Drives a market to RESOLVED: locks it after lockTime, warps past
 * resolutionTime, stamps a fresh feed answer (staleness check!), resolves.
 * `winPrice` is the oracle price the winner side needs (feed decimals = 18
 * for the demo feeds).
 */
export async function lockAndResolve(
  rpcUrl: string,
  market: Address,
  feed: Address,
  winPrice: bigint,
  key: Address,
): Promise<void> {
  const client = walletClient(rpcUrl, key);
  const lockTime = await readMarketUint(rpcUrl, market, "lockTime");
  const resolutionTime = await readMarketUint(rpcUrl, market, "resolutionTime");

  await anvilSetTime(rpcUrl, Number(lockTime) + 2);
  await client.writeContract({ address: market, abi: marketAbi, functionName: "lock" });

  await anvilSetTime(rpcUrl, Number(resolutionTime) + 2);
  // Feed freshness is checked against block.timestamp at resolve time, so the
  // answer must be stamped AFTER the final warp.
  await client.writeContract({
    address: feed,
    abi: FEED_ABI,
    functionName: "setAnswer",
    args: [winPrice],
  });
  await client.writeContract({ address: market, abi: marketAbi, functionName: "resolve" });
}

export async function hasClaimed(rpcUrl: string, market: Address, who: Address): Promise<boolean> {
  const value = await publicClient(rpcUrl).readContract({
    address: market,
    abi: marketAbi,
    functionName: "hasClaimed",
    args: [who],
  });
  return value as boolean;
}

export async function claim(rpcUrl: string, market: Address, key: Address): Promise<void> {
  const client = walletClient(rpcUrl, key);
  await client.writeContract({ address: market, abi: marketAbi, functionName: "claim" });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
