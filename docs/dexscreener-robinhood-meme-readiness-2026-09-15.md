# Robinhood-chain memecoin discovery readiness — 2026-09-15

Status: discovery evidence only. DexScreener data is not an oracle and does not authorize market creation or trading.

The configured server-side feed queried DexScreener's token-pairs endpoint with `chainId=robinhood`. It requires actual `marketCap >= 30,000,000 USD` and `liquidity >= 100,000 USD`; FDV is no longer accepted as a market-cap substitute. Results are cached for 60 seconds, requests time out after five seconds, and invalid or unavailable responses produce an honest unavailable state rather than invented data.

The live check on 2026-09-15 returned qualifying pairs for the configured candidate tokens:

| Token   | Observed market cap range | Highest observed liquidity | Highest observed 24h volume |
| ------- | ------------------------: | -------------------------: | --------------------------: |
| PONS    |         about $473m–$478m |                about $6.4m |                about $42.4m |
| CASHCAT |         about $160m–$163m |                about $4.9m |                 about $5.2m |
| AI      |         about $312m–$319m |                about $4.7m |                about $12.3m |

These values are time-sensitive discovery observations, not guaranteed market values. The UI links to the selected DexScreener pair and labels the figures as discovery data. The default Markets filter is now Memecoins; when no pair meets the screen, the page displays the unavailable state.

Before any memecoin prediction market can accept funds, define an independent settlement source and immutable reference timestamp/terms. DexScreener may inform discovery and evidence display, but it must not be used alone to determine a winning outcome.
