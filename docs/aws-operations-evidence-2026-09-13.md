# AWS operations evidence — 2026-09-13

Classification: internal operations record. No secret values are contained in this file.

## Container images (immutable digests)

Built by the `Backend container images` workflow from commit `55fa1c4cb6df75589d2614418cab197d11bd33fc` (run 34783420476) and commit `7c1aeee737305eb2220cc8a829929d0c8dd6c39b` (run 34784990511):

| Repository                 | Tag                                            | Digest                                                                    |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `prediction-layer/api`     | `sha-7c1aeee737305eb2220cc8a829929d0c8dd6c39b` | `sha256:eb95f36e24c2306da0337e53700b314a1bcfc7273d0f40cb952bd6326ea49259` |
| `prediction-layer/worker`  | `sha-7c1aeee737305eb2220cc8a829929d0c8dd6c39b` | `sha256:5f4f931041921d84b88033de8564d5470686978bcf2e8152183117779923ed64` |
| `prediction-layer/migrate` | `sha-55fa1c4cb6df75589d2614418cab197d11bd33fc` | `sha256:caaa4e2fb3f1be84b7556a1f2647350a0fdc1257da4abfa5c36a55981a443651` |

## GitHub OIDC fix

- Role `prediction-layer-production-github-images` rejected `sts:AssumeRoleWithWebIdentity` because its subject condition named `Aeyod7@234510671` (pre-transfer owner).
- CloudTrail showed the live subject GitHub issues for this repository is `repo:Mag7-vault@234510671/robinhood-prediction-layer@1356669085:ref:refs/heads/main` (the `owner@userID/repo@repoID` form, not the plain `owner/repo` form).
- Trust policy updated to exactly that subject with audience `sts.amazonaws.com`. No broadening to other repos, branches, or identities.

## Runtime deployment

- Stack `prediction-layer-production-runtime` created with task definitions api `:3`, worker `:2` (image tag `sha-7c1aeee…`), `START_BLOCK=62191277`, `CORS_ORIGIN=https://www.usepoku.fun`, `MAINNET_COMPLIANCE_APPROVED=true`, chain `4663`; all credentials injected from Secrets Manager at task start.
- `prediction-layer-production-migrate:5` executed with exit code 0 against production PostgreSQL before any service started.
- Services `prediction-layer-production-api` and `prediction-layer-production-worker` run 1 Fargate task each behind the application security group with public IPs for egress; deployment circuit breaker with automatic rollback.
- API `/health` verified: `{"ok":true,"db":"up","redis":"up"}`; `/metrics` returned HTTP 200. The temporary single-IP ingress rule used for the check (port 3001, my /32) was revoked immediately after; the app security group has zero ingress rules again.

## Incidents during rollout (both remediated)

1. **USDG_ADDRESS integer collapse.** The runtime template's unquoted hex literal was parsed by CloudFormation as a number and passed to the API as a decimal string, failing Zod validation and crash-looping the task. Fixed by quoting the value in `infrastructure/aws/runtime.yml` (commit `848f095`).
2. **Alchemy key exposed in logs.** The worker crashed on a provider 429 and printed the WebSocket URL including the embedded Alchemy key to CloudWatch. Remediations: worker redaction helper on every error log, WS probe at startup with HTTP fallback, startup retries, serialized indexing (commit `7c1aeee`). **The exposed Alchemy key should be rotated** — the log group `/ecs/prediction-layer/production/worker` contains one stream with the key; consider expiring that stream's retention or rotating the key in `prediction-layer/production/rpc-endpoints`.

## Data Streams verification (server-side, no values printed)

- Secret `prediction-layer/production/data-streams` fields: `API_KEY`, `USER_SECRET`, `ENDPOINT` — names match application expectations.
- HMAC authentication **succeeds** (`/api/v1/discovery` returns 200 with signed requests; unsigned/mismatched requests fail closed).
- All 9 live Robinhood V11 equity streams resolve: AAPL/NVDA/TSLA × Regular/Extended/Overnight hours.
- Report fetch (`/api/v1/reports/latest?feedID=…`) returns **401 "feeds not authorized"** for every feed — the key's entitlement does not include these feed IDs. Owner must add the feed IDs in the Data Streams console; until then the worker cannot validate closing-price evidence and scheduled-equity resolution cannot use Data Streams.
- Candlestick key is stored separately and is not used for Data Streams HMAC.

## Monitoring

- Monitoring stack now owns 18 alarms and a 4-widget dashboard (PostgreSQL, Valkey, ECS services, indexer/oracle events).
- `RunningTaskCount` is not published for these services; per-service floor alarms use `LiveTaskCount` with `TreatMissingData: breaching`.
- All alarms OK as of 23:10 UTC 2026-09-13.
- SNS email subscription for `noreply@mag7.vault` created — **pending confirmation**; a non-destructive test alert was published (MessageId `10789f16-bd9b-5665-b545-fc379c2f8f73`).
