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
