# Design QA

## Comparison target

- Markets: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-26e1ee22-7c74-45b2-86fa-8b71c4aaa598.png`
- Communities: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-ef00323d-e2d5-42a7-bf7c-cc51e3115178.png`
- Leaderboard: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-9995db09-4399-43ba-ae0c-b19eba1effbe.png`
- Portfolio: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-c3df0244-cc70-4e31-bf1e-812be1e56fe3.png`
- Implementation routes: `/markets`, `/communities`, `/leaderboard`, `/portfolio`
- Source pixels: 1487 x 1058 each. Implementation captures: 1265 x 710 at device scale factor 1.
- Captures: Codex in-app Browser; the API did not expose persistent screenshot paths.
- State: read-only discovery with explicit demonstration fallbacks when chain or indexer data is unavailable.

## Full-view comparison evidence

- Markets preserves the monumental heading, featured split signal, compact state tape, filters, and three-column card grid in the homepage ivory palette.
- Communities preserves the constellation plus selected-community detail sheet and keeps the controls usable with labelled demonstration data.
- Leaderboard preserves the three-position podium, metric/window controls, and ranking table in the homepage light palette.
- Portfolio preserves the summary ledger, two-sided exposure bar, tabs, and position rows while stating that no wallet or live-position data is displayed.

## Required fidelity surfaces

- Fonts and typography: condensed Impact/Arial Narrow display headings, system grotesk body copy, and monospace data labels match the approved hierarchy.
- Spacing and layout rhythm: all four pages retain the reference's wide desktop bands, tight rules, primary visual proportions, and compact data density.
- Colors and tokens: ivory `#f5f3ee`, black, cobalt `#4b63ff`, and acid-lime `#bafa28` match the homepage.
- Image quality: existing purpose-made market signal, community constellation, and leaderboard podium raster assets are used at their intended scale.
- Copy and content: Poku branding, capital-share language, demonstration labels, and the disabled trading state prevent fake live-market, wallet, or performance claims.

## Findings

- No actionable P0, P1, or P2 findings remain.
- [P3] Poku replaces the older Prediction Layer wordmark in the references.
- [P3] Connect Wallet is intentionally replaced with the disabled `Trading not open` control.

## Comparison history

1. Markets used an unrelated dark card directory; Communities and Portfolio collapsed into outage boxes; Leaderboard hid its ranking content behind an outage overlay.
2. Restored each approved composition and synchronized all four routes to the homepage light palette.
3. Added clearly labelled demonstration fallbacks so layouts remain useful without representing sample information as live chain or wallet data.
4. Browser captures confirmed correct desktop composition and no visible horizontal overflow.

## Primary interactions tested

- Market search, category, status, and sort controls.
- Community search, time filters, and node selection.
- Leaderboard metric and time-window links.
- Portfolio tabs remain visual preview controls; no wallet transaction is constructed.
- Type-check, lint, production build, and browser rendering.

final result: passed
