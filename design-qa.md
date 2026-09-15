# Market Atlas visual QA

## Source and implementation

- Source visual truth: `C:\Users\aeyon\.codex\generated_images\01a0709f-b672-7cc2-bd0e-7e4db3341eba\exec-bac82460-5b67-4288-8e23-ce62a75e637c.png` (1487 x 1058).
- Desktop implementation: `design-qa/atlas-home-desktop.png` (1440 x 1024 CSS px, device scale factor 1).
- Mobile implementation: `design-qa/atlas-home-mobile.png` (390 x 844 CSS px, device scale factor 1).
- Deployed implementation: `design-qa/atlas-home-live.png` (1440 x 1024 CSS px, device scale factor 1) captured from `https://www.usepoku.fun/` after the GitHub-triggered deployment.
- Combined comparison: `design-qa/atlas-comparison.png` (source and implementation normalized to 720 x 512 each for visual comparison).
- State: public homepage, featured NVDA preview, PONS atlas node selected, light theme, read-only controls.

## Comparison

The implementation preserves the source hierarchy: Poku header, condensed two-line editorial headline, left-side explanation and actions, right-side blue/lime split orb with surrounding nodes, status row, category rail, and three market cards. The atlas is now a real responsive Canvas2D renderer rather than a static image/video: connection lines and inward particles animate, the split orb breathes, and the selected PONS node intensifies its glow. The generated source uses a 58/42 concept state; the implementation correctly uses the current featured preview's 63/37 data.

Focused review covered the atlas canvas and node controls at desktop and the stacked hero at 390 px. The canvas remains clipped inside `.market-atlas` at both widths, and the mobile page has no horizontal overflow.

## Validation

- `pnpm --filter @pl/web run lint` passed.
- `pnpm --filter @pl/web run typecheck` passed.
- `pnpm --filter @pl/web run build` passed.
- Browser QA passed: animation frame changes, AAPL node selection, desktop containment, mobile no-overflow, reduced-motion media state, and no console errors.
- HTTP smoke checks returned 200 for `/`, `/markets`, `/communities`, `/leaderboard`, and `/portfolio`.
- Public deployment verification: `https://www.usepoku.fun/` returned HTTP 200 and rendered the new “Map the signal” homepage after commit `bbf0da3`.

## Findings and history

No actionable P0, P1, or P2 visual findings remain. The source is a static concept frame, so the implementation intentionally replaces its implied motion with a live canvas while retaining the composition and palette. The status text and market figures remain honest preview states; trading and wallet actions remain disabled.

## Implementation checklist

- [x] Market Atlas hero replaces the previous video hero.
- [x] Responsive desktop and mobile containment.
- [x] Interactive node selection and accessible labels.
- [x] Inward funding-flow particles and breathing split orb.
- [x] Reduced-motion static render path.
- [x] Market categories and alpine visual treatment added to the discovery section.

final result: passed

## Atlas category pages - September 15, 2026

Extended the selected homepage palette, alpine backdrop, condensed headings, and panel treatment to Markets, Communities, Leaderboard, and Portfolio. Existing constellation and podium renderers are retained; this is a coordinated styling update, not a reproduction of new per-page artwork.

Portfolio tabs now switch between sample positions and honest claim/history empty states. Corrected premultiplied shader output and reversed smoothstep ranges in the market orb. The featured market stacks on mobile to prevent squeezing its orb.

Verified desktop screenshots at 1440px and mobile screenshots at 390px for all four routes, stored in `design-qa/*-atlas*.png`. Four browser tests passed: market search, community time-window selection, leaderboard metric navigation, portfolio tabs, no horizontal overflow, and no page errors. Web lint, typecheck, and production build passed. Reduced-motion behavior was retained but was not separately retested in this category-page pass. Trading remains disabled and demonstration labels remain visible.
