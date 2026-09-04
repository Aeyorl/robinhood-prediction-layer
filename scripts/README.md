# scripts

Local development helpers and one-shot tooling.

| Command                                | What it does                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev:infra`                       | `docker compose up -d postgres redis` (root `docker-compose.yml`)                                                                                       |
| `pnpm dev:infra:down`                  | Stop infra containers                                                                                                                                   |
| `pnpm contracts:local`                 | Deploy the local vertical slice to anvil; writes `packages/contracts/deployments/local.json`                                                            |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migration generate/apply                                                                                                                        |
| `pnpm seed`                            | Load `deployments/local.json` into Postgres (idempotent; inert without local infra)                                                                     |
| `pnpm test:e2e`                        | Playwright vertical slice: connect → faucet → approve → enter YES → NO wallet → lock → resolve → claim → portfolio (boots its own anvil + web on :3100) |
| `pnpm typecheck:e2e`                   | Typecheck the `e2e/` suite standalone                                                                                                                   |

A full local runbook from a clean clone lives in the repo `README.md`.

Later milestones add:

- mainnet-fork test drivers (never broadcast real transactions).
