import { encodeAbiParameters, keccak256, type Address } from "viem";

/** Matches BinaryPoolMarket.FEE_DENOMINATOR. */
export const FEE_DENOMINATOR = 10_000n;
/** Matches BinaryPoolMarket.FEE_CAP_BPS (10%). */
export const FEE_CAP_BPS = 1_000n;

export interface PayoutParts {
  /** stake * (winningPool + losingPool) / winningPool (floor) */
  gross: bigint;
  /** gross - stake */
  profit: bigint;
  /** profit * feeBps / 10000 (floor) — charged on profit only */
  fee: bigint;
  /** gross - fee */
  net: bigint;
}

/**
 * Parimutuel payout for one staker. Mirrors `BinaryPoolMarket.previewPayout`
 * exactly (same floor rounding), so UI previews never diverge from onchain
 * payouts.
 */
export function computePayout(
  stake: bigint,
  winningPool: bigint,
  losingPool: bigint,
  feeBps: bigint,
): PayoutParts {
  if (stake < 0n) throw new Error("stake must be non-negative");
  if (winningPool <= 0n) throw new Error("winning pool must be positive");
  const gross = (stake * (winningPool + losingPool)) / winningPool;
  const profit = gross - stake;
  const fee = (profit * feeBps) / FEE_DENOMINATOR;
  return { gross, profit, fee, net: gross - fee };
}

/**
 * Canonical oracle asset key used onchain:
 * keccak256(abi.encode(uint256 chainId, address token)).
 * Token identity is always (chainId, contractAddress) — never just a symbol.
 */
export function oracleAssetKey(chainId: number, tokenAddress: Address): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }],
      [BigInt(chainId), tokenAddress],
    ),
  );
}

/** Format a raw collateral amount with the given decimals (viem). */
export { formatUnits as formatCollateral } from "viem";
