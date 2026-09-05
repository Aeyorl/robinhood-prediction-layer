# Monitoring and staging evidence

The API exposes `/health` and `/metrics`. `pnpm monitor:once` checks both and can post a compact JSON alert to `ALERT_WEBHOOK_URL`, stored only in the production secret manager. Schedule it from an independent region every minute.

Required destinations are an on-call webhook, centralized API/worker logs, RPC dashboards, and alerts for indexer lag, reorg rollback, quote failure, database saturation and Safe/timelock activity. Vendor account URLs and retention remain pending operator selection.

Local evidence on 2026-09-05: 200 requests at concurrency 20, zero failures, p95 64 ms. Staging evidence must record commit, region, service sizes, database/RPC provider, request mix, duration, p50/p95/p99, errors, saturation and recovery.
