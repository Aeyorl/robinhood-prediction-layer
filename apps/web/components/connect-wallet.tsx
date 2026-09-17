"use client";

import { Button } from "@pl/ui";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button
        size="sm"
        className="wallet-connect-button"
        onClick={() => disconnect()}
        title="Disconnect wallet"
      >
        {`${address.slice(0, 6)}…${address.slice(-4)}`}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className="wallet-connect-button"
      disabled={isPending || connectors.length === 0}
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </Button>
  );
}
