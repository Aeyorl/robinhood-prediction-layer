import { PagePlaceholder } from "@/components/page-placeholder";

export default async function ProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return (
    <PagePlaceholder
      title={`Profile ${address.slice(0, 6)}…${address.slice(-4)}`}
      description="Wallet history across markets, per-community splits, and performance stats."
      milestone="Phase 6"
    />
  );
}
