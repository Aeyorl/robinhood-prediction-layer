import { WalletAssetsCard } from "@/components/wallet-assets-card";

export default function AssetsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
          Funding routes
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Wallet assets</h1>
        <p className="max-w-2xl text-slate-400">
          See which assets can currently route into USDG collateral before you choose a market.
        </p>
      </header>
      <WalletAssetsCard showAllLink={false} />
    </div>
  );
}
