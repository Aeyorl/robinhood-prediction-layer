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

export const wagmiConfig = createConfig({
  chains: [robinhoodMainnet, robinhoodTestnet],
  connectors: [injected()],
  transports: {
    [robinhoodMainnet.id]: http(process.env.NEXT_PUBLIC_RPC_MAINNET || undefined),
    [robinhoodTestnet.id]: http(process.env.NEXT_PUBLIC_RPC_TESTNET || undefined),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
