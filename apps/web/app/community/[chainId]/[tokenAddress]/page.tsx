import { PagePlaceholder } from "@/components/page-placeholder";

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ chainId: string; tokenAddress: string }>;
}) {
  const { chainId, tokenAddress } = await params;
  return (
    <PagePlaceholder
      title={`Community ${chainId}/${tokenAddress}`}
      description="Positions funded with this token — normalized USDG volume, participating wallets, market YES/NO capital split, realized PnL, hit rate, and top predictors. Identity is always (chainId, contractAddress)."
      milestone="Phase 6 — community layer"
    />
  );
}
