import { Card, Section, StatusBadge } from "@pl/ui";
import { AnalyticsUnavailable, CommunityCard } from "@/components/analytics";
import { getCommunities } from "@/lib/analytics-api";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  let data: Awaited<ReturnType<typeof getCommunities>> | null = null;
  try {
    data = await getCommunities("7d");
  } catch {}
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <StatusBadge tone="indigo">Verified funding attribution · 7 days</StatusBadge>
        <h1 className="text-3xl font-bold text-white">Communities</h1>
        <p className="max-w-3xl text-slate-400">
          Activity grouped by the token participants used to fund a position. These views describe
          participating wallets only; they do not represent every token holder.
        </p>
      </header>
      <Section eyebrow="Source-token activity" title="Community directory">
        {!data ? (
          <AnalyticsUnavailable />
        ) : data.communities.length === 0 ? (
          <Card className="text-sm text-slate-400">
            No verified source-token entries were indexed in the last 7 days.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.communities.map((community) => (
              <CommunityCard
                key={`${community.chainId}:${community.tokenAddress}`}
                community={community}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
