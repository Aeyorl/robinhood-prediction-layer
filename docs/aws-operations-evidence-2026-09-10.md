# AWS operations evidence — 2026-09-10

Account `498287372410`, region `eu-west-1`. No secret values, RPC paths, or private keys are recorded here.

## Credential and RPC checks

| Check                                                                             | Result                                                   |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `RPC_HTTP_URL` / `RPC_WS_URL` keys in `prediction-layer/production/rpc-endpoints` | present                                                  |
| HTTP host                                                                         | `robinhood-mainnet.g.alchemy.com` over HTTPS             |
| WebSocket host                                                                    | `robinhood-mainnet.g.alchemy.com` over WSS               |
| HTTP `eth_chainId`                                                                | 4663                                                     |
| WebSocket `eth_chainId`                                                           | 4663                                                     |
| `newHeads` subscription                                                           | succeeded; head block `59674288` at 2026-09-10T20:02:49Z |

Data Streams secret keys map as:

- `API_KEY` → `DATA_STREAMS_API_KEY`
- `USER_SECRET` → `DATA_STREAMS_USER_SECRET`
- `ENDPOINT` → `DATA_STREAMS_ENDPOINT` (`api.dataengine.chain.link`)

The Data Streams secret existed only in `us-east-1`. It was replicated to `eu-west-1` as `arn:aws:secretsmanager:eu-west-1:498287372410:secret:prediction-layer/production/data-streams-TF8zd3` with the same three keys so ECS in this region can read it. Values were not printed.

Authenticated discovery of live AAPL/NVDA/TSLA v11 mainnet streams returned **9** feeds. IDs match `packages/chain-config/src/oracles.ts`. Market-hour labels are now `US Equities Regular`, `US Equities Extended`, and `US Equities Overnight`. A query with `hidden=true` returns zero extra entitled streams for this key.

`node scripts/run-data-streams-verify.mjs` succeeded at 2026-09-10T20:02Z after the discovery script was changed to treat hidden streams as additive.

## Stacks

All four stacks are healthy and drift-free (`IN_SYNC`):

| Stack                                    | Status          | ID                                                                                                                                |
| ---------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prediction-layer-production-foundation` | UPDATE_COMPLETE | `arn:aws:cloudformation:eu-west-1:498287372410:stack/prediction-layer-production-foundation/a6325a70-aa41-11f1-9b72-02bd0c9e02a3` |
| `prediction-layer-production-data`       | CREATE_COMPLETE | `arn:aws:cloudformation:eu-west-1:498287372410:stack/prediction-layer-production-data/d147b610-aa41-11f1-9f13-02687e53097f`       |
| `prediction-layer-production-monitoring` | CREATE_COMPLETE | `arn:aws:cloudformation:eu-west-1:498287372410:stack/prediction-layer-production-monitoring/63f9ce50-aa4f-11f1-845a-0616eeaabe7d` |
| `prediction-layer-production-migration`  | UPDATE_COMPLETE | `arn:aws:cloudformation:eu-west-1:498287372410:stack/prediction-layer-production-migration/0bd415f0-aa45-11f1-a67a-064058d15bc9`  |

No `prediction-layer-production-runtime` stack exists. ECS cluster `prediction-layer-production` has **zero services** (desired count remains zero).

## Data plane

- Application SG `sg-07da3774ec4bd3fc0` has no ingress and egress `0.0.0.0/0`.
- RDS SG allows TCP 5432 only from the application SG. Instance `prediction-layer-production` is available, not public, storage encrypted.
- Cache SG allows TCP 6379 only from the application SG. Replication group is available with transit and at-rest encryption.
- Database endpoint hostname: `prediction-layer-production.cje4cmymoqjr.eu-west-1.rds.amazonaws.com`
- Cache endpoint hostname: `master.prediction-layer-production.khfw6s.euw1.cache.amazonaws.com`

## Images, IAM, logs

ECR repositories `prediction-layer/api`, `prediction-layer/worker`, and `prediction-layer/migrate` exist, are immutable, and scan on push. RC5 tag `sha-8d134efe6e3c65e70d1509628d8b6932ee6d3bb8` is present:

| Image   | Digest                                                                    |
| ------- | ------------------------------------------------------------------------- |
| api     | `sha256:7adacb6e85eda8cef3da0b185cec8454a4cdc7cb74bafcfda8b9890016e52aa9` |
| worker  | `sha256:2d61e3cdf7ba4d7bce937470c00a54cdebd1de38e34b13a37b4b00837612a767` |
| migrate | `sha256:e27c64f7c36100e4ef88444ec8dee6c01d8b5054265f3ec010509796087febe3` |

Task execution role `prediction-layer-production-task-execution` can `GetSecretValue` only on `arn:aws:secretsmanager:eu-west-1:498287372410:secret:prediction-layer/production/*`. Task role has no extra policies.

Log groups `/ecs/prediction-layer/production/{api,worker,migrate}` have 30-day retention and no customer-managed KMS key.

## Monitoring gaps

- Topic `arn:aws:sns:eu-west-1:498287372410:prediction-layer-production-alerts` has **no subscriptions**.
- Live alarms are only RDS CPU, RDS storage, Valkey CPU, and Valkey memory (all OK).
- Application alarms for API health, indexer lag, reorg, quote failure, RPC failure, and Safe/timelock activity are drafted in `infrastructure/aws/monitoring.yml` and are **not applied** until the monitoring stack update is approved.

## Not done

- SNS on-call subscription
- Customer-managed log encryption
- Runtime stack / ECS services (must stay at zero until contracts and health checks exist)
- Database snapshot, migration task, and image rebuild from current `main`
