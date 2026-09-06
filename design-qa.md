# Design QA

## Comparison target

- Markets source: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-d8a2da4c-6f19-493b-b6aa-2dadaf51a1c5.png`
- Communities source: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-13ebed23-ff51-412e-a8b3-9436131cc057.png`
- Leaderboard source: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-4f6b767d-7c1c-4fb4-a35e-23b2cb280ba0.png`
- Portfolio source: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-a4e4d701-a18c-487a-a0dc-b8c4b7788422.png`
- Implementation: `http://127.0.0.1:3000/markets`, `/communities`, `/leaderboard`, and `/portfolio`
- Source pixels: 1487 x 1058 each.
- Implementation viewport: 1440 x 1024 CSS px at device scale factor 1.
- Density normalization: source and implementation were compared at desktop scale; the source's extra 47 x 34 pixels did not materially change proportions.
- Captures: rendered full-page captures were taken in the Codex in-app Browser for all four routes. The browser capture API did not expose persistent local screenshot paths.
- State: Markets used live local-chain data. Communities and Leaderboard used their indexed-data empty states. Portfolio used the disconnected-wallet state.

## Full-view comparison evidence

- The shared warm-ivory surface, black condensed headings, graphite rules, cobalt YES, and acid-lime NO align with the selected homepage palette.
- Markets preserves the selected broadcast hierarchy through the featured market, split signal image, status tape, and three-market strip while using the requested light palette.
- Communities preserves the spatial map plus detail-sheet composition. The verified empty state retains the constellation rather than fabricating participant data.
- Leaderboard preserves the monumental three-position podium and metric controls. The verified empty state keeps the visual frame without inventing wallet performance.
- Portfolio preserves the statement summary, exposure composition, tabs, and ruled positions area. Its disconnected state does not fabricate wallet balances.

## Focused-region comparison evidence

- Typography: Impact/Arial Narrow fallbacks reproduce the compressed display hierarchy; system grotesk and monospace roles keep market and wallet data readable.
- Spacing: header alignment, large title scale, primary graphic proportions, control spacing, and bottom data regions follow the selected references at the target viewport.
- Colors: all four routes use the homepage tokens `#f5f3ee`, `#111111`, `#4b63ff`, and acid-lime values in the `#bafa28` family.
- Image quality: the market signal, community constellation, and leaderboard podium are purpose-made raster assets at their intended display sizes; no reference artwork or third-party logos were copied.
- Copy: capital-share language, attribution limits, chain state, and independent-product disclaimer remain explicit. Empty states replace mock values when live data is unavailable.

## Findings

- No actionable P0, P1, or P2 findings remain.
- [P3] Empty analytics states are intentionally less dense than the populated source mocks.
  - Location: Communities and Leaderboard.
  - Evidence: local indexed datasets currently contain no qualifying rows.
  - Impact: the pages show less data than the selected references while preserving their structure.
  - Follow-up: populate the staging indexer to review the full data-dense states.

## Comparison history

1. Initial Portfolio capture displayed a full acid-lime exposure track while both percentages were unavailable.
2. Fixed the no-position state to use a neutral graphite track and an explicit `No position exposure` accessible label.
3. Post-fix code, type-check, and rendered-state review found no remaining P0/P1/P2 mismatch.

## Primary interactions tested

- Global navigation between all four redesigned routes.
- Markets search filtered the three live cards to the matching AI market.
- Markets status, asset, and sort controls remain wired to client state.
- Communities selection and time-window controls are implemented for populated API data.
- Leaderboard metric and time-window controls use URL-backed server queries.
- Portfolio tabs, direct chain reads, claim links, and connected/wrong-network/empty states remain wired.
- Browser console checked with no warnings or errors.

## Implementation checklist

- [x] Selected layouts implemented on their existing routes.
- [x] Homepage palette applied consistently.
- [x] Real chain and indexer data preserved.
- [x] Empty and disconnected states avoid fabricated production data.
- [x] Desktop and responsive layouts included.
- [x] Type-check, lint, build, and tests pass.

## Follow-up polish

- Re-run visual QA with seeded staging analytics and a connected test wallet to inspect fully populated Communities, Leaderboard, and Portfolio states.

final result: passed
