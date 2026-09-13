# Wagerly internal security review — 2026-09-08

**Reviewed commit:** `8d1d78d50b1fd06c04cc03750e32287ceb3a14b5` (`origin/main`, tag parent of this review)
**Candidate lineage:** `prediction-layer-mainnet-audit-rc4` (`9f11dcc`) plus ceremony-evidence commit `8d1d78d`
**Reviewer:** engineering self-review (see §Limitations)
**Classification:** internal. **This is not an independent external audit.** The same team that implemented the code performed this review. (Update 2026-09-13: the external-audit launch gate was removed at the project owner's request and is no longer a mandatory release gate.)

## 1. Scope

- **Solidity:** all first-party contracts under `packages/contracts/src` — `BinaryPoolMarket`, `MarketFactory`, `PredictionEntryRouter`, `SafeClosingPriceResolver`, `DataStreamsRwaResolver`, `ChainlinkPriceResolver`, `OracleRegistry`, `ProtocolTimelock`, `FeeVault` — plus deploy scripts and Foundry tests.
- **Offchain:** API (`apps/api`: funding, attribution, quotes, analytics, health, CORS, rate limiting, security headers), worker (`apps/worker`: indexer, reorg rollback, token discovery), environment validation (`packages/config`), web transaction construction (`apps/web`), GitHub deployment workflow (`.github/workflows/deploy-mainnet.yml`), AWS runtime templates (`infrastructure/aws`), secret handling across the repository.
- **Evidence:** `audit/` Safe ceremony artifacts (EIP-712 payload, attestation, signatures, hash manifest) and the mainnet fork rehearsal.
- **Excluded:** custody inspection of signer hardware, legal/compliance opinions, third-party audits, live production monitoring, and any action on mainnet. **No transaction was broadcast and nothing was deployed to mainnet during this review.** All mainnet interactions were read-only calls and fork tests.

## 2. Verification performed and results

| Check                                        | Command                                                                            | Result                                                                                                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint (TS workspaces)                         | `pnpm turbo lint --filter='!@pl/contracts'`                                        | Pass (post-remediation)                                                                                                                                                                                                                               |
| Contract formatting                          | `forge fmt --check`                                                                | Pass against committed LF content; local worktree fails only due to Windows `core.autocrlf` checkout artifact — fixed by added `.gitattributes` (ISR-05)                                                                                              |
| Typecheck                                    | `pnpm typecheck`                                                                   | Pass                                                                                                                                                                                                                                                  |
| Unit/integration/fuzz/invariant (TS)         | `pnpm test`                                                                        | Pass                                                                                                                                                                                                                                                  |
| Solidity suite                               | `forge test --root packages/contracts`                                             | **106 tests passed, 0 failed** (includes fuzz and invariant suites)                                                                                                                                                                                   |
| Production build                             | `pnpm build`                                                                       | Pass                                                                                                                                                                                                                                                  |
| Dependency advisories                        | `pnpm audit --json`                                                                | **0 vulnerabilities** after remediation (previously 1 moderate + 1 low, both dev-only esbuild)                                                                                                                                                        |
| Mainnet oracle fork rehearsal                | `pnpm oracle:rehearse` with `RPC_HTTP_URL=https://rpc.mainnet.chain.robinhood.com` | Pass — `SafeClosingPriceResolverForkTest` on a live chain-4663 fork                                                                                                                                                                                   |
| Secret scan                                  | pattern scan of all committed files (counts only, no values printed)               | No committed `.env`/key files; no cloud, API-key, or private-key patterns. 64-hex-char literals are public ceremony signatures, transaction hashes, and oracle round IDs in `audit/` and `docs/`                                                      |
| Static analysis (Slither, Semgrep, Gitleaks) | binary checks                                                                      | **Unavailable on this machine** (command not found). Same limitation as the 2026-09-07 pre-audit. Compensating controls: full Foundry fuzz/invariant suites and a targeted manual pattern scan. This limitation is disclosed to the external reviewer |

### Ceremony evidence verification (independent recheck)

Verified on chain 4663 via the official public RPC, read-only:

- Safe `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39` — Safe v1.4.1, owners `0xa5e7…7f7A`, `0x2603…812D`, `0x8cA7…A165`, threshold 2. Matches the ceremony record exactly.
- Ceremony transaction `0xc314cc2a…3fb4b6` — status success, targeted at the Safe, block `55120772`. Matches the record.
- `audit/safe-ceremony-attestation-v1.txt` SHA-256 matches the `ceremonyMessageSha256` bound inside the signed EIP-712 payload.
- `deploymentAuthorized` in the signed payload is `false` — the evidence records readiness only and does not authorize deployment.

**Not verified — see ISR-01/ISR-02:** the two recorded owner signatures could not be reproduced by an independent verifier, and the evidence pins an older release candidate.

## 3. Findings summary

| ID     | Severity             | Title                                                                                                     | Location                                                                                | Status                                                                                    |
| ------ | -------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ISR-01 | High                 | Ceremony signatures not independently reproducible; EIP-712 payload structurally invalid                  | `audit/safe-ceremony-eip712-v1.json`, `audit/safe-ceremony-metamask-signatures-v1.json` | Open — re-record ceremony against final RC                                                |
| ISR-02 | Medium               | Ceremony evidence binds rc1, not the current candidate; artifact manifest not cross-platform reproducible | `audit/ARTIFACTS.sha256`, `audit/safe-ceremony-attestation-v1.txt`                      | Open — regenerate at final RC                                                             |
| ISR-03 | Medium               | Dev-only esbuild advisories (GHSA-67mh-4wv8-2f99, GHSA-g7r4-m6w7-qqqr)                                    | root/vitest/vite, drizzle-kit, tsup dependency chains                                   | **Remediated this review** — workspace override to esbuild 0.28.2; `pnpm audit` now clean |
| ISR-04 | Low                  | Missing `.gitattributes` breaks formatting checks and hash verification on Windows checkouts              | repository root                                                                         | **Remediated this review** — `.gitattributes` pins LF for text sources                    |
| ISR-05 | Informational        | Web client trusts API-provided approval spender                                                           | `apps/web/components/pay-with-token.tsx`                                                | Accepted with rationale                                                                   |
| ISR-06 | Informational        | Deployer private key passed on command line in deploy workflow                                            | `.github/workflows/deploy-mainnet.yml`                                                  | Accepted for one-time deployer                                                            |
| PL-01  | Critical launch gate | Independent audit and remediation absent                                                                  | entire contract system                                                                  | Open (external)                                                                           |
| PL-04  | High                 | Counsel-approved eligibility/compliance policy absent                                                     | product and API enforcement                                                             | Open (external)                                                                           |
| PL-11  | High                 | Production Data Streams retrieval not commissioned                                                        | oracle configuration                                                                    | Open (external; not required for the closing-price route)                                 |
| PL-07  | Medium               | Production paging and staging load evidence incomplete                                                    | monitoring                                                                              | Open (external)                                                                           |

## 4. Detailed findings

### [HIGH] ISR-01 — ceremony signature evidence is not independently reproducible

- **Location:** `audit/safe-ceremony-eip712-v1.json` (domain name "Prediction Layer Safe Ceremony"), `audit/safe-ceremony-metamask-signatures-v1.json`
- **Category:** Evidence integrity / governance
- **Description:** The EIP-712 payload declares `auditCandidateCommit` as `bytes32` but fills it with a 20-byte git commit hash. Strict EIP-712 validators (including `viem` and standard libraries) reject the payload outright as malformed. Attempted independent verification of both recorded signatures failed under every plausible scheme: EIP-712 with the raw 20-byte value, EIP-712 with the left-padded 32-byte encoding, and EIP-191 `personal_sign` over 20+ candidate messages (attestation text in LF/CRLF forms, its SHA-256 in string/binary forms, the payload JSON raw and minified, and its hashes). The recorded claim "cast wallet verify succeeded" could therefore not be reproduced from repository contents. The on-chain Safe facts themselves (§2) do verify.
- **Exploit scenario:** Deployment authorization relies on signer evidence that no external reviewer can re-verify. A forged, coerced, or stale signature file would be indistinguishable from a genuine one at audit time, allowing an unauthorized party to argue — or operators to mistakenly accept — that the owner set approved a release they never saw.
- **Impact:** Loss of the cryptographic link between the Safe owner set and the release decision; the entire ceremony record is contestable.
- **Likelihood:** The mismatch is demonstrated; whether it originates from a signing-tool encoding quirk or a payload edited after signing cannot be determined from the repository.
- **Remediation (required before any deployment authorization):** fix the payload schema (encode the commit as a full 32-byte value, e.g. `bytes32(uint256(uint160(bytes20(commit))))` or keccak256 of the tag), re-sign with at least two owners against the **final** release candidate, run the ceremony tool unchanged so `eth_signTypedData_v4` receives a schema-valid payload, and commit a reproducible verification command (e.g. `cast wallet verify` invocation with exact inputs) together with its output. Keep `deploymentAuthorized` false until all other gates close.

### [MEDIUM] ISR-02 — ceremony evidence binds rc1; artifact manifest is not reproducible cross-platform

- **Location:** `audit/ARTIFACTS.sha256`, `audit/safe-ceremony-attestation-v1.txt` ("Audit release tag: prediction-layer-mainnet-audit-rc1", "Audit candidate commit: 2a207ea…")
- **Category:** Evidence integrity / release management
- **Description:** The signed payload and attestation pin candidate commit `2a207ea` (tag rc1), while the current candidate is rc4 (`9f11dcc`) plus `8d1d78d`. Re-computing the manifest against the reviewed HEAD fails for 15 files — exactly the files changed by the closing-price resolver work and the product rename. Additionally, the manifest hashes were computed over CRLF working-tree files on Windows; they cannot be reproduced from git blobs (LF), so no other platform or CI job can verify the manifest.
- **Exploit scenario:** A release is cut after rc1 with altered oracle or market behavior, while the ceremony record still appears to attest "the audited candidate"; reviewers checking the manifest against the real release see failures that can be hand-waved as line-ending noise, masking a genuine substitution.
- **Impact:** The ceremony does not cryptographically bind the release it is cited for; the audit trail has a two-candidate gap.
- **Likelihood:** Certain as a state of fact (verified); exploitation requires a subsequent undetected change, which the tag immutability of rc2–rc4 currently mitigates.
- **Remediation:** after this review's remediation commit, regenerate `ARTIFACTS.sha256` from git blob content (document the exact command, e.g. `git ls-files | xargs git cat-file blob` hashing), update the attestation to name the new RC tag and commit, and re-run the ceremony per ISR-01 so the signed payload binds the tagged candidate that will actually be deployed.

### [MEDIUM] ISR-03 — dev-only esbuild advisories — remediated

- **Location:** dependency graph: root `esbuild` devDependency and `vitest>vite` chain (0.24.2, GHSA-67mh-4wv8-2f99 moderate); `drizzle-kit>@esbuild-kit` (0.18.20, same advisory); `tsup>bundle-require` (0.27.7, GHSA-g7r4-m6w7-qqqr low)
- **Category:** Supply chain (build tooling only)
- **Description:** All affected esbuild copies were development-only transitive dependencies; none are shipped in production runtime images. Upgrading: the workspace now pins `esbuild: 0.28.2` via `pnpm-workspace.yaml` `overrides` (note: pnpm 11 ignores `pnpm.overrides` in `package.json`; the workspace-file location is required) with the root devDependency bumped to `^0.28.2`.
- **Exploit scenario:** A malicious build-time compromise of esbuild could inject code into built artifacts; dev-only scope means no runtime exposure, but build outputs are deployment-relevant.
- **Impact:** Build-chain integrity risk only.
- **Likelihood:** Low; both advisories require specific local-server conditions.
- **Remediation and verification:** override applied, full reinstall, and re-run of `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm turbo lint --filter='!@pl/contracts'`, `pnpm db:generate` (exercises drizzle-kit on the forced esbuild) — all pass; `pnpm audit --json` reports **0 vulnerabilities**. No regression test is added because no application code changed.

### [LOW] ISR-04 — missing `.gitattributes` breaks local verification on Windows — remediated

- **Location:** repository root
- **Category:** Tooling / evidence reproducibility
- **Description:** With `core.autocrlf=true` (common on Windows), checked-out sources become CRLF while the index is LF. This review observed two concrete failures: `forge fmt --check` reports every `.sol` file as unformatted despite committed content being clean (verified by re-checking an LF export of `HEAD`), and any file-hash manifest computed in one mode silently mismatches the other (contributing to ISR-02).
- **Impact:** False lint failures and non-reproducible evidence hashes; no runtime or contract effect.
- **Remediation:** added a root `.gitattributes` pinning `eol=lf` for text source types (`.sol`, `.ts`, `.tsx`, `.md`, `.json`, `.yml/.yaml`, `.mjs`, `.css`). Index content is unchanged; only checkout behavior is normalized.

### [INFORMATIONAL] ISR-05 — web client trusts API-provided approval spender

- **Location:** `apps/web/components/pay-with-token.tsx:238,282,332`
- **Description:** The client approves whatever spender the quote response names (`approvalSpender` / `entryRouter`). The API constrains this server-side to code-verified Uniswap proxies or the governance-allowlisted router, and approvals are exact-amount and cleared after use, so a compromised API is already game-over and the exact-amount approval bounds the blast radius. Defense-in-depth improvement (optional): pin expected spender addresses in the client bundle and reject quotes naming anything else.

### [INFORMATIONAL] ISR-06 — deployer key on the command line in CI

- **Location:** `.github/workflows/deploy-mainnet.yml`
- **Description:** `forge script --private-key` receives the key from a GitHub secret; it is visible in the ephemeral runner's process list and shell history. GitHub-hosted runners are single-use VMs and the key is expected to be a one-time deployer with a capped balance (per `docs/deployment-identity-2026-09-07.md`), which is the accepted mitigation. No change required; do not reuse a general-purpose key for this step.

## 5. Contract review assurance notes (no new vulnerabilities found)

Properties verified by direct review and by the test suites:

- **Solvency:** payout math uses `Math.mulDiv` with floor rounding against actual pool balances; entry requires an exact balance delta (fee-on-transfer rejection); admin cannot withdraw user principal; fee capped at 10% and charged on profit only.
- **Reentrancy and ordering:** `nonReentrant` on all entry/resolve/claim/refund paths and the router; router clears approvals on every path, refunds unused input, and enforces deadline plus `minimumUsdg`.
- **Oracle binding:** markets snapshot the resolver config hash at creation and refuse resolution if the oracle is reconfigured; scheduled-close markets must use `SafeClosingPriceResolver` or `DataStreamsRwaResolver`, which both bind the reference time (PL-08 remediation). **Operational constraint retained: `ChainlinkPriceResolver` ignores `referenceTime` by design and must never back a scheduled-close market** — governance must configure markets accordingly, and the external audit should retest this constraint.
- **Fail-closed oracles:** all three resolvers revert on paused/stale/unreadable state; the closing-price resolver gates on an immutable, challenge-period-delayed observation; permissionless `cancelAfterOracleTimeout` refunds users without governance when the oracle cannot resolve.
- **Governance boundary:** `ProtocolTimelock` has a constant 2-day delay with the Safe as sole proposer/executor and no admin; all privileged contracts are owned by it in the production deploy script; the deploy workflow is manual, environment-gated, requires a typed confirmation and an on-chain preflight that re-verifies Safe owners/threshold, canonical USDG, fee recipient, and both approval flags.
- **Offchain trust boundaries:** API production mode fails closed; quote/swap plans are validated against allowlisted, code-verified spenders with Permit2 explicitly disabled and zero ETH value; attribution re-verifies signature, quote match, both transactions' senders/targets/calldata, swap-before-entry ordering, quote expiry at inclusion, canonical collateral received, and enforces idempotency under advisory locks; the worker's projections are idempotent per `(chainId, txHash, logIndex)` and reorg rollback deletes strictly by block range.

## 6. Limitations

- **Not independent.** Performed by the implementing engineering team. It must not be represented as an external audit. PL-01 (independent audit with signed remediation/retest) remains open and blocking.
- **No static analyzers.** Slither, Semgrep, and Gitleaks were unavailable; compensating coverage is described in §2.
- **No dynamic exploitation** against live systems; mainnet access was read-only RPC and fork tests only.
- **Not covered:** hardware custody, AWS account-level evidence, Data Streams account credentials, legal opinions, and anything outside this repository.

## 7. Conclusion

No new exploitable vulnerability was identified in the reviewed contracts or offchain trust boundaries at commit `8d1d78d`. The dependency advisories and the formatting/evidence tooling gaps found by this review were remediated in this review's changes (ISR-03, ISR-04). The blocking items before any mainnet deployment are: re-recorded, independently verifiable ceremony evidence bound to the final release candidate (ISR-01, ISR-02), and the external gates PL-01, PL-04, PL-11, PL-07. Mainnet remains **NO-GO**. `MAINNET_EXTERNAL_AUDIT_APPROVED` and `MAINNET_COMPLIANCE_APPROVED` remain false. (Update 2026-09-13: the ceremony evidence was re-recorded and verified against the release candidate; the external-audit gate was removed at the owner's request; compliance approval is owner-provided; core contracts were deployed to mainnet on 2026-09-13.)
