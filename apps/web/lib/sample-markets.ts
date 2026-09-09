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
}

/** Public discovery data. It contains no contract addresses, wallet state, or transaction payloads. */
export const sampleMarkets: readonly SampleMarket[] = [
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
  {
    slug: "doge-above-030-oct-31",
    category: "MEMECOINS",
    symbol: "DOGE",
    assetName: "Dogecoin",
    question: "Will DOGE trade above $0.30 on Oct 31?",
    closeLabel: "Closes Oct 31, 11:59 PM UTC",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: "382K USDG",
    yesShare: 61,
    noShare: 39,
    oracle: "Published market-data evidence workflow",
    resolutionMethod: "Defined spot-price source and timestamped evidence",
    evidenceStatus: "Preview — source selection is not final",
    terms:
      "YES resolves only if the defined reference price is strictly above $0.30 at the deadline.",
  },
  {
    slug: "pepe-above-000015-oct-31",
    category: "MEMECOINS",
    symbol: "PEPE",
    assetName: "Pepe",
    question: "Will PEPE trade above $0.000015 on Oct 31?",
    closeLabel: "Closes Oct 31, 11:59 PM UTC",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: "244K USDG",
    yesShare: 45,
    noShare: 55,
    oracle: "Published market-data evidence workflow",
    resolutionMethod: "Defined spot-price source and timestamped evidence",
    evidenceStatus: "Preview — source selection is not final",
    terms:
      "YES resolves only if the defined reference price is strictly above $0.000015 at the deadline.",
  },
  {
    slug: "bonk-above-00004-oct-31",
    category: "MEMECOINS",
    symbol: "BONK",
    assetName: "Bonk",
    question: "Will BONK trade above $0.00004 on Oct 31?",
    closeLabel: "Closes Oct 31, 11:59 PM UTC",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: "189K USDG",
    yesShare: 52,
    noShare: 48,
    oracle: "Published market-data evidence workflow",
    resolutionMethod: "Defined spot-price source and timestamped evidence",
    evidenceStatus: "Preview — source selection is not final",
    terms:
      "YES resolves only if the defined reference price is strictly above $0.00004 at the deadline.",
  },
  {
    slug: "wif-above-250-oct-31",
    category: "MEMECOINS",
    symbol: "WIF",
    assetName: "dogwifhat",
    question: "Will WIF trade above $2.50 on Oct 31?",
    closeLabel: "Closes Oct 31, 11:59 PM UTC",
    closeTime: "Oct 31",
    status: "OPEN",
    volume: "138K USDG",
    yesShare: 36,
    noShare: 64,
    oracle: "Published market-data evidence workflow",
    resolutionMethod: "Defined spot-price source and timestamped evidence",
    evidenceStatus: "Preview — source selection is not final",
    terms:
      "YES resolves only if the defined reference price is strictly above $2.50 at the deadline.",
  },
  {
    slug: "shib-above-000025-oct-31",
    category: "MEMECOINS",
    symbol: "SHIB",
    assetName: "Shiba Inu",
    question: "Will SHIB trade above $0.000025 on Oct 31?",
    closeLabel: "Closes Oct 31, 11:59 PM UTC",
    closeTime: "Oct 31",
    status: "RESOLVED",
    volume: "221K USDG",
    yesShare: 39,
    noShare: 61,
    oracle: "Published market-data evidence workflow",
    resolutionMethod: "Defined spot-price source and timestamped evidence",
    evidenceStatus: "Sample resolved state — no onchain outcome exists",
    terms: "This is demonstration data only and is not a settled market outcome.",
  },
];

export function getSampleMarket(slug: string) {
  return sampleMarkets.find((market) => market.slug === slug);
}
