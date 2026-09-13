import { ROBINHOOD_MAINNET_ID, ROBINHOOD_TESTNET_ID } from "./chains.js";

export interface ChainContractAddresses {
  /** Canonical collateral token. Null on testnet — deploy MockUSDG locally. */
  usdg: `0x${string}` | null;
  weth: `0x${string}` | null;
  uniswapUniversalRouter: `0x${string}` | null;
  chainlinkDataStreamsVerifier: `0x${string}` | null;
  /** Our own deployments — null until deployed on that chain. */
  protocolTimelock: `0x${string}` | null;
  marketFactory: `0x${string}` | null;
  oracleRegistry: `0x${string}` | null;
  chainlinkPriceResolver: `0x${string}` | null;
  dataStreamsRwaResolver: `0x${string}` | null;
  safeClosingPriceResolver: `0x${string}` | null;
  feeVault: `0x${string}` | null;
  predictionEntryRouter: `0x${string}` | null;
  /** Backfill start block for the indexer. */
  deploymentBlock: number;
}

/**
 * Addresses are config-driven. The values below come from the documentation
 * pack and MUST be re-verified against official sources before any mainnet
 * deployment (see docs/deployment.md).
 */
export const chainAddresses: Record<number, ChainContractAddresses> = {
  [ROBINHOOD_MAINNET_ID]: {
    usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    // Uniswap Universal Router 2.1.1 documented for chain 4663.
    uniswapUniversalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904",
    chainlinkDataStreamsVerifier: "0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7",
    protocolTimelock: "0x96aC6E8964bdDA7604520B868d60B49FfA9e6ad4",
    marketFactory: "0x62A301F2A0356a16fC1BB02991CfB9cFDb00152C",
    oracleRegistry: "0x0628a09AFF40FE8590026e498dA7a216C83C6c94",
    chainlinkPriceResolver: "0x49f460112E9D2b378D7AC9dEa9Bb368f2Dc5af9a",
    dataStreamsRwaResolver: "0x516bbeE20Ee4e0Fe440Ea6b9531581e6C0f558f8",
    safeClosingPriceResolver: "0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5",
    feeVault: "0x72792B5916dCbf5f0Ae8DB67B748fb5f5c37b89f",
    predictionEntryRouter: "0x02c12517564d727CdD2f16736F7486EF31352195",
    deploymentBlock: 62191277,
  },
  [ROBINHOOD_TESTNET_ID]: {
    // No official testnet USDG address exists — never invent one. Local
    // deployments use MockUSDG instead.
    usdg: null,
    weth: null,
    uniswapUniversalRouter: null,
    chainlinkDataStreamsVerifier: null,
    protocolTimelock: null,
    marketFactory: null,
    oracleRegistry: null,
    chainlinkPriceResolver: null,
    dataStreamsRwaResolver: null,
    safeClosingPriceResolver: null,
    feeVault: null,
    predictionEntryRouter: null,
    deploymentBlock: 0,
  },
};

export function getChainAddresses(chainId: number): ChainContractAddresses {
  const addresses = chainAddresses[chainId];
  if (!addresses) throw new Error(`Unsupported chain id ${chainId}`);
  return addresses;
}
