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
          <main className="mx-auto w-full max-w-7xl px-4 pb-32 pt-8 sm:px-6 md:pb-24 md:pt-10">
            {children}
          </main>
          <footer className="border-t border-white/[0.07] px-4 py-10 text-xs text-slate-500">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p>
                {branding.appName} on {branding.chainName}. Not affiliated with or endorsed by
                Robinhood.
              </p>
              <nav aria-label="Legal and documentation" className="flex flex-wrap gap-4">
                <Link href="/docs" className="hover:text-slate-300">
                  Docs
                </Link>
                <Link href="/risks" className="hover:text-slate-300">
                  Risks
                </Link>
                <Link href="/terms" className="hover:text-slate-300">
                  Terms
                </Link>
              </nav>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
