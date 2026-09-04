/**
 * Maps onchain revert reasons and wagmi/viem errors to explicit, actionable
 * UI messages. Known states never fall through to a generic "something went
 * wrong".
 */

export interface MappedTxError {
  message: string;
  tone: "error" | "warn";
}

const REVERTS: Record<string, MappedTxError> = {
  TimestampViolation: {
    tone: "error",
    message: "Entry is closed — markets only accept entries between open and lock time.",
  },
  NotOpen: { tone: "error", message: "This market is no longer open for entry." },
  NotLocked: { tone: "error", message: "The market must be locked before it can resolve." },
  NotResolved: { tone: "error", message: "This market has not resolved yet." },
  NotCancelled: { tone: "error", message: "This market was not cancelled." },
  AlreadyResolved: { tone: "error", message: "The market has already resolved." },
  AlreadyCancelled: { tone: "error", message: "The market was already cancelled." },
  AlreadyClaimed: { tone: "warn", message: "You have already claimed or refunded on this market." },
  NothingToClaim: {
    tone: "warn",
    message: "There is nothing to claim for your wallet on this market.",
  },
  BelowMinEntry: { tone: "error", message: "Amount is below the market's minimum entry." },
  AboveMaxEntry: {
    tone: "error",
    message: "Amount exceeds your remaining entry limit for this side.",
  },
  InvalidSide: { tone: "error", message: "Invalid side selected." },
  TooEarly: { tone: "warn", message: "Too early — the required time has not been reached yet." },
  // Oracle resolver failures
  "sequencer down": {
    tone: "error",
    message: "Oracle unavailable: the L2 sequencer uptime feed reports downtime.",
  },
  "sequencer grace not elapsed": {
    tone: "error",
    message: "Oracle unavailable: the sequencer just recovered; its grace period has not elapsed.",
  },
  "oracle paused": {
    tone: "error",
    message: "Oracle paused — the asset feed is halted (e.g. a corporate action).",
  },
  "invalid answer": { tone: "error", message: "Oracle returned an invalid (non-positive) price." },
  "no update": { tone: "error", message: "Oracle feed has no recent update for this asset." },
  "stale feed": {
    tone: "error",
    message: "Oracle feed is stale. In local mode, refresh the mock feed price before resolving.",
  },
  "asset not configured": {
    tone: "error",
    message: "Oracle asset is not configured in the registry.",
  },
  // ERC-20
  "ERC20: transfer amount exceeds balance": {
    tone: "error",
    message: "Insufficient balance — mint or acquire more USDG first.",
  },
  "ERC20: insufficient allowance": {
    tone: "error",
    message: "USDG approval is required before entering.",
  },
};

/** Decode an unknown error thrown by wagmi/viem into a friendly message. */
export function mapTxError(err: unknown): MappedTxError {
  if (!err) return { tone: "error", message: "Transaction failed." };
  const raw = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);

  // wagmi wraps revert reasons as `Execution reverted: <reason>` or a shortMessage.
  const short =
    typeof err === "object" && err !== null && "shortMessage" in err
      ? String((err as { shortMessage: unknown }).shortMessage)
      : "";
  const haystack = `${raw}\n${short}`;

  for (const [key, mapped] of Object.entries(REVERTS)) {
    if (haystack.includes(key)) return mapped;
  }

  if (haystack.toLowerCase().includes("user rejected") || haystack.includes("ACTION_REJECTED")) {
    return { tone: "warn", message: "Signature rejected in wallet — nothing was submitted." };
  }
  if (
    haystack.toLowerCase().includes("insufficient funds") ||
    haystack.toLowerCase().includes("intrinsic gas")
  ) {
    return { tone: "error", message: "Insufficient gas (ETH) to submit this transaction." };
  }
  if (haystack.toLowerCase().includes("already pending")) {
    return {
      tone: "warn",
      message: "A transaction is already pending — wait for it to confirm first.",
    };
  }
  if (haystack.toLowerCase().includes("network") || haystack.toLowerCase().includes("rpc")) {
    return {
      tone: "error",
      message: "RPC error — check that the local chain / RPC endpoint is running.",
    };
  }

  // Fall back to the raw reason if it looks like a revert, otherwise generic.
  if (/revert/i.test(haystack)) {
    return { tone: "error", message: "Transaction reverted onchain." };
  }
  return { tone: "error", message: "Transaction failed. See the error details in your wallet." };
}

/** Concise raw reason for logs/debug display. */
export function rawError(err: unknown): string {
  if (!err) return "";
  return typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
}
