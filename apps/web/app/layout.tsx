import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { branding } from "@pl/config";

import { SiteHeader } from "@/components/site-header";
import { ContractAddressBar } from "@/components/contract-address-bar";
import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: branding.appName,
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
          <ContractAddressBar />
          <footer className="site-footer">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p>
                <Image
                  src="/icon.png"
                  alt=""
                  aria-hidden="true"
                  className="footer-mark"
                  width={512}
                  height={512}
                />
                Built on {branding.chainName}
              </p>
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
                <a
                  href="https://x.com/pokufun"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-social-link"
                  aria-label="Poku on X"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.681l7.73-8.835L1.255 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
                  </svg>
                  <span>@pokufun</span>
                </a>
              </nav>
              <p className="footer-disclaimer">
                Independent product. Not affiliated with or endorsed by Robinhood.
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
