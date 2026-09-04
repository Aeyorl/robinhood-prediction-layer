"use client";

import { useEffect, useState } from "react";

import { robinhoodMainnet, robinhoodTestnet } from "@pl/chain-config";
import { Button, StatusBadge } from "@pl/ui";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";

const chainNames: Record<number, string> = {
  [robinhoodMainnet.id]: robinhoodMainnet.name,
  [robinhoodTestnet.id]: robinhoodTestnet.name,
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * wagmi hooks must never run during server prerender (no WagmiProvider
 * context there), so the real UI only renders after hydration.
 */
export function ConnectWallet() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return (
      <Button size="sm" disabled>
        Connect wallet
      </Button>
    );
  return <ConnectWalletInner />;
}

function ConnectWalletInner() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const supported = chainId === robinhoodMainnet.id || chainId === robinhoodTestnet.id;

  if (!isConnected) {
    const injected = connectors.find((c) => c.id === "injected");
    return (
      <Button
        size="sm"
        onClick={() => (injected ? connect({ connector: injected }) : undefined)}
        disabled={!injected || isConnecting}
        title={injected ? undefined : "No browser wallet detected"}
      >
        {isConnecting ? "Connecting…" : injected ? "Connect wallet" : "No wallet found"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!supported ? (
        <>
          <StatusBadge tone="amber">Wrong network</StatusBadge>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => switchChain({ chainId: robinhoodTestnet.id })}
          >
            {isSwitching ? "Switching…" : `Switch to ${chainNames[robinhoodTestnet.id]}`}
          </Button>
        </>
      ) : (
        <StatusBadge tone={chainId === robinhoodMainnet.id ? "indigo" : "slate"}>
          {chainNames[chainId]}
        </StatusBadge>
      )}
      <Button size="sm" variant="secondary" onClick={() => disconnect()}>
        {address ? shortAddress(address) : "Disconnect"}
      </Button>
    </div>
  );
}
