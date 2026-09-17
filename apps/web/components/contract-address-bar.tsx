"use client";

import { branding } from "@pl/config";
import { useState } from "react";

export function ContractAddressBar() {
  const [copied, setCopied] = useState(false);
  const address = branding.publicContractAddress;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="contract-address-bar" aria-label="Poku contract address">
      <span className="contract-address-label">CA</span>
      <code title={address}>{address}</code>
      <button type="button" onClick={copyAddress} aria-label="Copy Poku contract address">
        {copied ? "Copied" : "Copy"}
      </button>
      <a
        href={`https://robinhoodchain.blockscout.com/address/${address}`}
        target="_blank"
        rel="noreferrer"
      >
        Explorer ↗
      </a>
    </section>
  );
}
