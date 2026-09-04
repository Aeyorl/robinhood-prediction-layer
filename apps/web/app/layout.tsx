import type { Metadata } from "next";

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
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8">{children}</main>
          <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
            <p>
              {branding.appName} on {branding.chainName}. Not affiliated with or endorsed by
              Robinhood.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
