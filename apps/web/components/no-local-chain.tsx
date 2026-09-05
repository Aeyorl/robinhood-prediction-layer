import { Card, StatusBadge } from "@pl/ui";

export function NoLocalChain({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="space-y-3 border-dashed">
      <div className="flex items-center gap-2">
        <StatusBadge tone="amber">Market data unavailable</StatusBadge>
        <span className="text-sm font-medium text-slate-200">Markets could not be loaded</span>
      </div>
      <p className="text-sm text-slate-400">
        The chain connection is temporarily unavailable. Check your network and try again; no market
        data is estimated while the source of truth cannot be reached.
      </p>
      {!compact && (
        <p className="text-xs text-slate-500">
          If the problem continues, return later or contact the operator.
        </p>
      )}
    </Card>
  );
}
