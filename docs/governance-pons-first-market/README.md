# First PONS market release

This package configures PONS in `SafeClosingPriceResolver` and creates the first
USDG market in one atomic MAG7 timelock batch. The schedule and execution files
are Safe Transaction Builder payloads. They contain no private keys and the
generator never broadcasts.

## Fixed market terms

- Question: Will PONS be above $0.65 at 20:00 UTC on September 23, 2026?
- Comparator: price above at the resolution time
- Collateral: canonical Robinhood Chain USDG
- Entry window: September 20, 2026 00:00 UTC through September 23, 2026 20:00 UTC
- Entry minimum: 1 USDG
- Entry maximum: unlimited per user per side
- Fee: 1% of winner profit only
- Resolution: evidence-backed PONS/USD price observation, six decimals
- Challenge period: one hour
- Oracle grace period: four days

## Sequence

1. Run `node scripts/prepare-pons-first-market.mjs` and review `verification.json`.
2. Import `schedule.json` into the Safe Transaction Builder and execute it with
   the Safe threshold.
3. Wait until the onchain operation timestamp is ready.
4. Regenerate the package to confirm unchanged state, then import and execute
   `execute-after-delay.json`.
5. Verify the `MarketCreated` event, API indexing, wallet entry, and a small
   canary entry before publishing the market broadly.

DexScreener is a discovery and evidence input. The governed resolver publishes
the canonical evidence hash used for settlement; discovery data alone cannot
resolve the market.
