# Grok Build handoff — finish Poku production readiness

Copy everything below the divider into Grok Build.

---

Work on the Poku Prediction Layer repository:

```text
C:\Project folder\robinhood-prediction-layer-docs
GitHub: https://github.com/Aeyod7/robinhood-prediction-layer
Branch: main
Starting baseline before this handoff package: b393a97af5215cccdaa5ffa26c125b5be64fd968
Production web: https://robinhood-prediction-layer.vercel.app
Robinhood Chain mainnet chain ID: 4663
```

Read `AGENTS.md`, `README.md`, `CODEX_MASTER_PROMPT.md`, this handoff, and the
files named below before editing. Inspect `git status`, `git log -1`, and the
remote branch. Preserve unrelated work and do not reset or rewrite history.

## Product and operating objective

Finish the production infrastructure, release ceremony, deployment packaging,
backend synchronization, and operational readiness for Poku, a prediction
market product on Robinhood Chain. Preserve the approved Poku name and current
visual design. Public discovery is already live. Deposits, swaps, position
entry, market creation and contract deployment must remain disabled until the
corresponding production contracts and backend are verified.

This handoff intentionally excludes security-audit work. Do not perform,
commission, write, request, or claim a security audit. Do not add an audit task
to the completion report. Preserve existing historical review files because
they are part of repository history, but do not present them as current product
approval and do not delete or rewrite them.

## Fixed governance identities

- Shared MAG7/Poku Safe: `0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39`
- Verified current Safe nonce on 2026-09-10: `6`
- Safe threshold: `2 of 3`
- Safe owners:
  - `0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A`
  - `0x26032745BcB969B95B4610A9a48D33Bd4340812D`
  - `0x8cA71B70C91BD8250073dfDD323b9219Bce6A165`
- One-time deployer: `0x913B8D346625736958664C77b0C8Efd3DA2a7bA2`
- Existing MAG7 timelock and immutable Poku fee recipient:
  `0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8`
- Poku must deploy its own `ProtocolTimelock`, controlled by the shared Safe.
  Do not reuse the MAG7 timelock as Poku's protocol owner or operation queue.
- Poku timelock delay: `172800` seconds.
- Canonical USDG: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`
- Canonical WETH: `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`
- Uniswap Universal Router candidate:
  `0x8876789976decbfcbbbe364623c63652db8c0904`
- Chainlink Data Streams verifier candidate:
  `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`

Re-read all public addresses from official/current sources and verify bytecode
on chain 4663 before using them. Never silently substitute an address.

## Current completed state

### Web product

- Approved two-sided light landing page is restored.
- Markets, Communities, Leaderboard and Portfolio use their approved section
  designs and responsive styling.
- Market discovery and detail pages exist for stock and Robinhood Chain
  memecoin markets.
- Memecoin discovery is server-side, filters DexScreener results to
  `chainId=robinhood`, applies configurable market-cap and liquidity screens,
  caches results, and has an honest unavailable-data state.
- The featured Market Signals orb has entrance, count-up, pulse, sweep, drift,
  pointer parallax and reduced-motion behavior.
- Trading remains disabled and the UI states that it opens only after onchain
  deployment and final checks.
- Vercel production currently serves the read-only product.

### Contract and release package

- Final release tag: `prediction-layer-mainnet-audit-rc5`
- Final release commit: `8d134efe6e3c65e70d1509628d8b6932ee6d3bb8`
- V2 ceremony payload: `audit/safe-ceremony-eip712-v2.json`
- Reproducible release manifest: `audit/ARTIFACTS-rc5.sha256`
- Manifest SHA-256:
  `f9d5fc1dd7bcd255bdc4f7bc10ddfdc82361b32ac9cb210a3d1b28f08380bc79`
- V2 typed-data hash:
  `0xb2314caed249d60ca133768e95135a5073769b6358cc2aa23edcc421c20cec2c`
- `deploymentAuthorized` is intentionally `false`.
- Manifest generator: `scripts/release-manifest.mjs`
- Signature verifier: `scripts/verify-safe-ceremony.mjs`
- Local signer: `tools/safe-ceremony/`
- Private recovery template exists locally at
  `private/safe-recovery-controls.md` and is excluded through
  `.git/info/exclude`. Never commit or print it.
- The Foundry timelock rehearsal deploys a new timelock, schedules a harmless
  call, confirms early execution reverts, advances 48 hours, executes, and
  confirms completion.
- Latest full Solidity result after adding the rehearsal: `107 passed, 0
failed`.

### Production infrastructure already represented in code

- AWS CloudFormation templates exist in `infrastructure/aws/`:
  `foundation.yml`, `data.yml`, `monitoring.yml`, `migration.yml`, and
  `runtime.yml`.
- Existing evidence says the foundation, data and monitoring stacks were
  created in `eu-west-1`.
- RDS, encrypted Redis/Valkey, ECR, ECS/IAM foundation, CloudWatch dashboard,
  alarms and the SNS topic are defined.
- AWS Secrets Manager entries include:
  - `prediction-layer/production/rpc-endpoints`
  - `prediction-layer/production/data-streams`
- The Data Streams secret uses keys `API_KEY`, `USER_SECRET`, and `ENDPOINT`.
- Alchemy Robinhood HTTP/WebSocket endpoints were stored privately. Do not
  display or copy their values into Git, logs, terminal arguments, or chat.
- Chainlink credentials were updated privately. Validate them without printing
  any field.
- ECS services must remain at desired count zero until migration, runtime
  secrets, deployed contract addresses and health checks are complete.

## Required work, in order

### 1. Reconcile the checkout

1. Fetch `origin/main` and compare it with local `HEAD`.
2. Inventory every dirty or untracked file before changing anything.
3. Preserve the private recovery file and unrelated user files.
4. Confirm the handoff commit is an ancestor of current `origin/main`.
5. Run the release manifest generator against RC5 and confirm its SHA-256 is
   byte-for-byte identical to the recorded manifest.

Commands:

```powershell
git status --short
git fetch origin main --tags
git rev-parse HEAD
git rev-parse origin/main
node scripts/release-manifest.mjs prediction-layer-mainnet-audit-rc5 audit/ARTIFACTS-rc5.verify.sha256
```

Compare the generated file to `audit/ARTIFACTS-rc5.sha256`, then remove only
the temporary verification file.

### 2. Finish the two-owner Safe ceremony

1. Serve the repository locally and open `tools/safe-ceremony/` in a browser
   with MetaMask.
2. Confirm the tool displays RC5, commit `8d134ef…e6d3bb8`, Safe nonce 6,
   threshold 2 and `Deployment authorized: NO`.
3. Have two different current Safe owners connect and sign separately.
4. Accept only the downloaded public JSON evidence. Never request a seed
   phrase, private key, PIN or recovery phrase.
5. Recover and verify both signer addresses against the current onchain owner
   set.
6. Copy only signer address, public signature, signing time and wallet type
   into `audit/safe-ceremony-metamask-signatures-v2.json`.
7. Set its status to `two-of-three-verified` only after
   `node scripts/verify-safe-ceremony.mjs` succeeds.
8. Record recovery-control checks in the private excluded file. Report only
   whether each required field is complete; never reveal its contents.

If the Safe nonce or owner set changes before signing, stop and regenerate the
V2 payload and public attestation rather than editing only the displayed text.

### 3. Validate production RPC and Chainlink credentials

1. Retrieve secrets through the production runtime identity or AWS
   CloudShell. Never echo them.
2. Confirm both Alchemy endpoints return chain ID 4663.
3. Confirm the WebSocket endpoint can subscribe and receive a new-head event.
4. Map stored secret keys to runtime variables exactly:
   - `RPC_HTTP_URL`
   - `RPC_WS_URL`
   - `DATA_STREAMS_API_KEY`
   - `DATA_STREAMS_USER_SECRET`
   - `DATA_STREAMS_ENDPOINT`
5. Run `pnpm data-streams:verify` with secrets injected into process memory.
6. Record only success/failure, feed count, feed IDs intended for configuration
   and timestamp. Do not record credential values.
7. Verify the selected v11 mainnet stream IDs and market-hours attributes for
   every stock market that will launch.

If Chainlink authentication fails, stop with the HTTP status and field-name
mapping. Do not replace production feeds with fabricated prices.

### 4. Finish AWS runtime infrastructure

1. Inspect current CloudFormation stack status in `eu-west-1`.
2. Confirm foundation, data and monitoring stacks are healthy and drift-free.
3. Confirm the application security group reaches RDS and Valkey privately.
4. Confirm ECR repositories exist for API, worker and migration images.
5. Confirm ECS execution/task roles can read only the required secrets.
6. Confirm log groups have explicit retention and encryption.
7. Subscribe the approved on-call destination to
   `prediction-layer-production-alerts` and confirm the subscription.
8. Add application alarms for API health, worker/indexer lag, reorg rollback,
   quote failures, RPC failure and Safe/timelock activity.
9. Keep ECS service desired counts at zero during this phase.
10. Record stack IDs, regions, outputs and non-secret ARNs in an operations
    evidence document.

Do not recreate working stacks under new names. Update existing stacks with the
smallest reviewed change.

### 5. Build immutable runtime images and prepare migration

1. Use `.github/workflows/container-images.yml` or the documented equivalent
   to build API, worker and migration images from one exact commit SHA.
2. Scan build logs for accidentally printed secrets.
3. Verify image digests in ECR and record them.
4. Deploy `migration.yml` with the exact migration image digest or immutable
   commit tag.
5. Take a database snapshot before migration.
6. Run the migration as a one-off ECS task in the application security group.
7. Require exit code zero and preserve the CloudWatch log-stream reference.
8. Run a backup/restore exercise into an isolated validation database and
   record the recovery result.

### 6. Prepare a reviewable mainnet deployment package

Do not broadcast yet.

1. Re-run all address, bytecode, Safe-owner and threshold reads.
2. Re-run the deployment simulation against fresh Robinhood Chain mainnet
   state with `--isolate` and without `--broadcast`.
3. Confirm the derived deployer equals
   `0x913B8D346625736958664C77b0C8Efd3DA2a7bA2` without printing the key.
4. Keep the bounded funding ceiling at `0.012 ETH`. If the fresh estimate
   exceeds it, stop rather than increasing it automatically.
5. Produce the exact ordered deployment transaction set, constructor
   arguments, predicted addresses, gas estimate and post-deployment read list.
6. Ensure every privileged Poku contract owner is the newly deployed Poku
   timelock, the shared Safe is sole proposer/executor/canceller, no external
   admin exists, and the deployer retains no role.
7. Keep `deploymentAuthorized` false and stop for explicit human review before
   any real Safe proposal, funding transfer or mainnet broadcast.

The product owner's previous general authorization does not replace approval
of the final concrete transaction package.

### 7. After explicit approval, deploy and verify contracts

Only continue here after the exact package from step 6 is explicitly approved.

1. Fund only the one-time deployer within the approved ceiling.
2. Use the protected manual GitHub mainnet workflow.
3. Preserve every transaction receipt and block number.
4. Verify deployed bytecode, source, constructor arguments and immutable
   values.
5. Confirm the new Poku timelock delay and roles onchain.
6. Confirm all protocol ownership and role separation onchain.
7. Update `packages/chain-config/src/addresses.ts` with verified checksummed
   addresses and deployment block.
8. Never publish simulated or predicted addresses as deployed addresses.

### 8. Perform the real 48-hour timelock rehearsal

1. Construct a harmless, state-limited rehearsal call.
2. Submit its schedule call through the shared Safe with two valid owners.
3. Record schedule transaction hash, operation ID, target, calldata, salt,
   block and exact ready time.
4. Confirm execution fails before `readyAt` using a read-only simulation.
5. Wait the complete 172800 seconds. Do not bypass or shorten the delay.
6. Execute through the shared Safe after readiness.
7. Verify the expected harmless state change and operation completion.
8. Record both Safe transaction hashes and chain receipts.

### 9. Start backend services safely

1. Deploy `runtime.yml` with the verified contract addresses, deployment block,
   immutable image digests and private secret ARNs.
2. Start the API at one task while the worker remains stopped.
3. Verify `/health`, `/metrics`, database access, Redis access, RPC chain ID,
   CORS, rate limits and fail-closed production configuration.
4. Start one worker task and verify backfill from the exact deployment block.
5. Confirm monotonic indexing, restart recovery and reorg rollback behavior.
6. Verify no duplicate events or projected positions are created.
7. Run a controlled RPC failure and confirm fallback, alerting and recovery.
8. Scale only after the single-task checks pass.

### 10. Connect Vercel to the production API

1. Set production Vercel variables without exposing secrets:
   - `NEXT_PUBLIC_CHAIN_ID=4663`
   - `NEXT_PUBLIC_LOCAL_CHAIN=false`
   - `NEXT_PUBLIC_API_URL=<verified HTTPS API URL>`
   - public RPC override only if intentionally approved
   - WalletConnect project ID only if WalletConnect is being enabled
2. Keep wallet transaction controls disabled until all post-deployment checks
   pass.
3. Deploy through GitHub `main` and verify Vercel reaches Ready.
4. Test desktop and mobile routes: `/`, `/markets`, representative stock and
   memecoin detail pages, `/communities`, `/leaderboard`, `/portfolio`, `/docs`,
   `/risks`, and `/terms`.
5. Check loading, empty, stale and unavailable-data states.
6. Confirm the product continues to say capital share is not guaranteed
   probability and is independent from Robinhood.

### 11. Controlled activation

Activation must be incremental:

1. Load only verified market templates and oracle/stream configurations.
2. Confirm `resolver.health(assetKey).healthy` and a nonzero config hash before
   each market is created.
3. Create a minimal initial market set with conservative limits.
4. Verify indexing and UI discovery before enabling any entry path.
5. Enable wallet connection separately from approval/entry actions.
6. Perform a bounded canary using the smallest approved amount.
7. Verify position creation, accounting, event indexing and displayed capital
   shares.
8. Test pause, cancellation, refund and claim paths with documented evidence.
9. Expand access only after canary and monitoring remain healthy.

## Required validation

Run the relevant checks after every change and all checks before release:

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
forge fmt --check --root packages/contracts
forge test --root packages/contracts
node scripts/verify-safe-ceremony.mjs
```

The repository test suite expects PostgreSQL and Redis for API/worker
integration tests. Start the documented local infrastructure instead of
calling connection-refused tests product failures. Do not claim a check passed
unless its actual command completed successfully.

## Hard boundaries

- Never expose AWS, Alchemy, Chainlink, Uniswap, WalletConnect or deployer
  secrets.
- Never request or store seed phrases or private keys.
- Never fabricate signatures, recovery evidence, feed IDs, contract addresses,
  transaction hashes, monitoring evidence or approvals.
- Never use Solana memecoin data. Discovery must remain Robinhood Chain only.
- Never claim Robinhood affiliation or endorsement.
- Never claim guaranteed probabilities or guaranteed returns.
- Never enable trading against placeholder, sample or simulated contracts.
- Never broadcast a mainnet transaction until the exact final transaction set
  has been shown and explicitly approved.
- Never shorten or bypass the 48-hour timelock.
- Never delete Poku branding or replace the approved page designs.

## Completion report

Return:

1. exact final Git commit and pushed branch;
2. production Vercel URL and deployment status;
3. Safe signature count and recovered signer addresses;
4. private recovery-record completeness as yes/no only;
5. AWS stack status and region;
6. non-secret runtime image digests and migration result;
7. verified deployed contract addresses and transaction hashes, if deployment
   was explicitly approved and completed;
8. Poku timelock address, role reads, delay, schedule/execute hashes and ready
   time, if the onchain rehearsal completed;
9. API/worker health, indexer checkpoint and alerting status;
10. every validation command and result;
11. deposits/trading state, stated explicitly;
12. remaining blockers and the single next required human action.

If any step requires credentials, wallet signatures, service-account access or
mainnet approval, finish every independent preparatory action first, then stop
at the smallest concrete user action with exact instructions.
