import { SampleMarketDirectory } from "@/components/sample-market-directory";
import { loadPublicMarkets } from "@/lib/server/dexscreener";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const { markets, memeDiscovery } = await loadPublicMarkets();
  return (
    <div className="light-route market-signals-route">
      <SampleMarketDirectory markets={markets} memeDiscovery={memeDiscovery} />
    </div>
  );
}
