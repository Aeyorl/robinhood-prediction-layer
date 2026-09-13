# Poku Robinhood Chain mainnet core deployment evidence

- Date: 2026-09-13
- Chain: Robinhood Chain mainnet (4663)
- Release commit: `f8e359f34cf1c46095c23766be92ec65388e9540`
- Authorization commit: `0c2b5b266cd7a3bd887b2dafb69bc346c3482a67`
- GitHub Actions run: `34776556516`
- Receipt artifact SHA-256: `2923bf9ec198c4bffa7489e25502a14c414bdb19dfe7fd63ca301e28da196c72`

The deployment workflow completed successfully after the V3 release manifest was signed by two verified owners of the 2-of-3 Poku Safe and the compliance gate was approved. The workflow built and tested the contracts, ran the mainnet preflight, broadcast eight CREATE transactions, and retained the receipts.

| Contract                 | Address                                      | Transaction                                                          |    Block |
| ------------------------ | -------------------------------------------- | -------------------------------------------------------------------- | -------: |
| ProtocolTimelock         | `0x96aC6E8964bdDA7604520B868d60B49FfA9e6ad4` | `0xd90531d2678d8189b598532a96414ddc9bed146af3c36d5dc262a1504f3b1779` | 62191277 |
| OracleRegistry           | `0x0628a09AFF40FE8590026e498dA7a216C83C6c94` | `0xc0eb955455d08683047c175e46bef6290799d22b9e88f9c27ecd09e608639d2f` | 62191280 |
| ChainlinkPriceResolver   | `0x49f460112E9D2b378D7AC9dEa9Bb368f2Dc5af9a` | `0xe48f287c0c6fcadfc7c916da77bd6c299a7e42b3f2b0c14a83992215dc952c18` | 62191283 |
| DataStreamsRwaResolver   | `0x516bbeE20Ee4e0Fe440Ea6b9531581e6C0f558f8` | `0x47d9a29d840203c05507be469569d2d7f14bae70f471b235f2b0d0a20945ff6a` | 62191287 |
| SafeClosingPriceResolver | `0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5` | `0x89af2b558a6c269be19c8140d7db858c0858dfdf037cd1ade568b52644d5425c` | 62191291 |
| FeeVault                 | `0x72792B5916dCbf5f0Ae8DB67B748fb5f5c37b89f` | `0x8e08f20ca1ada6f1dc07f549555060dd837f2bdb5fe318e80d570bf856d8140d` | 62191295 |
| MarketFactory            | `0x62A301F2A0356a16fC1BB02991CfB9cFDb00152C` | `0x6e0b725ffc88e5bff708ab7b17bb76c857ab5c37c5fe4d7f0cef3af0775df6b9` | 62191299 |
| PredictionEntryRouter    | `0x02c12517564d727CdD2f16736F7486EF31352195` | `0x218512deb6d83f3125e3c406bf59969426732e815e8ac8a999b61be660257718` | 62191304 |

## Onchain verification

- All eight receipts returned status `1`, and all eight addresses contain deployed bytecode.
- `ProtocolTimelock.getMinDelay()` is `172800` seconds (two days).
- Safe `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39` has proposer, executor, and canceller roles.
- The deployer and zero address have none of those roles.
- The timelock alone holds `DEFAULT_ADMIN_ROLE`; the Safe, deployer, and zero address do not.
- OracleRegistry, all three resolvers, FeeVault, MarketFactory, and PredictionEntryRouter are owned by the timelock.
- FeeVault's immutable recipient is the MAG7 timelock `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`.
- PredictionEntryRouter references canonical USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` and the deployed MarketFactory.
- The configured external swap target is not allowlisted.
- The deployer nonce advanced from 14 to 22 and retains no protocol role.

## Product state

This evidence covers deployment of the core contracts only. It does not authorize or enable deposits, swaps, market creation, position entry, or active trading. Opening trading requires separate Safe/timelock operations, the mandatory two-day delay, verified oracle and market configuration, production API/indexer integration, and final launch checks.
