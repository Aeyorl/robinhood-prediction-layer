import { PagePlaceholder } from "@/components/page-placeholder";

export default async function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PagePlaceholder
      title={`Market: ${slug}`}
      description="Question, status, countdown, YES/NO capital split, resolution terms, trade panel, oracle health, and activity — wired to indexed data in the market milestones."
      milestone="Phase 2/3"
    />
  );
}
