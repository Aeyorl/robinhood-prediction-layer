"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CommunityConstellation } from "@/components/community-constellation";
import type { CommunitySummary } from "@/lib/analytics-api";
import { formatBps, formatUsdg, shortAddress } from "@/components/analytics";

const WINDOWS = ["7 days", "30 days", "All time"] as const;
type AnalyticsWindow = (typeof WINDOWS)[number];

export function CommunitySignalMap({
  communitiesByWindow,
}: {
  communitiesByWindow: Record<AnalyticsWindow, CommunitySummary[]>;
}) {
  const [window, setWindow] = useState<AnalyticsWindow>("7 days");
  const communities = communitiesByWindow[window];
  const [selectedAddress, setSelectedAddress] = useState(
    communitiesByWindow["7 days"][0]?.tokenAddress ?? "",
  );
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return communities.filter((community) => {
      const label = community.symbol ?? community.name ?? community.tokenAddress;
      return normalized === "" || label.toLowerCase().includes(normalized);
    });
  }, [communities, query]);
  const selected =
    communities.find((community) => community.tokenAddress === selectedAddress) ?? communities[0];

  if (!selected) {
    return (
      <>
        <div className="community-toolbar">
          <input
            type="search"
            placeholder="Search communities"
            aria-label="Search communities"
            disabled
          />
          <div role="group" aria-label="Analytics window">
            <button type="button" className="active">
              7 days
            </button>
            <button type="button">30 days</button>
            <button type="button">All time</button>
          </div>
          <span>No indexed entries in this window</span>
        </div>
        <div className="community-map-layout community-map-empty">
          <section className="community-map" aria-label="Empty source-token community map">
            <CommunityConstellation
              communities={[]}
              selectedAddress=""
              onSelect={() => undefined}
            />
            <div className="community-empty-overlay">
              <span className="section-kicker">Awaiting indexed activity</span>
              <h2>No communities yet</h2>
            </div>
          </section>
          <aside className="community-detail">
            <span className="section-kicker">Verified source data</span>
            <h2 className="community-empty-title">The map fills from attributed entries</h2>
            <p>
              Communities appear here after wallets fund positions through a verified source-token
              flow.
            </p>
            <div className="community-empty">
              <p>
                These views describe participating wallets only; they do not represent every token
                holder.
              </p>
            </div>
            <Link href="/markets" className="black-action">
              Explore open markets <span>→</span>
            </Link>
          </aside>
        </div>
      </>
    );
  }

  const label = selected.symbol ?? shortAddress(selected.tokenAddress);
  const stance = selected.topCurrentStance;
  const yesShare =
    stance?.strongestSide === "YES" ? stance.shareBps : stance ? 10_000 - stance.shareBps : null;
  const noShare = yesShare == null ? null : 10_000 - yesShare;

  return (
    <>
      <div className="community-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search communities"
          aria-label="Search communities"
        />
        <div role="group" aria-label="Analytics window">
          {WINDOWS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setWindow(item)}
              className={window === item ? "active" : ""}
            >
              {item}
            </button>
          ))}
        </div>
        <span>Showing indexed data · {window}</span>
      </div>

      <div className="community-map-layout">
        <section className="community-map" aria-label="Source-token communities">
          <CommunityConstellation
            communities={visible.slice(0, 5)}
            selectedAddress={selected.tokenAddress}
            onSelect={setSelectedAddress}
          />
        </section>

        <aside className="community-detail">
          <div className="community-detail-heading">
            <span className="community-token-mark">{label.slice(0, 2)}</span>
            <div>
              <small>Selected community</small>
              <h2>{label}</h2>
            </div>
          </div>
          <p>
            Activity from wallets that used {label} to fund positions across prediction markets.
          </p>
          <dl className="community-stats">
            <div>
              <dt>Participating wallets</dt>
              <dd>{selected.participantCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Markets</dt>
              <dd>{selected.marketCount}</dd>
            </div>
            <div>
              <dt>Attributed volume</dt>
              <dd>{formatUsdg(selected.volumeUsdg)}</dd>
            </div>
            <div>
              <dt>Resolved markets</dt>
              <dd>{selected.resolvedMarkets}</dd>
            </div>
          </dl>
          <div className="community-stance">
            <small>Strongest current participant stance</small>
            {stance ? (
              <>
                <div>
                  <strong className="yes-copy">YES {formatBps(yesShare)}</strong>
                  <strong className="no-copy">NO {formatBps(noShare)}</strong>
                </div>
                <div
                  className="community-share-track"
                  aria-label={`YES ${formatBps(yesShare)}, NO ${formatBps(noShare)}`}
                >
                  <span style={{ width: `${(yesShare ?? 0) / 100}%` }} />
                </div>
                <p>{stance.question}</p>
              </>
            ) : (
              <p>No open-market stance in this window.</p>
            )}
          </div>
          <div className="community-performance">
            <div>
              <span>Resolved hit rate</span>
              <strong>{formatBps(selected.hitRateBps)}</strong>
            </div>
            <div>
              <span>Realized PnL</span>
              <strong>{formatUsdg(selected.realizedPnlUsdg)}</strong>
            </div>
          </div>
          <Link
            href={`/community/${selected.chainId}/${selected.tokenAddress}`}
            className="black-action"
          >
            View community <span>→</span>
          </Link>
        </aside>
      </div>

      <div className="community-source-note">
        <strong>Verified source-funded entries</strong>
        <p>
          These views describe participating wallets only; they do not represent every token holder.
        </p>
      </div>
    </>
  );
}
