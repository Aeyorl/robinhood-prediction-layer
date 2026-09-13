"use client";

import { branding } from "@pl/config";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConnectWallet } from "@/components/connect-wallet";

const navLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/communities", label: "Communities" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/portfolio", label: "Portfolio" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="wordmark" aria-label={`${branding.appName} home`}>
            <Image
              src="/brand/poku/poku-wordmark-color.png"
              alt={branding.appName}
              width={720}
              height={208}
              priority
            />
          </Link>
          <nav aria-label="Primary navigation" className="desktop-nav">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname.startsWith(link.href) ? "active" : ""}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action="/markets" method="get" className="header-search">
            <span className="search-ring" aria-hidden="true" />
            <label className="sr-only" htmlFor="global-market-search">
              Search markets
            </label>
            <input
              id="global-market-search"
              name="q"
              type="search"
              placeholder="Search markets, topics, or tokens"
            />
            <kbd>/</kbd>
          </form>
          <ConnectWallet />
        </div>
      </header>
      <nav aria-label="Mobile navigation" className="mobile-nav">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={pathname.startsWith(link.href) ? "active" : ""}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
