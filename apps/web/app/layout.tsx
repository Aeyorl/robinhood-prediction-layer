import type { Metadata } from "next";
import Link from "next/link";

import { branding } from "@pl/config";

import { SiteHeader } from "@/components/site-header";
import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: branding.appName,
    template: `%s — ${branding.appName}`,
  },
  description: `Wallet-native binary prediction markets on ${branding.chainName}. Fund positions with tokens you already hold.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-[1600px] px-4 pb-32 pt-5 sm:px-7 md:pb-24 md:pt-7">
            {children}
          </main>
          <footer className="site-footer">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p><span className="footer-mark" aria-hidden="true">PL</span> Built on {branding.chainName}</p>
              <nav aria-label="Legal and documentation" className="flex flex-wrap gap-4">
                <Link href="/docs" className="hover:text-slate-300">
                  User guide
                </Link>
                <Link href="/risks" className="hover:text-slate-300">
                  Risks
                </Link>
                <Link href="/terms" className="hover:text-slate-300">
                  Terms
                </Link>
              </nav>
              <p className="footer-disclaimer">Independent product. Not affiliated with or endorsed by Robinhood.</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
