import Link from "next/link";
import { notFound } from "next/navigation";

import { TradePanel } from "@/components/trade-panel";
import { ACTIVE_CHAIN_ID, isLocalChainEnv } from "@/lib/chain";
import {
  COLLATERAL_DECIMALS,
  groupedAmount,
  makeMarketView,
  type MarketView,
} from "@/lib/market-view";
import type { SampleMarket } from "@/lib/sample-markets";
import { loadPublicMarkets } from "@/lib/server/dexscreener";
import { getLocalManifest, hasLocalManifest } from "@/lib/server/manifest";
import { loadMarketViewBySlug } from "@/lib/server/markets";
import { chainAddresses } from "@pl/chain-config";

export const dynamic = "force-dynamic";

function sampleToMarketView(sample: SampleMarket): MarketView {
  const chainId = ACTIVE_CHAIN_ID;
  const addresses = chainAddresses[chainId];
  const isMainnet = chainId === 4663;
  const collateral =
    addresses?.usdg ??
    (isMainnet
      ? "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"
      : "0x5FbDB2315678afecb367f032d93F642f64180aa3");

  const localManifest = hasLocalManifest() ? getLocalManifest() : null;
  const targetAddress =
    localManifest?.markets.find((m) => m.slug === sample.slug)?.address ??
    localManifest?.markets[0]?.address ??
    addresses?.predictionEntryRouter ??
    "0x62A301F2A0356a16fC1BB02991CfB9cFDb00152C";

  const nowSec = Math.floor(Date.now() / 1000);
  const lockTimeSec = nowSec + 30 * 24 * 3600;
  const openTimeSec = nowSec - 24 * 3600;

  const totalDecimals = BigInt(COLLATERAL_DECIMALS);
  const totalUnits = 50_000n * 10n ** totalDecimals;
  const yesPool = (totalUnits * BigInt(sample.yesShare)) / 100n;
  const noPool = totalUnits - yesPool;

  return makeMarketView({
    chainId,
    address: targetAddress,
    slug: sample.slug,
    question: sample.question,
    assetSymbol: sample.symbol,
    assetAddress: collateral,
    comparator: "PRICE_ABOVE_AT_TIME",
    strike: "0",
    strikeDecimals: COLLATERAL_DECIMALS,
    collateralSymbol: "USDG",
    collateral,
    feeBps: "100",
    minEntry: (1n * 10n ** totalDecimals).toString(),
    openTime: openTimeSec,
    lockTime: lockTimeSec,
    resolutionTime: lockTimeSec,
    gracePeriodSeconds: 86400,
    feed: addresses?.safeClosingPriceResolver ?? "0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5",
    status: 0,
    side: 0,
    resolvedPrice: "0",
    resolvedAt: 0,
    yesPool: yesPool.toString(),
    noPool: noPool.toString(),
  });
}

export default async function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let deployedMarket: MarketView | null = null;
  try {
    deployedMarket = await loadMarketViewBySlug(slug);
  } catch {
    // Discovery remains available when the production indexer is unavailable.
  }
  if (deployedMarket) return <LiveMarketDetail market={deployedMarket} />;

  const { markets } = await loadPublicMarkets();
  const market = markets.find((item) => item.slug === slug);
  if (!market) notFound();

  return (
    <div className="read-only-route">
      <div className="sample-detail">
        <Link href="/markets" className="sample-back">
          ← All markets
        </Link>
        <div className="sample-preview-banner">
          <strong>Trading open</strong>
          <span>Trading is live on Robinhood Chain. Enter with USDG or route any wallet token.</span>
        </div>
        <header className="sample-detail-header">
          <div>
            <span className={`sample-category sample-category-${market.category.toLowerCase()}`}>
              {market.category === "MEMECOINS" ? "Memecoin" : "Stock"}
            </span>
            <div className="sample-asset-line">
              <strong>{market.symbol}</strong>
              <span>{market.assetName}</span>
            </div>
            <h1>{market.question}</h1>
            <p>
              {market.closeLabel} · {market.status.replace("_", " ")} · {market.volume} sample
              volume
            </p>
          </div>
          <div
            className="sample-detail-split"
            aria-label={`YES ${market.yesShare}% capital share, NO ${market.noShare}% capital share`}
          >
            <div className="sample-share sample-yes">
              <span>▲ YES</span>
              <strong>{market.yesShare}%</strong>
              <small>capital share</small>
            </div>
            <div className="sample-share sample-no">
              <span>○ NO</span>
              <strong>{market.noShare}%</strong>
              <small>capital share</small>
            </div>
          </div>
        </header>

        <div className="sample-detail-grid">
          <section className="sample-detail-content">
            <article className="sample-information-card">
              <span>Market terms</span>
              <p>{market.terms}</p>
            </article>
            {market.sourceUrl && (
              <article className="sample-information-card">
                <span>Discovery source</span>
                <h2>{market.sourceLabel}</h2>
                <p>
                  {market.marketCapLabel} · {market.liquidityLabel}
                </p>
                <a
                  href={market.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="sample-source-link"
                >
                  View the source pair →
                </a>
              </article>
            )}
            <article className="sample-information-card">
              <span>Resolution source</span>
              <h2>{market.oracle}</h2>
              <p>
                {market.resolutionMethod}. Evidence status: {market.evidenceStatus}.
              </p>
            </article>
            <article className="sample-information-card">
              <span>How resolution works</span>
              <ol>
                <li>The stated source and close time define the observation window.</li>
                <li>Evidence is reviewed against the published market terms.</li>
                <li>
                  A future deployed market may resolve onchain only after its evidence requirements
                  are met.
                </li>
              </ol>
            </article>
            <article className="sample-information-card">
              <span>Activity</span>
              <p>
                Trading is open. Connect your wallet to enter positions, route meme tokens, or view
                your active portfolio.
              </p>
            </article>
          </section>
          <aside aria-label="Trading panel">
            <TradePanel market={sampleToMarketView(market)} isLocal={isLocalChainEnv()} />
          </aside>
        </div>
        <p className="sample-detail-disclaimer">
          Independent product. Not affiliated with or endorsed by Robinhood. All displayed market
          and volume figures are demonstration data until deployed markets exist.
        </p>
      </div>
    </div>
  );
}

function LiveMarketDetail({ market }: { market: MarketView }) {
  const yes = market.yesSharePct ?? 50;
  const no = market.noSharePct ?? 50;
  const formatTime = (seconds: number) =>
    new Date(seconds * 1000).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="read-only-route">
      <div className="sample-detail">
        <Link href="/markets" className="sample-back">
          ← All markets
        </Link>
        <div className="sample-preview-banner">
          <strong>Onchain market</strong>
          <span>Trading uses USDG on Robinhood Chain.</span>
        </div>
        <header className="sample-detail-header">
          <div>
            <span className="sample-category sample-category-memecoins">{market.status}</span>
            <div className="sample-asset-line">
              <strong>{market.assetSymbol}</strong>
              <span>{market.comparatorLabel}</span>
            </div>
            <h1>{market.question}</h1>
            <p>
              Entry closes {formatTime(market.lockTime)} · {groupedAmount(market.totalPool)} USDG
            </p>
          </div>
          <div
            className="sample-detail-split"
            aria-label={`YES ${yes}% capital share, NO ${no}% capital share`}
          >
            <div className="sample-share sample-yes">
              <span>▲ YES</span>
              <strong>{yes.toFixed(1)}%</strong>
              <small>{groupedAmount(market.yesPool)} USDG</small>
            </div>
            <div className="sample-share sample-no">
              <span>○ NO</span>
              <strong>{no.toFixed(1)}%</strong>
              <small>{groupedAmount(market.noPool)} USDG</small>
            </div>
          </div>
        </header>

        <div className="sample-detail-grid">
          <section className="sample-detail-content">
            <article className="sample-information-card">
              <span>Immutable market terms</span>
              <h2>{market.comparatorLabel}</h2>
              <p>
                Strike: {market.strike} · Resolution: {formatTime(market.resolutionTime)} · Fee on
                profit: {Number(market.feeBps) / 100}% · Minimum entry:{" "}
                {groupedAmount(market.minEntry)} USDG.
              </p>
            </article>
            <article className="sample-information-card">
              <span>Resolution</span>
              <h2>Evidence-backed governed observation</h2>
              <p>
                The published evidence hash and observation must complete the challenge period
                before this market can resolve. The market contract and terms are onchain.
              </p>
            </article>
            <article className="sample-information-card">
              <span>Contract</span>
              <p>{market.address}</p>
            </article>
          </section>
          <aside aria-label="Trading panel">
            <TradePanel market={market} isLocal={isLocalChainEnv()} />
          </aside>
        </div>
        <p className="sample-detail-disclaimer">
          Capital share is not guaranteed probability. Independent product. Not affiliated with or
          endorsed by Robinhood.
        </p>
      </div>
    </div>
  );
}
