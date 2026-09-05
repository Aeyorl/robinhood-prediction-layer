import Link from "next/link";

import { branding } from "@pl/config";

import { ConnectWallet } from "@/components/connect-wallet";

const navLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/communities", label: "Communities" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/assets", label: "Assets" },
];

const mobileLinks = navLinks.slice(0, 4);

export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#050816]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-7">
            <Link
              href="/"
              className="flex min-w-0 items-baseline gap-2"
              aria-label="Prediction Layer home"
            >
              <span className="text-lg font-bold tracking-tight text-white">
                {branding.appName}
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300 lg:inline">
                on {branding.chainName}
              </span>
            </Link>
            <nav
              aria-label="Primary navigation"
              className="hidden items-center gap-5 text-sm text-slate-400 md:flex"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md py-2 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <ConnectWallet />
        </div>
      </header>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl md:hidden"
      >
        {mobileLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-11 items-center justify-center rounded-xl px-1 text-center text-[11px] font-semibold text-slate-400 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
