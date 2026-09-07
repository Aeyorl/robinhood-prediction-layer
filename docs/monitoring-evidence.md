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
