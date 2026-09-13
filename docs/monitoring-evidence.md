# Monitoring and staging evidence

The API exposes `/health` and `/metrics`. `pnpm monitor:once` checks both and can post a compact JSON alert to `ALERT_WEBHOOK_URL`, stored only in the production secret manager. Schedule it from an independent region every minute.

The `prediction-layer-production-monitoring` CloudFormation stack creates a CloudWatch dashboard, an SNS alert topic, and alarms for RDS CPU, RDS free storage, Valkey engine CPU and Valkey memory. CloudWatch is permitted to publish only matching Wagerly alarm events from the production AWS account. The operator must subscribe and confirm the approved on-call destination before traffic is enabled; an SNS topic without a confirmed subscription is not paging evidence.

Required remaining destinations are centralized API/worker logs, RPC dashboards, and alerts for indexer lag, reorg rollback, quote failure and Safe/timelock activity. Vendor account URLs, retention, the WalletConnect project ID and the monitoring webhook remain pending operator selection or account-owner access.

Local evidence on 2026-09-05: 200 requests at concurrency 20, zero failures, p95 64 ms. Staging evidence must record commit, region, service sizes, database/RPC provider, request mix, duration, p50/p95/p99, errors, saturation and recovery.

## AWS evidence — 2026-09-07

- Stack: `prediction-layer-production-monitoring` in `eu-west-1`
- Dashboard: `prediction-layer-production`
- Alert topic: `prediction-layer-production-alerts`
- Data resources: RDS `prediction-layer-production`; cache `prediction-layer-production-001`
- Paging status: pending a confirmed topic subscription
- Application/RPC alarms: pending deployment of the API and worker behind the dedicated production RPC

## AWS evidence — 2026-09-10

- Foundation, data, monitoring and migration stacks are `IN_SYNC` in `eu-west-1`.
- ECS services: none (desired count remains zero).
- SNS topic still has zero subscriptions; paging is not satisfied.
- Application log-metric alarms are prepared in `infrastructure/aws/monitoring.yml` and have not been applied to the live monitoring stack.
- Full non-secret record: `docs/aws-operations-evidence-2026-09-10.md`.

## AWS evidence — 2026-09-13

- `Backend container images` workflow succeeded at commit `7c1aeee`; ECR digests: api `sha256:eb95f36e24c2…3117779923ed64`, worker `sha256:5f4f93104192…9923ed64` (full digests in `docs/aws-operations-evidence-2026-09-13.md`).
- Migration task `prediction-layer-production-migrate:5` ran against production PostgreSQL with exit code 0 ("migrations applied successfully").
- ECS services `prediction-layer-production-api` and `prediction-layer-production-worker` created on Fargate (1 task each, deployment circuit breaker with rollback); both RUNNING and service-stable on task definitions api `:3` / worker `:2` (image tag `sha-7c1aeee…`).
- API `/health` returned `{"ok":true,"db":"up","redis":"up"}` and `/metrics` returned 200 via a temporary, single-IP security-group rule that was revoked immediately after the check; the app security group has no ingress rules now.
- Worker indexing from `START_BLOCK=62191277` (factory deployment block); cursor advancing through live blocks with token discovery.
- Worker hardening shipped at `7c1aeee`: WS transport probed at startup with HTTP fallback, startup reads retry through provider 429s, indexing serialized, and all worker error logs redact URLs/keys (earlier Alchemy key-in-URL leak incident recorded in `docs/aws-operations-evidence-2026-09-13.md`).
- Monitoring stack updated: 18 alarms (RDS CPU/storage, Valkey CPU/memory, indexer lag, reorgs, rollback failures, RPC failures, quote failures, API health, oracle cancels, timelock proposals, ECS CPU/memory per service, per-service `LiveTaskCount` floor) plus a 4-widget dashboard; all alarms OK as of 23:10 UTC.
- SNS subscription created for `noreply@mag7.vault` (email protocol) — **pending confirmation click**; paging still not satisfied until confirmed.
- Non-destructive test alert published to the topic (SNS MessageId `10789f16-bd9b-5665-b545-fc379c2f8f73`).
- Data Streams: authentication succeeds and all 9 live Robinhood V11 equity streams resolve, but report fetches return "feeds not authorized" — the API key needs the feed IDs added to its entitlement (owner action).
