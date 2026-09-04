import { Card, StatusBadge } from "@pl/ui";

/**
 * Honest empty state shown when the local chain/manifest is unavailable.
 * Phase 2 reads markets directly from the deployed local chain — when it is
 * not running we say so rather than fabricating data.
 */
export function NoLocalChain({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="space-y-3 border-dashed">
      <div className="flex items-center gap-2">
        <StatusBadge tone="amber">Local chain offline</StatusBadge>
        <span className="text-sm font-medium text-slate-200">No markets available</span>
      </div>
      <p className="text-sm text-slate-400">
        Markets are read live from the local deployment on anvil (chain id 46630). Start the chain
        and deploy the contracts to see real market state — nothing is fabricated here.
      </p>
      {!compact && (
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs leading-relaxed text-slate-300">
          {`# terminal 1 — local chain + deploy
pnpm dev:chain        # anvil --chain-id 46630 --port 8545
pnpm contracts:local  # forge script DeployLocal + manifest

# terminal 2 — web app pointed at the local chain
cd apps/web && cp .env.example .env.local
pnpm --filter @pl/web dev`}
        </pre>
      )}
    </Card>
  );
}
