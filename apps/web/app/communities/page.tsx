import { CommunitySignalMap } from "@/components/community-signal-map";
import { getCommunities } from "@/lib/analytics-api";
import { demoCommunities } from "@/lib/demo-analytics";

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
      {!data || data.communities.length === 0 ? (
        <div className="demo-banner">Demonstration activity · live indexer data is unavailable</div>
      ) : null}
      <CommunitySignalMap
        communities={data?.communities.length ? data.communities : demoCommunities}
      />
    </div>
  );
}
