import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

/**
 * Loads the local deployment manifest written by DeployLocal.s.sol
 * (packages/contracts/deployments/local.json). This file exists only when a
 * local chain has been deployed via `pnpm contracts:local` — it is local/test
 * data and never masquerades as live mainnet data.
 */

const manifestSchema = z.object({
  chainId: z.number(),
  factory: z.string(),
  oracleRegistry: z.string(),
  chainlinkPriceResolver: z.string(),
  feeVault: z.string(),
  usdg: z.string(),
  mocks: z.record(
    z.string(),
    z.object({ address: z.string(), symbol: z.string(), name: z.string(), decimals: z.number() }),
  ),
  markets: z.array(
    z.object({
      address: z.string(),
      slug: z.string(),
      question: z.string(),
      template: z.string(),
      comparator: z.string(),
      strike: z.string(),
      strikeDecimals: z.number(),
      asset: z.string(),
      feed: z.string(),
      sequencerFeed: z.string().nullable(),
      heartbeatSeconds: z.number(),
      feeBps: z.number(),
      openTime: z.number(),
      lockTime: z.number(),
      resolutionTime: z.number(),
      gracePeriodSeconds: z.number(),
      minEntry: z.string(),
      maxEntry: z.string().nullable(),
    }),
  ),
});

export type LocalDeployment = z.infer<typeof manifestSchema>;

/**
 * Candidate manifest locations. Under Turbopack/Next the compiled module's
 * import.meta.url points inside .next, so the source-relative path is only a
 * fallback — the cwd-relative path (dev/start run from apps/web) and an env
 * override are checked first.
 */
function candidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.PL_LOCAL_MANIFEST) paths.push(process.env.PL_LOCAL_MANIFEST);
  // From apps/web (dev/start/build):
  paths.push(resolve(process.cwd(), "../packages/contracts/deployments/local.json"));
  // From repo root (turbo dev / tests):
  paths.push(resolve(process.cwd(), "packages/contracts/deployments/local.json"));
  // Two levels up fallback:
  paths.push(resolve(process.cwd(), "../../packages/contracts/deployments/local.json"));
  // Source layout: apps/web/lib/server → repo root.
  const here = dirname(fileURLToPath(import.meta.url));
  paths.push(resolve(here, "../../../../packages/contracts/deployments/local.json"));
  paths.push(resolve(here, "../../../packages/contracts/deployments/local.json"));
  return paths;
}

export const MANIFEST_PATH: string =
  candidatePaths().find((p) => existsSync(p)) ??
  resolve(process.cwd(), "../packages/contracts/deployments/local.json");

let cached: LocalDeployment | null = null;

export function getLocalManifest(): LocalDeployment {
  if (cached) return cached;
  try {
    const raw = readFileSync(/* turbopackIgnore: true */ MANIFEST_PATH, "utf8");
    cached = manifestSchema.parse(JSON.parse(raw));
    return cached;
  } catch (err) {
    throw new Error(
      `Local deployment manifest not found (looked at ${MANIFEST_PATH}). Run a local chain first (pnpm dev:chain + pnpm contracts:local) or set PL_LOCAL_MANIFEST. (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

export function hasLocalManifest(): boolean {
  try {
    getLocalManifest();
    return true;
  } catch {
    return false;
  }
}
