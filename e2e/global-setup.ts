import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, copyFileSync, writeFileSync } from "node:fs";
import globalTeardown from "./global-teardown.js";
import { resolve } from "node:path";

import { BOB_ADDRESS, BOB_KEY, CAROL_ADDRESS, readManifest, sleep } from "./lib/chain.js";
import {
  CHAIN_ID,
  DEFAULT_RPC_URL,
  DEFAULT_WEB_URL,
  E2E_WORKDIR,
  REPO_ROOT,
  REUSE_WEB_URL,
  SHIM_OUT,
  writeState,
} from "./lib/state.js";

const REUSE = process.env.E2E_REUSE === "1";

async function waitForHttp(url: string, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
      lastError = `status ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(1_000);
  }
  throw new Error(`${label} not ready at ${url} (${lastError})`);
}

async function waitForRpc(rpcUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      });
      const json = (await res.json()) as { result?: string };
      if (json.result === `0x${CHAIN_ID.toString(16)}`) return;
    } catch {
      // retry
    }
    await sleep(1_000);
  }
  throw new Error(`anvil not reachable at ${rpcUrl} with chain id ${CHAIN_ID}`);
}

async function buildShim(rpcUrl: string): Promise<void> {
  // The wallet config is baked in at bundle time (addInitScript cannot take
  // runtime args alongside a path). Local E2E only — holds the anvil dev key.
  await build({
    entryPoints: [resolve(REPO_ROOT, "e2e/shim/provider.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    outfile: SHIM_OUT,
    logLevel: "warning",
    sourcemap: false,
    define: {
      __SHIM_CONFIG_EMBEDDED__: JSON.stringify({
        rpcUrl,
        privateKey: BOB_KEY,
        chainId: CHAIN_ID,
      }),
    },
  });
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(E2E_WORKDIR, { recursive: true });

  if (REUSE) {
    // Attach to an already-running local environment (web + anvil + manifest).
    const webUrl = process.env.E2E_WEB_URL ?? REUSE_WEB_URL;
    const rpcUrl = process.env.E2E_RPC_URL ?? DEFAULT_RPC_URL;
    await waitForHttp(`${webUrl}/markets`, 10_000, "reused web app");
    await waitForRpc(rpcUrl, 10_000);
    const manifest = readManifest();
    if (manifest.markets.length === 0) throw new Error("reused env has no markets");
    await buildShim(rpcUrl);
    writeState({ reuse: true, webUrl, rpcUrl, chainId: CHAIN_ID, pids: [] });
    return;
  }

  // Fresh environment: scripts/e2e-env.sh owns anvil + deploy + next dev so
  // the deploy hang (forge poller under non-tty) never blocks the suite.
  const webUrl = process.env.E2E_WEB_URL ?? DEFAULT_WEB_URL;
  const rpcUrl = process.env.E2E_RPC_URL ?? DEFAULT_RPC_URL;

  const manifestPath = resolve(REPO_ROOT, "packages/contracts/deployments/local.json");
  if (existsSync(manifestPath))
    copyFileSync(manifestPath, resolve(E2E_WORKDIR, "local-manifest.backup"));
  writeFileSync(resolve(E2E_WORKDIR, "pids"), "");
  const env = spawn(
    process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash",
    ["scripts/e2e-env.sh"],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        E2E_RPC_PORT: new URL(rpcUrl).port,
        E2E_WEB_PORT: new URL(webUrl).port,
        E2E_API_PORT: process.env.E2E_API_PORT ?? "13001",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  env.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
  env.stderr?.on("data", (d: Buffer) => process.stderr.write(d));
  env.on("exit", (code) => {
    if (code !== 0 && !env.killed) {
      console.error(`[e2e] env script exited early (code ${code})`);
    }
  });

  writeState({
    reuse: false,
    webUrl,
    rpcUrl,
    chainId: CHAIN_ID,
    pids: [env.pid ?? -1],
  });
  try {
    await waitForHttp(`${webUrl}/markets`, 240_000, "web app");
    await waitForRpc(rpcUrl, 15_000);
    await waitForHttp(
      `http://127.0.0.1:${process.env.E2E_API_PORT ?? "13001"}/v1/markets`,
      30_000,
      "funding API",
    );
    await buildShim(rpcUrl);
  } catch (err) {
    await globalTeardown();
    throw err;
  }
  console.log(`[e2e] fresh env ready: web ${webUrl}, anvil ${rpcUrl}`);
  console.log(`[e2e] accounts: BOB=${BOB_ADDRESS} CAROL=${CAROL_ADDRESS}`);
}
