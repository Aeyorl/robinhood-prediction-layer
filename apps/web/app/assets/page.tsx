import { WalletAssetsCard } from "@/components/wallet-assets-card";

export default function AssetsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-semibold">Wallet assets</h1>
      <WalletAssetsCard />
    </main>
  );
}
