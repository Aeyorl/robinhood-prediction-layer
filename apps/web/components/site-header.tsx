"use client";

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
      <header className="site-header"><div className="site-header-inner">
        <Link href="/" className="wordmark" aria-label="Prediction Layer home"><strong>Prediction Layer</strong></Link>
        <nav aria-label="Primary navigation" className="desktop-nav">{navLinks.map((link) => <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "active" : ""}>{link.label}</Link>)}</nav>
        <form action="/markets" method="get" className="header-search"><span className="search-ring" aria-hidden="true" /><label className="sr-only" htmlFor="global-market-search">Search markets</label><input id="global-market-search" name="q" type="search" placeholder="Search markets, topics, or tokens" /><kbd>/</kbd></form>
        <ConnectWallet />
      </div></header>
      <nav aria-label="Mobile navigation" className="mobile-nav">{navLinks.map((link) => <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "active" : ""}>{link.label}</Link>)}</nav>
    </>
  );
}
