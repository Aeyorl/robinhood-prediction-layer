import "server-only";

import { robinhoodMainnet, stockTokenOracles, stockTokenOracleSources } from "@pl/chain-config";
import { createPublicClient, formatUnits, getAddress, http, isAddress } from "viem";

const feedAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

const stockTokenAbi = [
  {
    type: "function",
    name: "oraclePaused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;

const safeResolverAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "guardian",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

interface RobinhoodAsset {
  tokenSymbol: string;
  status: string;
  currentMultiplier: string;
  pendingMultiplier?: string;
  pendingMultiplierEffectiveTime?: string;
}

interface CorporateAction {
  id: string;
  tokenSymbol: string;
  type: string;
  status: string;
  processDate?: { year: number; month: number; day: number } | null;
}

async function readJson<T>(url: string, revalidate: number): Promise<T> {
  const response = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Robinhood API returned ${response.status}`);
  return (await response.json()) as T;
}

export async function loadOracleAdminData() {
  const client = createPublicClient({ chain: robinhoodMainnet, transport: http() });
  const now = Math.floor(Date.now() / 1_000);
  const configuredResolver = process.env.SAFE_CLOSING_PRICE_RESOLVER_ADDRESS;

  const [assetsResult, actionsResult] = await Promise.allSettled([
    readJson<{ assets: RobinhoodAsset[] }>(stockTokenOracleSources.assets, 300),
    readJson<{
      corpActions?: CorporateAction[];
      corporateActions?: CorporateAction[];
      actions?: CorporateAction[];
    }>(stockTokenOracleSources.corporateActions, 3_600),
  ]);
  const assets = assetsResult.status === "fulfilled" ? assetsResult.value.assets : [];
  const actionPayload = actionsResult.status === "fulfilled" ? actionsResult.value : {};
  const actions =
    actionPayload.corpActions ?? actionPayload.corporateActions ?? actionPayload.actions ?? [];
  const supportedSymbols = new Set<string>(stockTokenOracles.map((asset) => asset.symbol));

  const rows = await Promise.all(
    stockTokenOracles.map(async (config) => {
      const metadata = assets.find((asset) => asset.tokenSymbol === config.symbol);
      try {
        const [round, decimals, oraclePaused] = await Promise.all([
          client.readContract({
            address: config.feed,
            abi: feedAbi,
            functionName: "latestRoundData",
          }),
          client.readContract({ address: config.feed, abi: feedAbi, functionName: "decimals" }),
          client.readContract({
            address: config.token,
            abi: stockTokenAbi,
            functionName: "oraclePaused",
          }),
        ]);
        const [roundId, answer, , updatedAt, answeredInRound] = round;
        const ageSeconds = updatedAt > 0n ? Math.max(0, now - Number(updatedAt)) : null;
        const stale =
          ageSeconds == null ||
          Number(updatedAt) > now ||
          ageSeconds > config.heartbeatSeconds ||
          answeredInRound < roundId;
        const healthy = answer > 0n && !stale && !oraclePaused;
        return {
          ...config,
          healthy,
          status: healthy ? "Healthy" : oraclePaused ? "Oracle paused" : "Feed stale",
          price: answer > 0n ? formatUnits(answer, decimals) : null,
          updatedAt: updatedAt > 0n ? new Date(Number(updatedAt) * 1_000).toISOString() : null,
          ageSeconds,
          oraclePaused,
          assetStatus: metadata?.status ?? "Unavailable",
          currentMultiplier: metadata?.currentMultiplier ?? null,
          pendingMultiplier: metadata?.pendingMultiplier || null,
          pendingMultiplierEffectiveTime: metadata?.pendingMultiplierEffectiveTime ?? null,
        };
      } catch {
        return {
          ...config,
          healthy: false,
          status: "Onchain data unavailable",
          price: null,
          updatedAt: null,
          ageSeconds: null,
          oraclePaused: null,
          assetStatus: metadata?.status ?? "Unavailable",
          currentMultiplier: metadata?.currentMultiplier ?? null,
          pendingMultiplier: metadata?.pendingMultiplier || null,
          pendingMultiplierEffectiveTime: metadata?.pendingMultiplierEffectiveTime ?? null,
        };
      }
    }),
  );

  let safeResolver: {
    configured: boolean;
    address: string | null;
    owner: string | null;
    guardian: string | null;
    readable: boolean;
  } = { configured: false, address: null, owner: null, guardian: null, readable: false };
  if (configuredResolver && isAddress(configuredResolver)) {
    const address = getAddress(configuredResolver);
    try {
      const [code, owner, guardian] = await Promise.all([
        client.getCode({ address }),
        client.readContract({ address, abi: safeResolverAbi, functionName: "owner" }),
        client.readContract({ address, abi: safeResolverAbi, functionName: "guardian" }),
      ]);
      safeResolver = {
        configured: true,
        address,
        owner,
        guardian,
        readable: Boolean(code && code !== "0x"),
      };
    } catch {
      safeResolver = { configured: true, address, owner: null, guardian: null, readable: false };
    }
  }

  return {
    rows,
    warnings: actions.filter((action) => supportedSymbols.has(action.tokenSymbol)).slice(0, 12),
    assetsAvailable: assetsResult.status === "fulfilled",
    actionsAvailable: actionsResult.status === "fulfilled",
    safeResolver,
  };
}
