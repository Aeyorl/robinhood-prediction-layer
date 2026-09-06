import { CommunitySignalMap } from "@/components/community-signal-map";
import { getCommunities } from "@/lib/analytics-api";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  let data: Awaited<ReturnType<typeof getCommunities>> | null = null;
  try {
    data = await getCommunities("7d");
  } catch {}
  return (
    <div className="light-route community-route">
      <header className="community-page-heading">
        <span className="section-kicker">Verified funding attribution · 7 days</span>
        <h1 className="block-heading">
          Community
          <br />
          signal map
        </h1>
        <p>Activity grouped by the token participants used to fund a position.</p>
      </header>
      {!data ? (
        <div className="community-empty">
          <h2>Community analytics are unavailable</h2>
          <p>The directory will return when the indexer API is healthy.</p>
        </div>
      ) : (
        <CommunitySignalMap communities={data.communities} />
      )}
    </div>
  );
}
