# scripts

Local development helpers and one-shot tooling.

| Command                                | What it does                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm dev:infra`                       | `docker compose up -d postgres redis` (root `docker-compose.yml`)                            |
| `pnpm dev:infra:down`                  | Stop infra containers                                                                        |
| `pnpm contracts:local`                 | Deploy the local vertical slice to anvil; writes `packages/contracts/deployments/local.json` |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migration generate/apply                                                             |
| `pnpm seed`                            | Load `deployments/local.json` into Postgres (idempotent; inert without local infra)          |

A full local runbook from a clean clone lives in the repo `README.md`.

Later milestones add:

- `scripts/e2e-local.mjs` — Playwright vertical slice (connect wallet → MockPONS swap → enter → resolve → claim) per `07_TESTING_AND_ACCEPTANCE.md`,
- mainnet-fork test drivers (never broadcast real transactions).
