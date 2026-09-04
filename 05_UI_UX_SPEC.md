# 05 — UI/UX Specification

## 1. UX objective

The product should feel simpler than a DEX and more active than a sportsbook.

The user should understand three things instantly:

1. what is being predicted,
2. which side they are taking,
3. what asset they are using to fund the position.

Blockchain mechanics remain visible when relevant, but should not dominate the primary flow.

## 2. Navigation

Desktop:

```text
Logo | Markets | Communities | Leaderboard | Portfolio | Search | Connect Wallet
```

Connected state:

```text
Logo | Markets | Communities | Leaderboard | Portfolio | Search | Wallet chip
```

Wallet chip shows truncated address and network indicator.

## 3. Homepage

### Hero

Example copy direction:

**What happens next?**

“Take a position on market outcomes using the assets already in your wallet.”

Primary CTA: `Explore markets`

Secondary CTA when disconnected: `Connect wallet`

Avoid implying official Robinhood endorsement.

### Sections

1. Trending markets
2. Closing soon
3. Stock Token markets
4. Your wallet assets — only after connect
5. Community pulse
6. Top predictors
7. Recently resolved

## 4. Market card

Card fields:

- underlying logo,
- market question,
- resolution time,
- YES capital share,
- NO capital share,
- normalized volume,
- time remaining,
- category badge,
- “Chainlink resolved” badge when applicable.

Do not clutter cards with contract addresses; provide them on detail page.

## 5. Markets directory

Left/top filters:

- status,
- category,
- underlying,
- closing period,
- volume,
- market type.

Sort:

- trending,
- newest,
- closing soon,
- highest volume,
- most balanced,
- most community activity.

## 6. Market detail page

Desktop layout:

```text
---------------------------------------------------------
Question / asset / status / countdown
---------------------------------------------------------
Market history chart             | Trade panel
                                 |
                                 | YES / NO toggle
                                 | Pay with [token]
                                 | Amount
                                 | Quote summary
                                 | Enter position
---------------------------------------------------------
Market terms / resolution / oracle / activity / communities
---------------------------------------------------------
```

### Header

Show:

- full question,
- underlying asset,
- OPEN/LOCKED/RESOLVED badge,
- exact end/resolution time,
- current capital split,
- volume,
- participant count.

### Market chart

For v0, chart yes/no capital-share snapshots over time.

Label clearly as “YES pool share” rather than “probability” if using parimutuel pool mode.

### Trade panel

#### Outcome control

Large two-option selector:

`YES 63%` | `NO 37%`

Selected side visually emphasized.

#### Pay-with selector

Examples:

```text
Pay with
[PONS]  84,120 PONS   ≈ 122.48 USDG
```

Open token modal shows:

- logo,
- symbol,
- wallet balance,
- estimated USDG value,
- routing status.

Tabs:

- Ready
- All wallet assets

Unsupported assets remain visible with reason rather than disappearing silently.

Examples:

- “No USDG route found”
- “Price impact too high”
- “Token transfer behavior unsupported”

#### Amount input

User can enter:

- source token amount, or
- normalized USDG target amount when reverse quote is available.

Quick buttons:

25% / 50% / 75% / Max

Reserve gas asset if the selected token is native ETH/WETH-related and gas sponsorship is not active.

#### Quote summary

Before confirmation:

```text
You pay:              10,000 PONS
Estimated collateral: 42.18 USDG
Minimum received:     41.97 USDG
Price impact:         0.8%
Slippage tolerance:   0.5%
Prediction side:      YES
Current YES pool:     63%
Estimated payout*:    64.71 USDG
```

Footnote that projected payout changes until lock as other users enter.

#### Transaction steps

For v0 two-transaction flow:

```text
1. Approve token       ✓
2. Swap to USDG        pending
3. Enter market        waiting
```

Do not hide multiple wallet confirmations. Explain them succinctly.

If account abstraction batches them later, display one combined confirmation.

## 7. Success state

After confirmed entry:

```text
Position opened
YES — NVDA Stock Token >= $200
Funded with: 10,000 PONS
Normalized stake: 42.18 USDG
Entry tx: 0x...
```

If swap and entry are separate, show both explorer links.

CTA:

- View portfolio
- Share market

## 8. Portfolio

Tabs:

- Active
- Claimable
- Resolved
- History

Position card:

- market,
- side,
- stake,
- source funding token,
- normalized collateral,
- current pool split,
- lock time,
- status,
- projected/current claim if applicable.

## 9. Claim UX

Resolved winner:

```text
You won
Stake:         42.18 USDG
Gross payout:  68.40 USDG
Protocol fee:   0.26 USDG
Claimable:     68.14 USDG
```

Primary: `Claim USDG`

Later secondary: `Claim as another token`

If claim-as-token is implemented, it is a separate swap flow after/with claim and must show quote/slippage.

## 10. Wallet assets page

This screen should embrace the launchpad-style token card visual language from the brainstorm.

Card:

```text
[token image]
Pons
$PONS
Balance: 1,820,331
Est. value: 3,104 USDG
[Use for predictions]
```

Status badges:

- Ready
- High impact
- No route
- Unverified

Do not use “Graduated” unless the product has a trusted source proving that status for the exact contract.

## 11. Communities page

Community card:

- token logo/name/symbol,
- normalized prediction volume,
- active wallets,
- 7d PnL,
- resolved hit rate,
- top current market stance.

Example:

```text
PONS
$482K prediction volume
1,842 participating wallets
Current strongest stance:
NVDA >= $200 — 72% YES-funded capital
```

Precise wording is important: do not imply all holders share the view.

## 12. Community detail

Sections:

- overview,
- open-market stance,
- historical performance,
- top predictors,
- recent entries,
- markets most funded with this token.

## 13. Leaderboard

Metrics:

- realized PnL,
- ROI,
- resolved hit rate,
- volume,
- streak.

Windows:

- 7D
- 30D
- All time

Display minimum-market threshold for ROI/hit-rate rankings.

## 14. Predictor profile

Wallet header:

- truncated address / optional display name,
- total volume,
- realized PnL,
- ROI,
- hit rate,
- category breakdown,
- source-token breakdown,
- recent resolved predictions.

No private user data is required.

## 15. Admin market creator

Wizard:

### Step 1 — Outcome asset

Select canonical configured Stock Token/oracle asset.

### Step 2 — Template

- above at time,
- below at time,
- direction (if enabled),
- relative performance (if enabled).

### Step 3 — Parameters

- strike,
- open,
- lock,
- resolution,
- grace period,
- min/max entry,
- fee bps.

### Step 4 — Oracle health

Show:

- feed address,
- feed decimals,
- last update,
- staleness status,
- Stock Token oracle pause status,
- pending corporate-action warning when available.

### Step 5 — Exact terms preview

Generate canonical question and resolution sentence from structured params.

### Step 6 — Onchain create

Admin wallet signs factory transaction.

### Step 7 — Register metadata

Backend indexes/records resulting market.

## 16. Loading/error states

Required distinct states:

- wallet disconnected,
- wrong network,
- RPC unavailable,
- balance loading,
- quote loading,
- quote expired,
- no route,
- insufficient balance,
- insufficient gas,
- approval required,
- signature rejected,
- swap submitted,
- swap reverted,
- market entry submitted,
- market locked between quote and entry,
- oracle unavailable,
- claim already completed.

Never collapse everything into “Something went wrong.”

## 17. Mobile behavior

Trade panel becomes sticky bottom CTA.

Market detail order:

1. question,
2. YES/NO summary,
3. chart,
4. trade CTA,
5. terms,
6. community/activity.

Token selector should be a full-height bottom sheet on mobile.

## 18. Accessibility

- Do not use green/red alone to distinguish YES/NO.
- All buttons keyboard accessible.
- Visible focus states.
- Sufficient contrast.
- Time remaining should have exact date/time available to screen readers.
- Transaction status updates should use ARIA live regions where appropriate.

## 19. Copy rules

Use:

- “Robinhood Chain” in full.
- “Stock Tokens” when referring to Robinhood’s product category.
- “Built on Robinhood Chain” rather than implying official Robinhood ownership/endorsement.

Avoid:

- “Hood Chain”.
- “Official Robinhood prediction market” unless actually authorized.
- “Guaranteed returns.”
- “Risk-free.”
- describing v0 pool ratio as a precise probability if mechanism is only capital split.
