import { notFound } from "next/navigation";

import { branding } from "@pl/config";
import { Badge, Card, StatusBadge } from "@pl/ui";

import { MarketActions } from "@/components/market-actions";
import { Countdown } from "@/components/countdown";
import { TradePanel } from "@/components/trade-panel";
import { isLocalChainEnv } from "@/lib/chain";
import { groupedAmount, type MarketView } from "@/lib/market-view";
import { loadMarketViewBySlug } from "@/lib/server/markets";
import { NoLocalChain } from "@/components/no-local-chain";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<MarketView["status"], "green" | "red" | "amber" | "slate" | "indigo"> = {
  OPEN: "green",
  LOCKED: "amber",
  RESOLVED: "indigo",
  CANCELLED: "red",
};

export default async function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let market: MarketView | null = null;
  let chainDown = false;
  try {
    market = await loadMarketViewBySlug(slug);
  } catch {
    chainDown = true;
  }

  if (chainDown) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-white">Market unavailable</h1>
        <NoLocalChain />
      </div>
    );
  }
  if (!market) notFound();

  const isLocal = isLocalChainEnv();
  const total = groupedAmount(market.totalPool);
  const yesAmt = groupedAmount(market.yesPool);
  const noAmt = groupedAmount(market.noPool);
  const nowSeconds = Math.floor(Date.now() / 1000);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={STATUS_TONE[market.status]}>{market.status}</StatusBadge>
          <Badge>{market.assetSymbol}</Badge>
          <Badge>{market.comparatorLabel}</Badge>
          {isLocal && <StatusBadge tone="amber">Local chain</StatusBadge>}
        </div>
        <h1 className="max-w-3xl text-2xl font-bold leading-tight text-white sm:text-3xl">
          {market.question}
        </h1>
        <p className="font-mono text-xs text-slate-500">Market: {market.address}</p>
        <LifecycleLine market={market} nowSeconds={nowSeconds} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: pools + terms */}
        <div className="space-y-6 lg:col-span-3">
          {/* Capital split */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">YES / NO capital split</h2>
              <span className="text-sm text-slate-400">Volume {total} USDG</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-rose-500/40">
              {market.yesSharePct != null && market.yesSharePct > 0 && (
                <div
                  className="h-full bg-emerald-400/80 transition-all"
                  style={{ width: `${market.yesSharePct}%` }}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SidePoolCard
                side="YES"
                amount={yesAmt}
                pct={market.yesSharePct}
                highlight={market.status === "RESOLVED" && market.side === "YES"}
              />
              <SidePoolCard
                side="NO"
                amount={noAmt}
                pct={market.noSharePct}
                highlight={market.status === "RESOLVED" && market.side === "NO"}
              />
            </div>
            <p className="text-xs text-slate-500">
              Shares of staked capital — not mathematically exact implied probabilities.
            </p>
          </Card>

          {/* Resolution terms */}
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Resolution terms</h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Term label="Oracle asset" value={market.assetSymbol} mono={false} />
              <Term label="Comparator" value={market.comparatorLabel} mono={false} />
              <Term
                label="Strike"
                value={`${market.strike} ${market.collateralSymbol}`}
                mono={false}
              />
              <Term label="Strike decimals" value="18" mono />
              <Term
                label="Collateral"
                value={`${market.collateralSymbol} (${market.collateral})`}
                mono
              />
              <Term label="Price feed" value={market.feed} mono />
              <Term
                label="Min entry"
                value={`${groupedAmount(market.minEntry)} USDG`}
                mono={false}
              />
              <Term
                label="Fee (on profit)"
                value={`${BigInt(market.feeBps) / 100n}%`}
                mono={false}
              />
            </dl>
            <p className="text-xs text-slate-500">
              Terms are frozen onchain at creation. In v0 there is no early exit; winners share the
              full pool pro rata after resolution.
            </p>
          </Card>

          {/* Resolution outcome */}
          {market.status === "RESOLVED" && (
            <Card className="space-y-2 border-emerald-500/30 bg-emerald-500/5">
              <h2 className="text-lg font-semibold text-white">Outcome</h2>
              <p className="text-sm text-slate-200">
                <span className="font-bold text-emerald-400">{market.side}</span> won. The oracle
                price at resolution was{" "}
                <span className="font-semibold">{market.resolvedPrice ?? "—"} USDG</span>.
              </p>
              <p className="text-xs text-slate-400">
                Winners claim pro rata; if the winning side had no stake the market would cancel and
                refund. No early exit in v0.
              </p>
            </Card>
          )}

          {/* Activity (honest placeholder until the indexer milestone) */}
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Activity</h2>
            <p className="text-sm text-slate-400">
              Position entries, resolution, and claims appear here once the onchain indexer writes
              events to the database — the chain remains the source of truth.
            </p>
          </Card>

          {/* Community split (honest placeholder until attribution milestone) */}
          <Card className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Community split</h2>
            <p className="text-sm text-slate-400">
              Capital in this market grouped by the token used to fund it (e.g. “positions funded
              with PONS”) lands here with the funding-layer milestone.
            </p>
          </Card>
        </div>

        {/* Right: trade + actions */}
        <div className="space-y-6 lg:col-span-2">
          <TradePanel market={market} isLocal={isLocal} />
          <MarketActions market={market} />
          <p className="text-center text-xs text-slate-600">
            Markets on {branding.chainName}. Not affiliated with or endorsed by Robinhood.
          </p>
        </div>
      </div>
    </div>
  );
}

function Term({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`break-all text-slate-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function SidePoolCard({
  side,
  amount,
  pct,
  highlight,
}: {
  side: "YES" | "NO";
  amount: string;
  pct: number | null;
  highlight: boolean;
}) {
  const yes = side === "YES";
  return (
    <div
      className={
        highlight
          ? "rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-4"
          : "rounded-xl border border-white/10 bg-white/5 p-4"
      }
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${yes ? "text-emerald-400" : "text-rose-400"}`}>
          {side}
        </span>
        {highlight && <StatusBadge tone="green">Won</StatusBadge>}
      </div>
      <p className="mt-1 text-2xl font-semibold text-white">{amount}</p>
      <p className="text-xs text-slate-400">
        USDG · {pct != null ? `${pct.toFixed(1)}%` : "—"} of pool
      </p>
    </div>
  );
}

function LifecycleLine({ market, nowSeconds }: { market: MarketView; nowSeconds: number }) {
  const fmt = (s: number) =>
    new Date(s * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <p className="text-xs text-slate-400">
      {market.status === "OPEN" &&
        (nowSeconds < market.lockTime ? (
          <>
            Entry closes in <Countdown targetSeconds={market.lockTime} /> ·{" "}
          </>
        ) : (
          <>Entry closed · </>
        ))}
      {market.status === "LOCKED" &&
        (nowSeconds < market.resolutionTime ? (
          <>
            Resolves in <Countdown targetSeconds={market.resolutionTime} /> ·{" "}
          </>
        ) : (
          <>Ready to resolve · </>
        ))}
      Lock {fmt(market.lockTime)} · Resolution {fmt(market.resolutionTime)}
    </p>
  );
}
