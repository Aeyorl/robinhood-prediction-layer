"use client";

import { useState } from "react";
import { branding } from "@pl/config";

interface ContractAddressBarProps {
  variant?: "top" | "bar" | "card";
  className?: string;
}

export function ContractAddressBar({ variant = "bar", className = "" }: ContractAddressBarProps) {
  const [copied, setCopied] = useState(false);
  const address =
    process.env.NEXT_PUBLIC_POKU_CONTRACT_ADDRESS ||
    branding.publicContractAddress ||
    "0x99f207cb270191ecf700c16b5c6fe116e007e0b8";

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const explorerUrl = `https://robinhoodchain.blockscout.com/address/${address}`;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  if (variant === "top") {
    return (
      <aside className={`contract-top-banner ${className}`} aria-label="Official Poku contract address">
        <div className="contract-top-inner">
          <div className="contract-top-left">
            <span className="contract-pulse-dot" aria-hidden="true" />
            <span className="contract-top-label">CA</span>
            <code className="contract-top-code" title={address}>
              <span className="ca-full">{address}</span>
              <span className="ca-short">{shortAddress}</span>
            </code>
          </div>
          <div className="contract-top-actions">
            <button
              type="button"
              onClick={copyAddress}
              className="contract-copy-btn"
              aria-label="Copy Poku contract address"
            >
              {copied ? (
                <>
                  <span className="check-icon">✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy CA</span>
                </>
              )}
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="contract-explorer-link"
              aria-label="View Poku contract on Blockscout"
            >
              Explorer ↗
            </a>
          </div>
        </div>
      </aside>
    );
  }

  if (variant === "card") {
    return (
      <div className={`contract-card-section ${className}`} aria-label="Official Poku contract">
        <div className="contract-card-header">
          <div className="contract-card-badge-row">
            <span className="contract-pulse-dot" aria-hidden="true" />
            <span className="contract-card-tag">OFFICIAL CONTRACT</span>
            <span className="contract-card-network">Robinhood Chain</span>
          </div>
          <span className="contract-card-sub">Verified protocol deployment</span>
        </div>
        <div className="contract-card-body">
          <code className="contract-card-address" title={address}>
            <span className="ca-full">{address}</span>
            <span className="ca-short">{shortAddress}</span>
          </code>
          <div className="contract-card-actions">
            <button
              type="button"
              onClick={copyAddress}
              className="contract-card-btn-copy"
              aria-label="Copy Poku contract address"
            >
              {copied ? "Copied! ✓" : "Copy Address"}
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="contract-card-btn-link"
              aria-label="View contract on Blockscout Explorer"
            >
              View on Explorer ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={`contract-address-bar ${className}`} aria-label="Poku contract address">
      <span className="contract-address-label">CA</span>
      <code title={address}>
        <span className="ca-full">{address}</span>
        <span className="ca-short">{shortAddress}</span>
      </code>
      <button type="button" onClick={copyAddress} aria-label="Copy Poku contract address">
        {copied ? "Copied! ✓" : "Copy"}
      </button>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noreferrer"
      >
        Explorer ↗
      </a>
    </section>
  );
}

