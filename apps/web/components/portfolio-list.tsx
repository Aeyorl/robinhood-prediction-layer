"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { binaryPoolMarketAbi } from "@pl/sdk";
import { Button } from "@pl/ui";
import { useAccount, useChainId, usePublicClient } from "wagmi";

import { groupedAmount, type MarketView } from "@/lib/market-view";
import { getWalletTrades } from "@/lib/funding-api";

function addr(a: string): `0x${string}` {
  return a as `0x${string}`;
}

interface PositionRow {
  market: MarketView;
  yesStake: bigint;
  noStake: bigint;
  claimed: boolean;
  totalStake: bigint;
  /** true when the wallet can claim or refund right now */
  actionable: boolean;
  claimableReason: string | null;
}

type Tab = "active" | "claimable" | "resolved" | "history";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "active", label: "Active" },
  { key: "claimable", label: "Claimable" },
  { key: "resolved", label: "Resolved" },
  { key: "history", label: "History" },
];

export function PortfolioList({ markets }: { markets: MarketView[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? (
    <PortfolioBody markets={markets} />
  ) : (
    <div className="portfolio-loading">Loading portfolio…</div>
  );
}

function PortfolioBody({ markets }: { markets: MarketView[] }) {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const publicClient = usePublicClient();
  const [tab, setTab] = useState<Tab>("active");

  const wrongChain = isConnected && walletChainId !== markets[0]?.chainId;
  const enabled = isConnected && !wrongChain && !!address && !!publicClient;
  const funding = useQuery({
    queryKey: ["portfolio-funding", address, walletChainId],
    queryFn: () => getWalletTrades(address!),
    enabled,
    retry: false,
    refetchInterval: 10_000,
  });

  // Direct per-market reads (no multicall3 dependency — anvil and some
  // testnets don't deploy it).
  const { data, isFetching } = useQuery({
    queryKey: ["portfolio-positions", markets.map((m) => m.address).join(","), address, enabled],
    queryFn: async () => {
      if (!publicClient || !address) throw new Error("not connected");
      const perMarket = await Promise.all(
        markets.map(async (m) => {
          const [yesStake, noStake, claimed] = await Promise.all([
            publicClient.readContract({
              address: addr(m.address),
              abi: binaryPoolMarketAbi,
              functionName: "userYesStake",
              args: [address],
            }),
            publicClient.readContract({
              address: addr(m.address),
              abi: binaryPoolMarketAbi,
              functionName: "userNoStake",
              args: [address],
            }),
            publicClient.readContract({
              address: addr(m.address),
              abi: binaryPoolMarketAbi,
              functionName: "hasClaimed",
              args: [address],
            }),
          ]);
          return {
            yesStake: yesStake as bigint,
            noStake: noStake as bigint,
            claimed: claimed as boolean,
          };
        }),
      );
      return perMarket;
    },
    enabled,
    refetchInterval: 5_000,
  });

  const rows: PositionRow[] = useMemo(() => {
    if (!data) return [];
    return markets.map((market, i) => {
      const { yesStake, noStake, claimed } = data[i] ?? {
        yesStake: 0n,
        noStake: 0n,
        claimed: false,
      };
      const totalStake = yesStake + noStake;

      let actionable = false;
      let claimableReason: string | null = null;
      if (market.status === "RESOLVED") {
        const stakeOnWin = market.side === "YES" ? yesStake : market.side === "NO" ? noStake : 0n;
        if (stakeOnWin > 0n && !claimed) {
          actionable = true;
          claimableReason = "Claim payout";
        } else if (totalStake > 0n) {
          claimableReason = claimed ? "Claimed" : "Losing side — nothing to claim";
        }
      } else if (market.status === "CANCELLED") {
        if (totalStake > 0n && !claimed) {
          actionable = true;
          claimableReason = "Refund";
        } else if (totalStake > 0n) {
          claimableReason = "Refunded";
        }
      } else if (totalStake > 0n) {
        claimableReason = "In market";
      }

      return { market, yesStake, noStake, claimed, totalStake, actionable, claimableReason };
    });
  }, [data, markets]);

  const withPosition = rows.filter((r) => r.totalStake > 0n);
  const totalStake = withPosition.reduce((sum, row) => sum + row.totalStake, 0n);
  const totalYes = withPosition.reduce((sum, row) => sum + row.yesStake, 0n);
  const totalNo = withPosition.reduce((sum, row) => sum + row.noStake, 0n);
  const openCapital = withPosition
    .filter((row) => row.market.status === "OPEN" || row.market.status === "LOCKED")
    .reduce((sum, row) => sum + row.totalStake, 0n);
  const yesPct = totalStake > 0n ? Number((totalYes * 10_000n) / totalStake) / 100 : null;
  const noPct = yesPct == null ? null : 100 - yesPct;

  const visible = withPosition.filter((r) => {
    switch (tab) {
      case "active":
        return r.market.status === "OPEN" || r.market.status === "LOCKED";
      case "claimable":
        return r.actionable;
      case "resolved":
        return r.market.status === "RESOLVED" || r.market.status === "CANCELLED";
      case "history":
        return true;
    }
  });

  return (
    <div className="portfolio-ledger">
      <div className="portfolio-summary">
        <div className="portfolio-wallet-state">
          <small>Wallet</small>
          <strong>
            {isConnected && address
              ? `${address.slice(0, 6)}…${address.slice(-4)}`
              : "Not connected"}
          </strong>
          <span>
            {isConnected ? "Robinhood Chain" : "Connect from the header to load positions"}
          </span>
        </div>
        <dl>
          <div>
            <dt>Total staked</dt>
            <dd>{isConnected ? `${groupedAmount(totalStake)} USDG` : "—"}</dd>
          </div>
          <div>
            <dt>Open capital</dt>
            <dd>{isConnected ? `${groupedAmount(openCapital)} USDG` : "—"}</dd>
          </div>
          <div>
            <dt>Claimable</dt>
            <dd>
              {isConnected
                ? `${withPosition.filter((row) => row.actionable).length} positions`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Position history</dt>
            <dd>{isConnected ? `${withPosition.length} markets` : "—"}</dd>
          </div>
        </dl>
      </div>

      <section className="portfolio-exposure" aria-label="Position exposure">
        <div>
          <small>YES positions</small>
          <strong className="yes-copy">{yesPct == null ? "—" : `${yesPct.toFixed(0)}%`}</strong>
          <span>{groupedAmount(totalYes)} USDG</span>
        </div>
        <div
          className={`portfolio-exposure-track ${yesPct == null ? "empty" : ""}`}
          aria-label={yesPct == null ? "No position exposure" : `YES ${yesPct}%, NO ${noPct}%`}
        >
          <span style={{ width: `${yesPct ?? 0}%` }} />
        </div>
        <div>
          <small>NO positions</small>
          <strong className="no-copy">{noPct == null ? "—" : `${noPct.toFixed(0)}%`}</strong>
          <span>{groupedAmount(totalNo)} USDG</span>
        </div>
      </section>

      {!isConnected ? (
        <div className="portfolio-connect-state">
          <span className="section-kicker">Wallet required</span>
          <h2>Connect to see your positions</h2>
          <p>
            Your positions are read directly from the chain for your wallet address — no account
            signup needed.
          </p>
          <Link href="/markets" className="black-action">
            Explore markets <span>→</span>
          </Link>
        </div>
      ) : wrongChain ? (
        <div className="portfolio-connect-state">
          <p>Wrong network — switch to Robinhood Chain (chain id 46630) to view your positions.</p>
        </div>
      ) : (
        <>
          <div className="portfolio-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={tab === t.key ? "active" : ""}
              >
                {t.label}
              </button>
            ))}
            {isFetching && <span>Refreshing chain state…</span>}
          </div>

          {visible.length === 0 ? (
            <div className="portfolio-empty">
              {tab === "claimable"
                ? "Nothing claimable right now. Resolved winners and cancelled-market refunds show up here."
                : withPosition.length === 0
                  ? "You have no positions yet. Browse markets and enter with USDG."
                  : "No positions in this tab."}
            </div>
          ) : (
            <div className="portfolio-position-list">
              {visible.map((r) => (
                <div key={r.market.address}>
                  <PositionCard row={r} />
                  {funding.data?.chainId === r.market.chainId &&
                    funding.data.trades
                      .filter(
                        (t) =>
                          t.marketAddress.toLowerCase() === r.market.address.toLowerCase() &&
                          t.fundingTokenAddress,
                      )
                      .map((t) => (
                        <p key={t.txHash} className="portfolio-funding-note">
                          {groupedAmount(t.amountUsdg)} USDG funded with {t.fundingTokenAddress} ·{" "}
                          {t.attribution === "SESSION_CORRELATED"
                            ? "session-correlated, not trustless attribution"
                            : t.attribution}
                        </p>
                      ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PositionCard({ row }: { row: PositionRow }) {
  const { market, yesStake, noStake, totalStake, actionable, claimableReason } = row;
  const totalPool = BigInt(market.totalPool);
  const shareOfPool = totalPool > 0n ? Number((totalStake * 10_000n) / totalPool) / 100 : null;

  return (
    <article className="portfolio-position-row">
      <div className="position-market-cell">
        <span className={`position-side-mark ${yesStake > 0n ? "yes" : "no"}`}>
          {yesStake > 0n ? "YES" : "NO"}
        </span>
        <Link href={`/market/${market.slug}`}>{market.question}</Link>
        <small>
          {market.assetSymbol} · {market.address.slice(0, 6)}…{market.address.slice(-4)}
        </small>
      </div>
      <div className="position-data-cell">
        <small>Position</small>
        <strong>
          {yesStake > 0n ? `YES ${groupedAmount(yesStake.toString())}` : ""}
          {yesStake > 0n && noStake > 0n ? " + " : ""}
          {noStake > 0n ? `NO ${groupedAmount(noStake.toString())}` : ""} USDG
        </strong>
      </div>
      <div className="position-data-cell">
        <small>Share of pool</small>
        <strong>{shareOfPool != null ? `${shareOfPool.toFixed(2)}%` : "—"}</strong>
      </div>
      <div className="position-data-cell">
        <small>Status</small>
        <strong>{market.status}</strong>
        <span>{claimableReason ?? (market.status === "OPEN" ? "Accepting capital" : "Final")}</span>
      </div>
      <div className="position-action-cell">
        {actionable ? (
          <Link href={`/market/${market.slug}#actions`}>
            <Button size="sm">{claimableReason}</Button>
          </Link>
        ) : (
          <Link href={`/market/${market.slug}`}>View market →</Link>
        )}
      </div>
    </article>
  );
}
