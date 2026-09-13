# Closing-price operations

Scheduled equity markets use `SafeClosingPriceResolver` when a paid Data Streams subscription is unavailable. The protocol timelock owns the resolver, while the existing Safe is the guardian that can cancel a disputed observation during its challenge period.

## Prepare an observation

1. Confirm the market's exact asset key, reference timestamp, decimals and regular-session close definition.
2. Record the same closing price from at least two independent public sources after the session is final.
3. Check Robinhood's corporate-action feed and record that the check completed.
4. Upload the final evidence document to immutable storage and add its `ipfs://` or permanent HTTPS URI to the input JSON.
5. Copy `scripts/fixtures/closing-price-evidence.example.json`, replace every example value, then run `pnpm oracle:evidence <input.json> <output-directory>`.
6. Have an independent operator compare the evidence JSON, Keccak hash, calldata, resolver address, chain ID 4663, asset key, timestamp and scaled price.
7. Submit the generated transaction through the Safe and timelock. Never submit it from an individual wallet.

The generator rejects mismatched source prices, fewer than two sources, missing corporate-action confirmation, invalid scaling and placeholder evidence destinations.

## Monitor and dispute

The worker emits `[oracle-observation] proposed` and `[oracle-observation] cancelled` log records. Production logging must page operators on cancellations and notify the review channel on every proposal. During the challenge period, compare the public evidence again. If it is wrong or incomplete, the Safe guardian calls `cancelObservation` before the challenge period expires.

If no observation is published, or it is cancelled, anyone may call the market's timeout cancellation after its grace period and participants can refund their original collateral. A valid pending observation counts as available so a timeout caller cannot bypass its challenge period.

## Release boundary

Run `pnpm oracle:rehearse` before a release and preserve the output with the release evidence. A successful internal rehearsal is not an independent audit, compliance approval, a Safe signature ceremony or authorization to broadcast to mainnet.
