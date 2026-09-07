# 01 — Product Specification

## 1. Product definition

`Wagerly` is a standalone wallet-native prediction application deployed on Robinhood Chain.

Users take positions on objective future outcomes. The first category is financial price-based markets that can be resolved from trusted onchain price data.

The product distinguishes between:

- **Outcome asset** — the asset/event being predicted, e.g. an NVDA Stock Token price threshold.
- **Funding asset** — the token the user spends to enter, e.g. PONS, DELTA, AI, CASHCAT, USDG, WETH.
- **Canonical collateral** — the normalized asset the market contract actually accounts in, initially USDG.

The market should never need a separate PONS pool, DELTA pool, CASHCAT pool, etc. All supported funding assets route into the same collateral layer.

## 2. Product promise

A user should be able to participate without manually reorganizing their wallet first.

Bad flow:

1. Leave app.
2. Find a DEX.
3. Sell meme token.
4. Buy USDG.
5. Return to app.
6. Approve USDG.
7. Enter market.

Target flow:

1. Connect wallet.
2. Choose prediction.
3. Choose YES/NO.
4. Choose a token already in the wallet.
5. App handles quote + conversion + market entry.

## 3. Product principles

### 3.1 Any supported token in; one collateral layer underneath

Do not fragment each market into many token-specific pools.

### 3.2 Wallet is the account

Users can browse without authentication. Wallet connection is required for trading. A signed-message session can optionally support offchain profile settings, notifications, watchlists, and admin authentication.

### 3.3 Objective markets first

The first version should use questions that can be resolved deterministically from a price oracle. Avoid subjective or legally ambiguous event resolution in v0.

### 3.4 Explainable resolution

Every market page must show:

- exact resolution rule,
- exact data source/oracle,
- resolution time,
- timezone,
- comparator (`>=`, `>`, `<`, etc.),
- cancellation conditions,
- oracle outage behavior.

### 3.5 No hidden swap behavior

If a meme coin is converted to USDG, the UI must display:

- source token,
- source amount,
- quoted USDG received,
- minimum USDG received,
- price impact,
- route/provider,
- slippage tolerance,
- protocol fee if any.

### 3.6 Contract address over ticker

A ticker is not identity. PONS or AI can be spoofed by another ERC-20 with the same symbol. Internally, every token is identified by `(chainId, contractAddress)`.

## 4. Primary personas

### 4.1 Meme holder

Has Robinhood Chain meme tokens and wants utility without manually selling before interacting with another application.

Primary need: “Use what I already hold.”

### 4.2 Market predictor

Has opinions on stocks, crypto, ETFs, or other financial outcomes.

Primary need: “Put capital behind my view.”

### 4.3 Community participant

Identifies with a meme token/community and wants to see how that community is positioned.

Primary need: “What do holders like me think?”

### 4.4 Competitive forecaster

Cares about accuracy, PnL, rank, streaks, and category-specific performance.

Primary need: “Prove I am good at predicting.”

### 4.5 Market operator/admin

Creates curated markets from safe templates, monitors oracle health, pauses problematic markets, and manages supported input tokens/configuration.

## 5. Core user journeys

### 5.1 Browse without wallet

1. Open homepage.
2. View trending/open/closing-soon markets.
3. Open market details.
4. See current pool distribution, rules, oracle, activity, and time remaining.
5. “Connect wallet” appears only when the user wants to enter.

### 5.2 Connect wallet

1. Click Connect.
2. Support Robinhood Wallet and standard EVM wallets through standard connectors.
3. Check chain.
4. If not on Robinhood Chain, request chain switch/add.
5. Fetch wallet balances.
6. Classify balances into supported, unsupported, dust, and unknown.
7. Show “Your assets” panel.

### 5.3 Enter with USDG

1. Select YES/NO.
2. Select USDG.
3. Enter amount.
4. Show current pool ratio and projected payout estimate.
5. Approve if allowance insufficient.
6. Call market entry transaction.
7. Wait for receipt.
8. Update position and portfolio from chain/indexer.

### 5.4 Enter with meme token

1. Select YES/NO.
2. Open “Pay with” token selector.
3. Show only assets with a currently viable route to collateral.
4. User selects PONS/DELTA/AI/CASHCAT/etc.
5. User enters source-token amount or USD-equivalent amount.
6. App requests a route to USDG.
7. Show quote + impact + minimum output + expiry.
8. Execute swap.
9. Enter normalized USDG into market.
10. Record original funding token in trade metadata.
11. Show success receipt containing both swap transaction and prediction transaction if separate.

Longer term, batch swap + entry using account abstraction or a tightly-scoped router.

### 5.5 Resolve and claim

1. Market reaches lock time.
2. New entries stop.
3. Resolver reads/verifies oracle data.
4. Market resolves YES, NO, or CANCELLED.
5. Winning users see “Claimable.”
6. User claims USDG.
7. Optional later feature: “Claim as…” routes claimed USDG to another supported token.

## 6. MVP market types

### 6.1 PRICE_ABOVE_AT_TIME

Example:

“Will NVDA Stock Token be at or above $200 at 16:00 UTC on 2026-09-18?”

YES if oracle value `>= 200` at the defined resolution observation.

### 6.2 PRICE_BELOW_AT_TIME

Example:

“Will AAPL Stock Token be below $230 at 16:00 UTC on 2026-09-18?”

YES if oracle value `< 230`.

### 6.3 DIRECTION

Later MVP+:

“Will NVDA Stock Token be higher at end time than start time?”

Store an oracle-observed starting value and compare to end value.

### 6.4 RELATIVE_PERFORMANCE

Later:

“Will NVDA outperform SPY between start and end?”

Compare normalized returns, not absolute price differences.

## 7. Markets intentionally deferred

Do not put these in the first onchain release:

- elections,
- subjective news events,
- celebrity outcomes,
- user-written free-form questions,
- markets requiring centralized editorial judgment,
- “first touch” barrier markets unless the oracle proof design is robust,
- sports markets,
- long-duration markets spanning uncertain corporate actions without explicit handling.

## 8. Binary pooled market mechanics — v0

### 8.1 Why pool mode first

A pooled mechanism is easier to secure than a CLOB or bespoke automated market maker and still proves all unique product mechanics.

### 8.2 Accounting

Every entry is normalized into USDG.

For a market:

- `yesPool`
- `noPool`
- `totalPool = yesPool + noPool`

Displayed capital ratio:

- `yesRatio = yesPool / totalPool`
- `noRatio = noPool / totalPool`

Call this “pool share” or “capital split” in v0 rather than claiming it is a precise market-implied probability.

### 8.3 Payout

If YES wins:

`grossPayout = userYesStake * totalPool / yesPool`

`profit = grossPayout - userYesStake`

`fee = profit * feeBps / 10_000`

`netPayout = grossPayout - fee`

Equivalent for NO.

### 8.4 Edge cases

- If the winning side has zero stake, cancel/refund the market rather than allowing treasury capture.
- If only one side has stake, winners recover principal; there is no losing pool to distribute.
- On cancellation, all users recover principal.
- Exact threshold equality is handled by the comparator explicitly encoded in market terms.
- Claims are pull-based.
- Fees are configurable and should default to zero on testnet.

## 9. Future trading mechanism

After v0 proves the full lifecycle, evaluate:

- conditional YES/NO tokens,
- fixed-product market maker,
- CLOB with signed orders and onchain settlement,
- early cash-out,
- cross-market portfolio netting.

Do not implement a custom continuous-pricing formula without formal review and invariant testing.

## 10. Supported funding-token policy

A token may appear in the wallet but still be unsupported.

A funding token is tradable only when all of the following are true:

1. It is an ERC-20 on the active Robinhood Chain network.
2. Metadata can be read safely or provided by a trusted registry.
3. The wallet has a positive balance above configured dust value.
4. A live route to USDG exists.
5. The route passes minimum-liquidity/maximum-impact limits.
6. The token does not trigger unsupported-token behavior tests.
7. The token is not blocked by protocol risk/compliance configuration.
8. The quote has not expired.

Potentially unsupported token behaviors:

- fee-on-transfer,
- rebasing,
- malicious `transfer` implementation,
- transfer restrictions,
- honeypot behavior,
- blacklists,
- nonstandard return values,
- extreme price impact,
- no route to USDG.

## 11. “Your assets” experience

After wallet connection, show a card/grid resembling a token launchpad wallet view:

- token logo,
- name,
- symbol,
- wallet balance,
- estimated USDG value,
- liquidity/routing status,
- “Use to predict” CTA.

Groups:

- Ready to use
- High price impact
- No route
- Hidden/dust/spam

Examples like PONS, DELTA, AI, CASHCAT are examples only; do not hardcode symbol-based trust.

## 12. Community layer

The community system is based on **source funding token**, not separate collateral pools.

For each supported meme token, compute:

- total normalized prediction volume,
- unique predicting wallets,
- active positions,
- YES/NO capital split by market,
- resolved-market hit rate,
- realized PnL,
- top predictors,
- most-traded markets,
- seven-day activity trend.

### 12.1 Example community insight

Market: “NVDA Stock Token >= $200?”

- All users: 63% YES
- PONS-funded entries: 72% YES
- DELTA-funded entries: 51% YES
- CASHCAT-funded entries: 78% YES

### 12.2 Important analytics rule

Do not say “PONS holders think X” unless the data actually represents identified wallets that funded positions with PONS. Use precise labels such as:

“Positions funded with PONS: 72% YES.”

This avoids overstating what the entire token-holder population believes.

## 13. Predictor profiles

Wallet-based profile metrics:

- total resolved markets participated in,
- net realized PnL,
- ROI,
- market hit rate,
- win/loss count,
- current streak,
- largest win,
- category performance,
- primary source funding tokens,
- volume.

Hit rate definition:

A resolved market counts once. Determine the wallet’s net stake by outcome at lock. If the wallet’s larger net side matches the winning outcome, count it as a hit. If equal, classify neutral and exclude from hit-rate denominator.

PnL and ROI should remain the primary financial metrics; hit rate alone can be gamed.

## 14. Discovery surfaces

Homepage sections:

- Trending
- Closing soon
- New markets
- Stock Tokens
- Crypto
- Community pulse
- Your wallet assets
- Top predictors

Market cards show:

- question,
- category,
- YES pool share,
- NO pool share,
- total volume,
- time remaining,
- underlying asset logo,
- resolution source badge.

## 15. Search and filtering

Filters:

- open/resolved/closing soon,
- category,
- underlying symbol,
- resolution horizon,
- volume,
- pool balance,
- community activity,
- market type.

## 16. Admin/curation model

MVP market creation is restricted to authorized operators.

Admin creates from a strict template:

- market type,
- asset/feed,
- question text generated from normalized fields,
- strike,
- comparator,
- open time,
- lock time,
- resolution time,
- maximum oracle delay,
- fee bps,
- minimum entry,
- optional maximum entry,
- category,
- tags.

The admin UI must generate and display the exact onchain parameters before transaction signing.

## 17. Sponsored/community markets — later

Future feature:

A token project can sponsor a market reward or discovery placement while the core prediction collateral remains normalized.

Possible model:

- sponsor deposits reward token,
- normal market resolves in USDG,
- eligible participants receive sponsor-token rewards under a separate reward contract,
- sponsorship never changes oracle resolution.

Keep sponsorship economically separate from the market’s truth condition.

## 18. Success metrics

MVP product metrics:

- wallet connect → first market entry conversion,
- percentage of entries funded with non-USDG assets,
- swap success rate,
- median swap price impact,
- market resolution success rate,
- claim completion rate,
- repeat predictors per week,
- number of supported wallet assets with executable routes,
- number of unique source-token communities represented.

Do not optimize for raw transaction count at the expense of safe routing or correct resolution.
