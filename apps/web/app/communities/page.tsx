import { CommunitySignalMap } from "@/components/community-signal-map";
import { getCommunities } from "@/lib/analytics-api";
import { demoCommunityWindows } from "@/lib/demo-analytics";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const [sevenDayResult, thirtyDayResult, allTimeResult] = await Promise.allSettled([
    getCommunities("7d"),
    getCommunities("30d"),
    getCommunities("all"),
  ]);
  const sevenDay = sevenDayResult.status === "fulfilled" ? sevenDayResult.value : null;
  const thirtyDay = thirtyDayResult.status === "fulfilled" ? thirtyDayResult.value : null;
  const allTime = allTimeResult.status === "fulfilled" ? allTimeResult.value : null;
  const communitiesByWindow = {
    "7 days": sevenDay?.communities.length ? sevenDay.communities : demoCommunityWindows["7 days"],
    "30 days": thirtyDay?.communities.length
      ? thirtyDay.communities
      : demoCommunityWindows["30 days"],
    "All time": allTime?.communities.length
      ? allTime.communities
      : demoCommunityWindows["All time"],
  };
  const isDemo = !sevenDay?.communities.length;
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
      {isDemo ? (
        <div className="demo-banner">Demonstration activity · live indexer data is unavailable</div>
      ) : null}
      <CommunitySignalMap communitiesByWindow={communitiesByWindow} />
    </div>
  );
}
