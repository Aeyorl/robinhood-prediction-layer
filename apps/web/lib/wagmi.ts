import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { robinhoodMainnet, robinhoodTestnet } from "@pl/chain-config";

/**
 * Default chain comes from NEXT_PUBLIC_CHAIN_ID (4663 mainnet / 46630
 * testnet). Both chains are always available so users can switch.
 */
const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 46630);
export const defaultChainId =
  configuredChainId === 4663 ? robinhoodMainnet.id : robinhoodTestnet.id;

// Local mode (NEXT_PUBLIC_LOCAL_CHAIN=true) points the testnet chain id
// (46630) at anvil on 127.0.0.1:8545.
const isLocalChain = process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true";
const testnetRpc = isLocalChain
  ? "http://127.0.0.1:8545"
  : process.env.NEXT_PUBLIC_RPC_TESTNET || undefined;

export const wagmiConfig = createConfig({
  chains: [robinhoodMainnet, robinhoodTestnet],
  connectors: [injected()],
  transports: {
    [robinhoodMainnet.id]: http(process.env.NEXT_PUBLIC_RPC_MAINNET || undefined),
    [robinhoodTestnet.id]: http(testnetRpc),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
