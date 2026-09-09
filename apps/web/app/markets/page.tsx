import { SampleMarketDirectory } from "@/components/sample-market-directory";
import { sampleMarkets } from "@/lib/sample-markets";

export default function MarketsPage() {
  return (
    <div className="read-only-route">
      <SampleMarketDirectory markets={sampleMarkets} />
    </div>
  );
}
