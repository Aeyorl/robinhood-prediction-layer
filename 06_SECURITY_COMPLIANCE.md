# 06 — Security, Risk, Compliance, and Brand Requirements

## 1. Security posture

This product combines:

- user wallet approvals,
- DEX swaps,
- prediction collateral,
- oracle settlement,
- claimable funds.

A UI bug can become a financial loss. Treat security as a product requirement, not a pre-launch cleanup task.

## 2. Non-custodial boundary

The backend must not custody user keys or sign user trades.

Never request:

- private key,
- seed phrase,
- wallet backup,
- raw signing key export.

Market contracts may hold pooled collateral as required by the protocol, but operators should not have arbitrary withdrawal access to participant principal.

## 3. Smart-contract threat model

### Reentrancy

Use checks-effects-interactions, `ReentrancyGuard`, and SafeERC20.

### Integer/decimal mistakes

Prediction thresholds and oracle prices can use different decimals. Normalize explicitly with checked math. Test all supported decimal combinations.

### Oracle manipulation/staleness

- use approved Chainlink feeds,
- validate answer,
- validate timestamp/heartbeat,
- check L2 sequencer uptime,
- respect Stock Token oracle pause state,
- define cancellation timeout.

### Resolution timing manipulation

Do not allow an operator to choose an arbitrary favorable price long after the stated resolution time. Narrow the allowed observation window or move to signed Data Streams reports.

### Admin abuse

Admin cannot:

- rewrite winning outcome,
- change strike after opening,
- change resolution time after opening,
- redirect user principal,
- increase fee for an existing market.

Critical market terms should be immutable once created.

### Approval risk

Prefer limited approvals/Permit2 patterns over unlimited approvals when practical. Clearly show spender.

### Arbitrary-call risk

A custom entry router must not execute arbitrary client-provided targets/calldata. Router and output asset must be constrained.

## 4. DEX/token risk

Meme tokens can be adversarial.

Protect against:

- honeypot tokens,
- transfer-tax tokens,
- rebasing tokens,
- blacklisting,
- malicious metadata,
- fake ticker collisions,
- extreme slippage,
- spoofed token logos,
- tokens with no exit liquidity.

The app should distinguish:

- wallet ownership,
- verified identity,
- route availability,
- protocol support.

These are not the same thing.

## 5. Frontend transaction security

Before wallet signature, display:

- active chain,
- contract/router target,
- source token,
- output collateral,
- amount,
- minimum output,
- side,
- market,
- deadline.

Never silently switch the selected token or market after a quote.

Bind quote state to:

- wallet,
- chain,
- market,
- outcome,
- amount,
- token,
- expiry.

If any changes, invalidate quote and re-request.

## 6. Indexer/database security

- idempotent event processing,
- reorg handling,
- parameterized SQL/ORM,
- no client-trusted PnL calculations,
- wallet addresses normalized consistently,
- API pagination caps,
- rate limiting,
- admin audit log.

## 7. Secrets

Never expose:

- deployer private key,
- Uniswap API key if server-restricted,
- Chainlink Data Streams credentials,
- database credentials,
- admin session secret,
- provider secret keys.

Use environment secret storage.

## 8. Dependency security

CI should run:

- lockfile integrity,
- dependency audit,
- Solidity static analysis,
- TypeScript lint/typecheck,
- tests.

Do not auto-upgrade contract dependencies in production branches without review.

## 9. Mainnet governance

Recommended:

- multisig owner,
- separate pauser role,
- market creator role,
- optional timelock for registry/fee config,
- hardware-backed signer policy.

Single developer hot key is acceptable only for disposable testnet deployments.

## 10. Legal/regulatory workstream

A real-money prediction market can implicate gambling, derivatives, event-contract, securities, consumer-protection, AML/KYC, sanctions, and jurisdiction-specific rules.

This specification does not determine legal classification.

Before public real-value mainnet access:

1. obtain counsel for target jurisdictions,
2. define restricted geographies,
3. determine KYC/AML requirements,
4. determine sanctions/wallet-screening requirements,
5. define eligible market categories,
6. define whether Stock Token-linked prediction contracts are permitted,
7. publish terms/risk disclosures/privacy policy,
8. implement required controls.

Do not build functionality whose purpose is to bypass KYC, geofencing, or legal restrictions.

## 11. Compliance architecture hooks

Build interfaces even if disabled on testnet:

```ts
interface EligibilityDecision {
  allowed: boolean;
  reasonCode?: string;
  policyVersion: string;
}
```

Potential checks:

- region eligibility,
- wallet sanctions/risk screen,
- terms version accepted,
- age/identity if legally required,
- market-category eligibility.

The application should fail closed for required production controls.

## 12. Stock Token restrictions

Robinhood’s Stock Token documentation contains jurisdictional restrictions and describes Stock Tokens as tokenised debt securities providing economic exposure to underlying securities rather than legal ownership of the underlying shares.

The product must not present Stock Tokens as ordinary shares.

External copy and eligibility rules must be reviewed against the current official Stock Token terms before launch.

## 13. Oracle/corporate-action risk disclosure

For Stock Token markets:

- feed value can include multiplier effects,
- feed may pause around corporate actions,
- feed cadence follows its configured availability/heartbeat,
- weekend/market-closed periods require careful scheduling.

Market terms must say what value is actually compared.

## 14. Brand rules

Current Robinhood Chain brand guidelines require, among other things:

- refer to the network as “Robinhood Chain” in full,
- do not use “Hood Chain” as shorthand,
- do not substitute the Robinhood master logo for the Robinhood Chain logo,
- do not imply endorsement/sponsorship,
- use approved Robinhood Chain brand assets exactly as permitted,
- externally call the assets “Stock Tokens” rather than casual alternatives that conflict with current guidance.

Before launch, re-check the latest brand guidelines.

## 15. Risk disclosures in UI

At minimum provide:

- token swap risk,
- slippage/price impact,
- meme-token volatility,
- prediction loss risk,
- smart-contract risk,
- oracle risk,
- network risk,
- irreversibility of confirmed blockchain transactions.

Do not bury all meaningful risk only in terms-of-service text.

## 16. Incident controls

Have runbooks for:

- RPC outage,
- oracle outage,
- DEX routing outage,
- contract exploit suspicion,
- incorrect market metadata,
- indexer lag,
- compromised admin wallet,
- database corruption.

Emergency pause should stop new entries while preserving claims/refunds when safe.

## 17. Audit release gate

Before meaningful mainnet TVL:

- internal review,
- static analysis,
- fuzz/invariant tests,
- external contract audit,
- remediation verification,
- bug bounty when appropriate,
- multisig migration,
- final deployment address verification.
