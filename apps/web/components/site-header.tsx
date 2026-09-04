import Link from "next/link";

import { branding } from "@pl/config";

import { ConnectWallet } from "@/components/connect-wallet";

const navLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/assets", label: "Wallet Assets" },
  { href: "/communities", label: "Communities" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-white">{branding.appName}</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-widest text-indigo-400 sm:inline">
              on {branding.chainName}
            </span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-slate-400 md:flex">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <ConnectWallet />
      </div>
    </header>
  );
}
