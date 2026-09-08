"use client";

import Link from "next/link";

import { Countdown, useFormatDate, useNow } from "@/components/countdown";
import { groupedAmount, type MarketView } from "@/lib/market-view";

export function MarketCard({ market }: { market: MarketView }) {
  const resolvedAt = useFormatDate(market.resolvedAt);
  const now = useNow();
  const yes = market.yesSharePct;
  const no = market.noSharePct;

  return (
    <Link href={`/market/${market.slug}`} className="light-market-card group">
      <div className="light-market-meta">
        <span className="light-asset-mark" aria-hidden="true">
          {market.assetSymbol.slice(0, 2)}
        </span>
        <strong>{market.assetSymbol}</strong>
        <span className="market-kind">
          {market.comparator === "PRICE_ABOVE_AT_TIME" ? "Price above" : "Price below"}
        </span>
        <span className="market-volume">
          <b>{groupedAmount(market.totalPool)}</b>
          <small>{market.collateralSymbol} volume</small>
        </span>
      </div>
      <h3>{market.question}</h3>
      <div className="market-timing">
        <span className="clock-mark" aria-hidden="true" />
        <span>
          <StatusCopy market={market} now={now} resolvedAt={resolvedAt} />
        </span>
        <span className="oracle-copy">
          Oracle: {market.feed.slice(0, 6)}…{market.feed.slice(-4)}
        </span>
      </div>
      <div className="market-badges">
        <span className="market-category-badge">Stock Token</span>
        {market.status === "RESOLVED" && (
          <span className="market-chainlink-badge" aria-label="Chainlink oracle resolved">
            ◆ Chainlink resolved
          </span>
        )}
        {market.status === "OPEN" && (
          <span className="market-status-badge market-status-open">Open</span>
        )}
        {market.status === "LOCKED" && (
          <span className="market-status-badge market-status-locked">Locked</span>
        )}
        {market.status === "RESOLVED" && (
          <span className="market-status-badge market-status-resolved">Resolved</span>
        )}
      </div>
      <div className="market-outcomes">
        <span className="market-yes">
          <b>YES</b>
          <strong>{yes == null ? "—" : `${yes.toFixed(0)}%`}</strong>
          <small>capital share</small>
        </span>
        <span className="market-no">
          <b>NO</b>
          <strong>{no == null ? "—" : `${no.toFixed(0)}%`}</strong>
          <small>capital share</small>
        </span>
      </div>
    </Link>
  );
}

function StatusCopy({
  market,
  now,
  resolvedAt,
}: {
  market: MarketView;
  now: number | null;
  resolvedAt: string;
}) {
  if (now == null) return <>Loading status…</>;
  if (market.status === "OPEN")
    return now >= market.lockTime * 1000 ? (
      <>Entry closed</>
    ) : (
      <>
        Closes in <Countdown targetSeconds={market.lockTime} />
      </>
    );
  if (market.status === "LOCKED")
    return (
      <>
        Locked · resolves in <Countdown targetSeconds={market.resolutionTime} />
      </>
    );
  if (market.status === "RESOLVED")
    return (
      <>
        {market.side} won{resolvedAt !== "—" ? ` · ${resolvedAt}` : ""}
      </>
    );
  return <>Cancelled · stakes refunded</>;
}
