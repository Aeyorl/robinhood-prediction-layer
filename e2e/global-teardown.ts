import { execSync } from "node:child_process";
import { existsSync, readFileSync, copyFileSync, unlinkSync } from "node:fs";

import { E2E_WORKDIR, MANIFEST_PATH, readState, stateExists } from "./lib/state.js";

function killTree(pid: number): void {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

export default async function globalTeardown(): Promise<void> {
  try {
    if (!stateExists()) return;
    const state = readState();
    if (state.reuse) {
      console.log("[e2e] reused env left running (not managed by the test run)");
      return;
    }
    await fetch(`http://127.0.0.1:${process.env.E2E_API_PORT ?? "13001"}/__test/shutdown`, {
      method: "POST",
    }).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Kill the env script tree plus the individual anvil/web PIDs recorded by
    // scripts/e2e-env.sh (bash `wait` orphans can outlive the tree kill).
    const extraPids: number[] = [];
    const pidsFile = `${E2E_WORKDIR}/pids`;
    if (existsSync(pidsFile)) {
      for (const part of readFileSync(pidsFile, "utf8").trim().split(/\s+/)) {
        const n = Number(part);
        if (Number.isInteger(n) && n > 0) extraPids.push(n);
      }
    }
    for (const pid of [...state.pids, ...extraPids]) {
      if (pid > 0) killTree(pid);
    }
    console.log("[e2e] stopped spawned env processes");
    const backup = `${E2E_WORKDIR}/local-manifest.backup`;
    if (existsSync(backup)) {
      copyFileSync(backup, MANIFEST_PATH);
      unlinkSync(backup);
    }
  } catch (err) {
    console.error("[e2e] teardown warning:", err);
  }
}
