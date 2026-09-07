# Production address verification — 2026-09-05

| Item                           | Verified value                               | Evidence                                                                             |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Chain                          | Robinhood Chain, ID 4663                     | Official network docs; live RPC returned 4663                                        |
| Public RPC                     | `https://rpc.mainnet.chain.robinhood.com`    | Official docs; live JSON-RPC succeeded                                               |
| Production RPC                 | Dedicated Alchemy HTTP + WebSocket endpoints | Stored in AWS Secrets Manager; both returned chain ID 4663 on 2026-09-07             |
| USDG                           | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | Official token page; 170 bytes deployed code                                         |
| Uniswap Universal Router 2.1.1 | `0x8876789976decbfcbbbe364623c63652db8c0904` | Official Uniswap deployment docs and SDK; 24,546 bytes deployed code                 |
| Data Streams verifier          | `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7` | Official Robinhood page; 7,009 bytes deployed code                                   |
| AAPL token/feed                | `0xaF3D…93f9` / `0x6B22…cD0`                 | Robinhood API, Chainlink directory and live health check                             |
| NVDA token/feed                | `0xd060…9EEC` / `0x379E…9F15`                | Robinhood API, Chainlink directory and live health check                             |
| TSLA token/feed                | `0x322F…3b2d` / `0x4A11…7C38`                | Robinhood API, Chainlink directory and live health check                             |
| Sequencer uptime contract      | None published                               | Robinhood's transaction-feed WebSocket is not a Chainlink uptime contract; keep null |

The public RPC is rate-limited and is not the production destination. The private endpoint fields are stored as `RPC_HTTP_URL` and `RPC_WS_URL` in `prediction-layer/production/rpc-endpoints`; the values must remain redacted. A direct JSON-RPC `eth_chainId` request over each transport returned `4663` on 2026-09-07. The ECS runtime template references the two JSON fields separately so the API receives HTTPS and the worker receives both HTTPS and WebSocket transports.
