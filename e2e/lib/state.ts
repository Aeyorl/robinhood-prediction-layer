import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = resolve(E2E_DIR, "..");
export const E2E_WORKDIR = resolve(REPO_ROOT, ".e2e");
export const STATE_PATH = resolve(E2E_WORKDIR, "state.json");
export const SHIM_OUT = resolve(E2E_WORKDIR, "provider.js");
export const MANIFEST_PATH = resolve(REPO_ROOT, "packages/contracts/deployments/local.json");

export const CHAIN_ID = 46630;
export const DEFAULT_RPC_URL = "http://127.0.0.1:8545";
export const DEFAULT_WEB_URL = "http://127.0.0.1:3100";
export const REUSE_WEB_URL = "http://127.0.0.1:3000";

export interface E2EState {
  reuse: boolean;
  webUrl: string;
  rpcUrl: string;
  chainId: number;
  /** PIDs spawned by global-setup (empty when reusing). */
  pids: number[];
}

export function readState(): E2EState {
  const raw = readFileSync(STATE_PATH, "utf8");
  return JSON.parse(raw) as E2EState;
}

export function writeState(state: E2EState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function stateExists(): boolean {
  return existsSync(STATE_PATH);
}

export function shimOutPath(): string {
  return SHIM_OUT;
}
