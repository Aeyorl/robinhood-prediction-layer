export const MARKET_CATEGORIES = ["STOCKS", "MEMECOINS"] as const;
export const SAMPLE_MARKET_STATUSES = ["OPEN", "CLOSING_SOON", "RESOLVED"] as const;

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];
export type SampleMarketStatus = (typeof SAMPLE_MARKET_STATUSES)[number];

export interface SampleMarket {
  slug: string;
  category: MarketCategory;
  symbol: string;
  assetName: string;
  question: string;
  closeLabel: string;
  closeTime: string;
  status: SampleMarketStatus;
  volume: string;
  yesShare: number;
  noShare: number;
  oracle: string;
  resolutionMethod: string;
  evidenceStatus: string;
  terms: string;
  sourceLabel?: string;
  sourceUrl?: string;
  marketCapLabel?: string;
  liquidityLabel?: string;
}

/** Public discovery data. It contains no contract addresses, wallet state, or transaction payloads. */
export const stockSampleMarkets: readonly SampleMarket[] = [
  {
    slug: "nvda-above-200-sep-30",
    category: "STOCKS",
    symbol: "NVDA",
    assetName: "NVIDIA",
    question: "Will NVDA close above $200 on Sep 30?",
    closeLabel: "Closes Sep 30, 4:00 PM ET",
    closeTime: "Sep 30",
    status: "CLOSING_SOON",
    volume: "428K USDG",
    yesShare: 63,
    noShare: 37,
    oracle: "Closing-price evidence workflow",
    resolutionMethod: "Reference closing price at the stated market close",
    evidenceStatus: "Preview — evidence is not yet published",
    terms:
      "YES resolves if the reference closing price is strictly above $200.00 at the stated close; otherwise NO resolves.",
  },
  {
    slug: "aapl-ai-hardware-wwdc",
    category: "STOCKS",
    symbol: "AAPL",
    assetName: "Apple",
    question: "Will Apple announce an AI hardware product by Oct 15?",
    closeLabel: "Closes Oct 15, 11:59 PM ET",
    closeTime: "Oct 15",
    status: "OPEN",
    volume: "311K USDG",
    yesShare: 54,
    noShare: 46,
    oracle: "Published-source evidence workflow",
    resolutionMethod: "Named primary sources and timestamped announcement evidence",
    evidenceStatus: "Preview — source criteria are shown before trading opens",
    terms:
      "YES requires a public Apple announcement meeting the market definition before the deadline.",
  },
  {
    slug: "tsla-above-350-oct-31",
    category: "STOCKS",
    symbol: "TSLA",
    assetName: "Tesla",
    question: "Will TSLA close above $350 on Oct 31?",
    closeLabel: "Closes Oct 31, 4:00 PM ET",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: "267K USDG",
    yesShare: 41,
    noShare: 59,
    oracle: "Closing-price evidence workflow",
    resolutionMethod: "Reference closing price at the stated market close",
    evidenceStatus: "Preview — evidence is not yet published",
    terms:
      "YES resolves if the reference closing price is strictly above $350.00 at the stated close; otherwise NO resolves.",
  },
  {
    slug: "coin-above-400-oct-31",
    category: "STOCKS",
    symbol: "COIN",
    assetName: "Coinbase",
    question: "Will COIN close above $400 on Oct 31?",
    closeLabel: "Closes Oct 31, 4:00 PM ET",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: "193K USDG",
    yesShare: 48,
    noShare: 52,
    oracle: "Closing-price evidence workflow",
    resolutionMethod: "Reference closing price at the stated market close",
    evidenceStatus: "Preview — evidence is not yet published",
    terms:
      "YES resolves if the reference closing price is strictly above $400.00 at the stated close; otherwise NO resolves.",
  },
  {
    slug: "hood-above-175-oct-31",
    category: "STOCKS",
    symbol: "HOOD",
    assetName: "Robinhood Markets",
    question: "Will HOOD close above $175 on Oct 31?",
    closeLabel: "Closes Oct 31, 4:00 PM ET",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: "156K USDG",
    yesShare: 57,
    noShare: 43,
    oracle: "Closing-price evidence workflow",
    resolutionMethod: "Reference closing price at the stated market close",
    evidenceStatus: "Preview — evidence is not yet published",
    terms:
      "YES resolves if the reference closing price is strictly above $175.00 at the stated close; otherwise NO resolves.",
  },
];

/** Backwards-compatible stock-only preview export. Server discovery adds memecoins. */
export const sampleMarkets = stockSampleMarkets;
