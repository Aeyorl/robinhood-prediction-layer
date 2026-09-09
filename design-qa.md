# Design QA

## Comparison target

- Source visual truth: `C:\Users\aeyon\AppData\Local\Temp\codex-clipboard-8e3276ed-45c7-4516-9d21-2470792f03b8.png`
- Implementation: `http://127.0.0.1:3000/`
- Source pixels: 1487 x 1058.
- Browser-rendered implementation capture: Codex in-app Browser capture; the browser API did not expose a persistent local screenshot path.
- Implementation capture pixels: 910 x 880 at browser device scale factor 1.
- CSS viewport: responsive narrow-desktop state. The existing desktop rules apply above 950 CSS px and preserve the source's side-by-side hero.
- Density normalization: source composition was compared at its native desktop size; the implementation was also reviewed at the available responsive viewport to confirm its intended stacked adaptation.
- State: read-only sample discovery with centralized stock data and the server-side Robinhood Chain memecoin feed.

## Full-view comparison evidence

- The implementation restores the source's warm-ivory canvas, oversized condensed black headline, cobalt/lime split orbit artwork, two outcome labels, black primary action, three-card market row, signal tape, and four-column trust band.
- At the available 910 px capture, the hero intentionally stacks and the mobile navigation appears. The orbit remains centered and both outcome labels remain visible without horizontal overflow.
- Poku branding and the disabled `Trading not open` control replace the older name and active wallet action without changing the selected visual direction.

## Focused-region comparison evidence

- Fonts and typography: the Impact/Arial Narrow display stack preserves the compressed uppercase hero; system grotesk and monospace roles reproduce the source hierarchy for navigation and market data.
- Spacing and layout rhythm: hero copy, paired actions, orbit, market heading, and card grid follow the source ordering. Desktop remains a two-column hero and three-card row; the captured responsive state stacks them.
- Colors and tokens: `#f5f3ee`, black, cobalt `#4b63ff`, and acid-lime treatments match the source palette.
- Image quality: `/two-sided-orbit.png` is the existing purpose-made raster asset, rendered with `next/image`; no CSS or inline-SVG substitute is used.
- Copy and content: trading and wallet promises were replaced with accurate read-only discovery language. Capital share is explicitly distinguished from guaranteed probability.

## Findings

- No actionable P0, P1, or P2 findings remain.
- [P3] The screenshot target uses the former Prediction Layer wordmark while the product now uses the approved Poku name.
- [P3] The target's active wallet button is intentionally represented as a disabled `Trading not open` control until launch checks finish.

## Comparison history

1. The recovery build showed an older dark `Read the market. Before it opens.` homepage, a P1 mismatch that changed the entire approved direction.
2. Restored the existing light two-sided hero and market composition, adapted it to centralized `SampleMarket` data, and retained all read-only transaction safeguards.
3. Post-fix in-app Browser capture confirmed the ivory surface, headline, orbit, outcome labels, actions, market heading, and responsive behavior with no visible overflow.

## Primary interactions tested

- Homepage rendered through the dynamic server route with centralized public-market data.
- Hero and market-card links resolve to the existing discovery routes.
- The wallet control remains disabled and creates no transaction or approval request.
- Reduced-motion handling remains present for count-up, orbit, and transition effects.
- Type-check, lint, production build, and browser render completed successfully.

## Implementation checklist

- [x] Approved light landing-page direction restored.
- [x] Existing orbit asset and responsive rules reused.
- [x] Read-only sample and DexScreener discovery preserved.
- [x] Trading, deposits, and approvals remain disabled.
- [x] Poku branding preserved.

## Follow-up polish

- Re-capture at 1487 x 1058 when a resizable browser surface is available for pixel-level desktop comparison.

final result: passed
