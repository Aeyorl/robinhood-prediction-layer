import { createPublicClient, http } from "viem";

import { robinhoodMainnet, stockTokenOracles, stockTokenOracleSources } from "../dist/index.js";

const feedAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint80" },
      { type: "int256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
];

const pauseAbi = [
  {
    type: "function",
    name: "oraclePaused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
];

async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

const [rdd, assetPayload] = await Promise.all([
  json(stockTokenOracleSources.feeds),
  json(stockTokenOracleSources.assets),
]);
const client = createPublicClient({ chain: robinhoodMainnet, transport: http() });

for (const config of stockTokenOracles) {
  const feedMetadata = rdd.find((feed) => feed.docs?.baseAsset === config.symbol);
  if (feedMetadata?.proxyAddress?.toLowerCase() !== config.feed.toLowerCase()) {
    throw new Error(`${config.symbol}: configured feed no longer matches Chainlink metadata`);
  }
  if (feedMetadata.heartbeat !== config.heartbeatSeconds) {
    throw new Error(`${config.symbol}: configured heartbeat no longer matches Chainlink metadata`);
  }

  const asset = assetPayload.assets.find((entry) => entry.tokenSymbol === config.symbol);
  const deployment = asset?.deployments?.find((entry) => entry.chainId === config.chainId);
  if (deployment?.contractAddress?.toLowerCase() !== config.token.toLowerCase()) {
    throw new Error(`${config.symbol}: configured token no longer matches Robinhood metadata`);
  }

  const [feedCode, tokenCode, round, decimals, paused] = await Promise.all([
    client.getCode({ address: config.feed }),
    client.getCode({ address: config.token }),
    client.readContract({ address: config.feed, abi: feedAbi, functionName: "latestRoundData" }),
    client.readContract({ address: config.feed, abi: feedAbi, functionName: "decimals" }),
    client.readContract({ address: config.token, abi: pauseAbi, functionName: "oraclePaused" }),
  ]);
  if (!feedCode || feedCode === "0x" || !tokenCode || tokenCode === "0x") {
    throw new Error(`${config.symbol}: feed or token has no mainnet bytecode`);
  }
  const [roundId, answer, , updatedAt, answeredInRound] = round;
  if (answer <= 0n || updatedAt === 0n || answeredInRound < roundId) {
    throw new Error(`${config.symbol}: latest Chainlink round is invalid or incomplete`);
  }
  console.log(
    `${config.symbol}: feed=${config.feed} token=${config.token} decimals=${decimals} paused=${paused} updatedAt=${updatedAt}`,
  );
}

console.log(`Verified ${stockTokenOracles.length} curated Robinhood mainnet oracle configs.`);
