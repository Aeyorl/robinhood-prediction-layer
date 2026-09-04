# 07 — Testing and Acceptance Criteria

## 1. Testing philosophy

A feature is not complete because a page renders. A working product must prove:

- wallet connectivity,
- real chain reads,
- real approvals,
- deterministic swap quoting,
- transaction confirmation,
- correct contract accounting,
- oracle-based resolution,
- claim/refund correctness,
- indexer consistency.

## 2. Test layers

### 2.1 Type/lint

- TypeScript strict mode passes.
- ESLint passes.
- Solidity formatting/lint rules pass.

### 2.2 Frontend unit

Test:

- amount parsing,
- decimal formatting,
- token-selection state,
- quote expiry,
- price-impact warning thresholds,
- projected payout math,
- status rendering,
- wrong-network logic.

### 2.3 API unit/integration

Test:

- schema validation,
- address normalization,
- quote request validation,
- router allowlist validation,
- database pagination,
- auth nonce replay prevention,
- stats calculations,
- community split aggregation.

### 2.4 Contract unit/fuzz/invariant

See Smart Contract Specification.

### 2.5 Indexer tests

Use synthetic logs to test:

- duplicate log handling,
- out-of-order receipt processing,
- restart/backfill,
- reorg rewind,
- projection rebuild,
- claim/trade aggregation.

### 2.6 E2E local

Run Anvil with mock contracts.

Automate through Playwright with a deterministic test wallet if tooling supports it.

Flow:

1. open app,
2. connect wallet,
3. discover MockPONS,
4. choose market,
5. quote MockPONS → MockUSDG,
6. swap,
7. enter YES,
8. advance time,
9. update mock oracle,
10. resolve,
11. claim,
12. verify portfolio and DB projection.

## 3. Mainnet-fork integration suite

Fork Robinhood Chain mainnet from a managed RPC.

Verify:

- chain ID/config,
- canonical USDG bytecode and decimals,
- live configured Stock Token feed read,
- oracle decimals/staleness checks,
- Uniswap route to USDG for at least one liquid ERC-20,
- transaction calldata simulation,
- no accidental mainnet broadcast.

Meme tokens should be tested by address, not symbol.

## 4. Wallet acceptance criteria

- [ ] Connect supported injected wallet.
- [ ] Correctly detects wrong chain.
- [ ] Adds/switches to Robinhood Chain.
- [ ] Reads connected address.
- [ ] Reads ERC-20 balances.
- [ ] Does not show stale balances after account change.
- [ ] Handles wallet disconnect.
- [ ] Handles rejected signature/transaction.

## 5. Funding-token acceptance criteria

- [ ] USDG can enter directly.
- [ ] A supported non-USDG token receives a live quote.
- [ ] No-route token shows reason.
- [ ] High-impact token is blocked or requires policy-compliant explicit handling.
- [ ] Same-symbol different-address token does not inherit verification.
- [ ] Quote expires and refreshes.
- [ ] Minimum output is shown.
- [ ] Input balance is checked immediately before submit.

## 6. Market acceptance criteria

- [ ] Market has exact structured terms.
- [ ] Entry impossible before open.
- [ ] Entry impossible at/after lock.
- [ ] YES and NO pools update from confirmed events.
- [ ] Projected payout updates correctly.
- [ ] Market cannot resolve early.
- [ ] Market resolves once.
- [ ] Oracle invalidity does not silently resolve with stale price.
- [ ] Cancellation path returns principal.

## 7. Claim acceptance criteria

- [ ] Losing user cannot claim payout.
- [ ] Winner receives correct gross.
- [ ] Fee is charged only on profit if enabled.
- [ ] Double claim impossible.
- [ ] UI reflects claim after confirmation.
- [ ] Indexer records claim idempotently.

## 8. Community analytics acceptance criteria

- [ ] Source funding token is address-based.
- [ ] Normalized volume uses actual collateral amount.
- [ ] Onchain vs session-correlated source attribution is distinguishable.
- [ ] YES/NO split recomputes from confirmed trades.
- [ ] Resolved hit-rate definition is documented.
- [ ] No claim about “all holders” is made from participant subset data.

## 9. Admin acceptance criteria

- [ ] Only authorized admin wallet can create through UI.
- [ ] Factory role also enforces permission onchain.
- [ ] Admin sees exact contract params before signing.
- [ ] Invalid timing rejected client-side and contract-side.
- [ ] Fee over cap rejected contract-side.
- [ ] Oracle config shown before create.
- [ ] Existing market terms cannot be modified after creation.

## 10. Security gates

Before testnet public demo:

- [ ] no private keys committed,
- [ ] all secrets server-side,
- [ ] contract fuzz/invariant suite passes,
- [ ] static analysis reviewed,
- [ ] app prevents accidental mainnet mode.

Before mainnet beta:

- [ ] external smart contract review/audit,
- [ ] legal/compliance review,
- [ ] multisig roles configured,
- [ ] production RPC configured,
- [ ] monitoring/alerts configured,
- [ ] incident runbook complete,
- [ ] deployment addresses verified,
- [ ] brand rules reviewed.

## 11. Definition of “working”

Codex must not mark the project complete unless this exact vertical slice works:

**Wallet → non-USDG token → executable swap → USDG → onchain market entry → oracle resolution → onchain claim → portfolio/indexer update.**

A mocked visual flow is not equivalent to this acceptance criterion.
