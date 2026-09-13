# Mainnet deployment transaction package — 2026-09-10

Status: **review only**. `deploymentAuthorized` remains **false**. These addresses are **predicted from a no-broadcast simulation**. They are not deployed. Do not copy them into `packages/chain-config`.

Simulation: `forge script script/Deploy.s.sol:Deploy` against Robinhood Chain public RPC, `--sender 0x913B8D346625736958664C77b0C8Efd3DA2a7bA2 --unlocked --isolate`, **no `--broadcast`**. Script commit in the dry-run metadata: `6d22c50`.

## Freshness re-read — 2026-09-11

Package still valid. Deployer nonce remains `14`. Predicted timelock, factory and router still have **no code**. Safe nonce remains `6`.

| Item                        | 2026-09-10                   | 2026-09-11                 |
| --------------------------- | ---------------------------- | -------------------------- |
| Block                       | `60459496`                   | `60462521`                 |
| Live gas price              | `0.108032 gwei`              | `0.107892 gwei`            |
| Foundry estimated gas       | `12,074,312`                 | `12,074,312`               |
| Foundry estimated gas price | `0.214484001 gwei`           | `0.212680001 gwei`         |
| Estimated amount required   | `0.002589746747082312 ETH`   | `0.002567964688234312 ETH` |
| Ceiling                     | `0.012 ETH`                  | `0.012 ETH` (still pass)   |
| Predicted addresses         | eight CREATE addresses below | **unchanged**              |

## Freshness re-read — 2026-09-13

Package still valid. Deployer nonce remains `14`. All eight predicted
addresses re-derive identically from deployer nonces `14`–`21` and still have
**no code**. Safe nonce remains `6`, with the owner set and threshold
unchanged.

| Item                   | 2026-09-10                   | 2026-09-13                                                       |
| ---------------------- | ---------------------------- | ---------------------------------------------------------------- |
| Block                  | `60459496`                   | `62138316`                                                       |
| Live gas price         | `0.108032 gwei`              | `0.08542 gwei`                                                   |
| Live base fee          | `0.105936 gwei`              | `0.086222 gwei`                                                  |
| Deployer nonce         | `14`                         | `14`                                                             |
| Deployer balance       | `0.000030654414 ETH`         | `0.000030654414 ETH` (still unfunded)                            |
| Deployer is Safe owner | `false`                      | `false`                                                          |
| Safe nonce / threshold | `6` / `2`                    | `6` / `2`                                                        |
| Safe owner set         | three owners below           | **unchanged**                                                    |
| Predicted addresses    | eight CREATE addresses below | **unchanged; all eight `codeSize 0`**                            |
| Foundry gas estimates  | original simulation values   | **not re-simulated**; original estimates still bind this package |

Additional live checks at 2026-09-13:

- `cast compute-address` from deployer nonces `14`–`21` reproduces the eight
  predicted addresses in the ordered CREATE set exactly; `cast codesize` is
  `0` for each, so no address has been squatted or front-run.
- External dependency code sizes are unchanged: USDG `170`, WETH `2202`,
  Uniswap Universal Router `24546`, Data Streams verifier `7009` bytes.
- The deployer holds no protocol role onchain.
- MAG7 timelock delay is still `172800` and the Safe is still its proposer,
  executor and canceller.

Provenance: the AWS session was expired at read time, so these values were
read through the public Robinhood Chain RPC
`https://rpc.mainnet.chain.robinhood.com` instead of the dedicated production
endpoints in `prediction-layer/production/rpc-endpoints`. Every read was
read-only (`cast nonce`, `cast balance`, `cast codesize`, `cast call`,
`cast compute-address`, `cast gas-price`, `cast base-fee`); no transaction was
signed or broadcast.

Gas is materially lower than at simulation time, so the funding requirement
remains below the recorded `~0.00256 ETH` estimate and far below the
`0.012 ETH` ceiling. A fresh `forge --isolate` dry-run from the frozen release
is still required immediately before any broadcast; if the deployer nonce
moves away from `14`, this package is invalid and must be resimulated.

## Live re-reads at simulation time

| Item                                     | Value                                                         |
| ---------------------------------------- | ------------------------------------------------------------- |
| Chain ID                                 | `4663` (`0x1237`)                                             |
| Block                                    | `60459496`                                                    |
| Gas price (live)                         | `108032000` wei (`0.108032 gwei`)                             |
| Base fee (live)                          | `105936000` wei                                               |
| Safe                                     | `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`                  |
| Safe nonce                               | `6`                                                           |
| Safe threshold                           | `2` of `3`                                                    |
| Safe owners                              | `0xa5e7…7f7A`, `0x2603…812D`, `0x8cA7…A165`                   |
| Deployer                                 | `0x913B8D346625736958664C77b0C8Efd3DA2a7bA2`                  |
| Deployer nonce                           | `14`                                                          |
| Deployer is Safe owner                   | `false`                                                       |
| Deployer code                            | `0` (EOA)                                                     |
| Deployer balance                         | `0.000030654414 ETH`                                          |
| Fee recipient (MAG7 timelock)            | `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`                  |
| MAG7 delay                               | `172800`                                                      |
| Safe is MAG7 proposer/executor/canceller | `true` / `true` / `true`                                      |
| USDG code                                | `170` bytes at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`   |
| WETH code                                | `2202` bytes at `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`  |
| Uniswap Universal Router                 | `24546` bytes at `0x8876789976decbfcbbbe364623c63652db8c0904` |
| Data Streams verifier                    | `7009` bytes at `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`  |

The deployer key was **not** loaded locally. Simulation used `--sender` equal to the designated deployer. GitHub `DEPLOYER_PRIVATE_KEY` is still required before any real broadcast and must never be pasted into chat.

## Gas and funding

Foundry `--isolate` estimate (buffered gas price):

|                            |                                       |
| -------------------------- | ------------------------------------- |
| Estimated gas              | `12,074,312`                          |
| Estimated gas price        | `0.214484001 gwei`                    |
| Estimated amount required  | `0.002589746747082312 ETH`            |
| Bounded ceiling            | `0.012 ETH`                           |
| Ceiling check              | **pass** (estimate is 22% of ceiling) |
| Current deployer balance   | `0.000030654414 ETH`                  |
| Additional native required | `~0.002559 ETH` before broadcast      |

Do not fund until this exact package is approved. After approval, fund only the deployer, not above `0.012 ETH` total.

## Ordered CREATE set (8 transactions, value `0`)

All `from` `0x913B8D346625736958664C77b0C8Efd3DA2a7bA2`. `to` is empty (CREATE). Full initcode is in the local gitignored dry-run file `packages/contracts/broadcast/Deploy.s.sol/4663/dry-run/run-latest.json`. Constructor ABI encoding is the trailing bytes of that initcode.

| #   | Nonce | Contract                   | Predicted address                            | Constructor                                                                          | Encoded args                                                                                                                                                                                         | Gas limit   |
| --- | ----- | -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | 14    | `ProtocolTimelock`         | `0x96aC6E8964bdDA7604520B868d60B49FfA9e6ad4` | `(address safe)` internally `TimelockController(172800, [safe], [safe], address(0))` | `0x0000000000000000000000005a205159348bbe6c4a5a264b59fc8df7a4ab6a39`                                                                                                                                 | `1,796,099` |
| 2   | 15    | `OracleRegistry`           | `0x0628a09AFF40FE8590026e498dA7a216C83C6c94` | `(address initialOwner = timelock)`                                                  | `0x00000000000000000000000096ac6e8964bdda7604520b868d60b49ffa9e6ad4`                                                                                                                                 | `730,059`   |
| 3   | 16    | `ChainlinkPriceResolver`   | `0x49f460112E9D2b378D7AC9dEa9Bb368f2Dc5af9a` | `(timelock, registry)`                                                               | `0x00000000000000000000000096ac6e8964bdda7604520b868d60b49ffa9e6ad40000000000000000000000000628a09aff40fe8590026e498da7a216c83c6c94`                                                                 | `1,139,659` |
| 4   | 17    | `DataStreamsRwaResolver`   | `0x516bbeE20Ee4e0Fe440Ea6b9531581e6C0f558f8` | `(timelock, verifier)`                                                               | `0x00000000000000000000000096ac6e8964bdda7604520b868d60b49ffa9e6ad4000000000000000000000000ce73c8ad08cbdeaca6078bf0627c8fe0a9a536e7`                                                                 | `1,381,831` |
| 5   | 18    | `SafeClosingPriceResolver` | `0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5` | `(timelock, guardian = Safe)`                                                        | `0x00000000000000000000000096ac6e8964bdda7604520b868d60b49ffa9e6ad40000000000000000000000005a205159348bbe6c4a5a264b59fc8df7a4ab6a39`                                                                 | `1,429,069` |
| 6   | 19    | `FeeVault`                 | `0x72792B5916dCbf5f0Ae8DB67B748fb5f5c37b89f` | `(timelock, MAG7 timelock)`                                                          | `0x00000000000000000000000096ac6e8964bdda7604520b868d60b49ffa9e6ad4000000000000000000000000bc8a2ac01aeeb849a15825e9fa12ebfbe83dd8d8`                                                                 | `441,368`   |
| 7   | 20    | `MarketFactory`            | `0x62A301F2A0356a16fC1BB02991CfB9cFDb00152C` | `(timelock)`                                                                         | `0x00000000000000000000000096ac6e8964bdda7604520b868d60b49ffa9e6ad4`                                                                                                                                 | `4,090,017` |
| 8   | 21    | `PredictionEntryRouter`    | `0x02c12517564d727CdD2f16736F7486EF31352195` | `(timelock, USDG, factory)`                                                          | `0x00000000000000000000000096ac6e8964bdda7604520b868d60b49ffa9e6ad40000000000000000000000005fc5360d0400a0fd4f2af552add042d716f1d16800000000000000000000000062a301f2a0356a16fc1bb02991cfb9cfdb00152c` | `1,066,210` |

`router.setSwapTarget(Uniswap Universal Router, true)` is **not** in this broadcast. It must be scheduled through the new Poku timelock after onchain verification (48-hour delay).

## Intended ownership after these 8 creates

| Contract                   | Owner / roles                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProtocolTimelock`         | delay `172800`; Safe sole proposer, executor, canceller; admin `address(0)` so only the timelock holds `DEFAULT_ADMIN_ROLE`; deployer has no role |
| `OracleRegistry`           | owner = Poku timelock                                                                                                                             |
| `ChainlinkPriceResolver`   | owner = Poku timelock                                                                                                                             |
| `DataStreamsRwaResolver`   | owner = Poku timelock; `verifierProxy` = `0xcE73c8…36E7`                                                                                          |
| `SafeClosingPriceResolver` | owner = Poku timelock; `guardian` = Safe                                                                                                          |
| `FeeVault`                 | owner = Poku timelock; immutable `recipient` = MAG7 timelock                                                                                      |
| `MarketFactory`            | owner = Poku timelock                                                                                                                             |
| `PredictionEntryRouter`    | owner = Poku timelock; `usdg` = canonical USDG; `factory` = predicted factory; swap target **not** allowlisted yet                                |

## Post-deployment read list (only after a real broadcast)

1. `eth_getCode` nonempty at each predicted address; record tx hashes and blocks.
2. `ProtocolTimelock.getMinDelay() == 172800`.
3. `hasRole(PROPOSER_ROLE, Safe)`, `hasRole(EXECUTOR_ROLE, Safe)`, `hasRole(CANCELLER_ROLE, Safe)` all true.
4. `hasRole(DEFAULT_ADMIN_ROLE, deployer) == false`, `hasRole(..., address(0)) == false`, `hasRole(..., timelock) == true`.
5. `owner()` on registry, both resolvers, safe-closing resolver, fee vault, factory, router equals the Poku timelock.
6. `FeeVault.recipient() == 0xBC8A2a…d8d8`.
7. `PredictionEntryRouter.usdg()` and `factory()` match canonical USDG and the factory.
8. `allowedSwapTargets(Universal Router) == false` until the delayed allowlist.
9. Deployer nonce is `22`. Deployer holds no protocol role.
10. Verify source and constructor arguments on Blockscout before any market is created.

## Explicitly not authorized by this file

- Funding the deployer
- A Safe transaction
- GitHub `deploy-mainnet.yml`
- Setting `MAINNET_COMPLIANCE_APPROVED`
- Updating `packages/chain-config/src/addresses.ts`
- Enabling trading

If the deployer nonce moves away from `14` before broadcast, this package is invalid and must be resimulated.

## Remaining gates before a real broadcast

- Explicit human approval of **this** eight-CREATE package.
- Deployer funding within `0.012 ETH` after that approval, not before.
- GitHub `mainnet` environment variable `MAINNET_COMPLIANCE_APPROVED` is still `false` in this package snapshot; it was subsequently set to `true` to record the owner-provided compliance approval (2026-09-13). The protected workflow's preflight will refuse to broadcast while it is false. No external-audit flag exists; the external-audit launch requirement was removed at the project owner's request.
- GitHub secret **names** present: `DEPLOYER_PRIVATE_KEY`, `EXPECTED_SAFE_OWNERS`, `PRODUCTION_RPC_URL`. Values were not read.
- GitHub `mainnet` environment currently has **no protection rules** and no deployment branch policy. Add required reviewers before anyone runs `deploy-mainnet.yml`.
- AWS CLI session is expired; SNS paging and the drafted monitoring-stack update remain outstanding.
