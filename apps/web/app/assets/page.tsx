import { PagePlaceholder } from "@/components/page-placeholder";

export default function AssetsPage() {
  return (
    <PagePlaceholder
      title="Wallet assets"
      description="Token-card layout of connected-wallet ERC-20s with balance, USDG estimate, route status (DISCOVERED / SUPPORTED / NO_ROUTE / HIGH_IMPACT / BLOCKED / DUST…), and a “Use for predictions” action."
      milestone="Phase 4 — asset discovery + quote eligibility"
    />
  );
}
