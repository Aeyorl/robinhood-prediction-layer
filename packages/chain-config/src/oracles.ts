import type { Address } from "viem";

import { ROBINHOOD_MAINNET_ID } from "./chains.js";

export interface StockTokenOracleConfig {
  symbol: "AAPL" | "NVDA" | "TSLA";
  name: string;
  chainId: typeof ROBINHOOD_MAINNET_ID;
  token: Address;
  feed: Address;
  heartbeatSeconds: number;
  sequencerFeed: Address | null;
}

export interface StockTokenDataStreamsConfig {
  symbol: StockTokenOracleConfig["symbol"];
  decimals: 18;
  regularHoursFeedId: `0x${string}`;
  extendedHoursFeedId: `0x${string}`;
  overnightHoursFeedId: `0x${string}`;
}

/**
 * Curated launch feeds verified against Robinhood's Stock Token API and
 * Chainlink's Robinhood mainnet reference-data directory on 2026-09-05.
 *
 * Robinhood Chain does not currently publish a sequencer uptime feed in the
 * Chainlink reference-data directory. Keep this null until an official address
 * is published; never substitute an unverified contract.
 */
export const stockTokenOracles: readonly StockTokenOracleConfig[] = [
  {
    symbol: "AAPL",
    name: "Apple",
    chainId: ROBINHOOD_MAINNET_ID,
    token: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    feed: "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0",
    heartbeatSeconds: 86_400,
    sequencerFeed: null,
  },
  {
    symbol: "NVDA",
    name: "Nvidia",
    chainId: ROBINHOOD_MAINNET_ID,
    token: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    feed: "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15",
    heartbeatSeconds: 86_400,
    sequencerFeed: null,
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    chainId: ROBINHOOD_MAINNET_ID,
    token: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
    feed: "0x4A1166a659A55625345e9515b32adECea5547C38",
    heartbeatSeconds: 86_400,
    sequencerFeed: null,
  },
] as const;

export const stockTokenOracleSources = {
  feeds: "https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json",
  assets: "https://api.robinhood.com/rhj/assets",
  corporateActions: "https://api.robinhood.com/rhj/corporate-actions",
} as const;

/**
 * Live mainnet RWA Advanced (v11) stream IDs returned by Chainlink's
 * Discovery endpoint on 2026-09-07. Scheduled closing-price markets use the
 * regular-hours stream and marketStatus 2; extended and overnight IDs are
 * retained for explicit future market terms, not as silent fallbacks.
 */
export const stockTokenDataStreams: readonly StockTokenDataStreamsConfig[] = [
  {
    symbol: "AAPL",
    decimals: 18,
    regularHoursFeedId: "0x000bbd87a23775b4c11092ae9a1fc7b3393636ae1dbb9f1ef460f845c0f4cff1",
    extendedHoursFeedId: "0x000b8b9394931d376dbfd988ab3e459b1954ca10880d6a2ec706cd2573910b5b",
    overnightHoursFeedId: "0x000b313c8a4997a3bc871130415ffeb42cd37b79cf68c11478780650cc553c0b",
  },
  {
    symbol: "NVDA",
    decimals: 18,
    regularHoursFeedId: "0x000b6aa036224454037bab103184565f6aa9ea589c3b349f6d8471ee753524b9",
    extendedHoursFeedId: "0x000bb043961643d051393c085a4dd0cded6f67b4b71e47e9dcec739b7b3e2145",
    overnightHoursFeedId: "0x000b47988e89f3e63e1d679c84b774e6c38bb9929ad9de6e5e56d657a80388a9",
  },
  {
    symbol: "TSLA",
    decimals: 18,
    regularHoursFeedId: "0x000b2dbed1640ead18d37338b75e4755630a900649261baf4ed79d9a749be13d",
    extendedHoursFeedId: "0x000b9e87f3f1ac8e590e47cce07a3e964d94f2abd5692b2f92f1dbab79874b07",
    overnightHoursFeedId: "0x000b67554457bf6c7e70d4d599d9634888fc8d79145c534ddd77ba1dae840107",
  },
] as const;

export const dataStreamsSources = {
  discovery: "https://api.dataengine.chain.link/api/v1/discovery",
  documentation:
    "https://docs.chain.link/data-streams/reference/data-streams-api/discovery-endpoint",
} as const;
