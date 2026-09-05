#!/usr/bin/env bash
# Local E2E environment: anvil + forge deploy + next dev on :3100.
# Spawned by e2e/global-setup.ts; stays running until the process tree is
# killed by e2e/global-teardown.ts.
#
# forge's broadcast receipt poller can keep the process alive (or get killed by
# `timeout`) AFTER the onchain execution finished, so success is judged by
# contract code presence at every manifest address — never by forge's exit
# code — and the deploy is retried until all contracts are onchain.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC_PORT="${E2E_RPC_PORT:-8545}"
RPC="http://127.0.0.1:${RPC_PORT}"
WEB_PORT="${E2E_WEB_PORT:-3100}"
WEB="http://127.0.0.1:${WEB_PORT}"
CHAIN_ID=46630
mkdir -p "$ROOT/.e2e"

# Never stop an existing developer service. The caller must choose unused ports.
for port in "$RPC_PORT" "$WEB_PORT" "${E2E_API_PORT:-13001}"; do
  if node -e 'const n=require("node:net");const s=n.connect(Number(process.argv[1]),"127.0.0.1");s.on("connect",()=>process.exit(0));s.on("error",()=>process.exit(1))' "$port"; then
    echo "[e2e-env] Port $port is occupied; choose unused E2E ports."; exit 1
  fi
done

echo "[e2e-env] starting anvil on ${RPC}"
anvil --chain-id "${CHAIN_ID}" --port "${RPC_PORT}" --allow-origin '*' > "$ROOT/.e2e/anvil.log" 2>&1 &
ANVIL_PID=$!

for _ in $(seq 1 40); do
  OK=$(curl -s -X POST -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "$RPC" 2>/dev/null || true)
  case "$OK" in *"0xb626"*) break ;; esac
  sleep 1
done

code_at() { # address -> prints 1 when code is present
  local addr="$1"
  local body
  body=$(curl -s -X POST -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$addr\",\"latest\"],\"id\":1}" \
    "$RPC" 2>/dev/null || true)
  case "$body" in *'"0x"'*) echo 0 ;; *) echo 1 ;; esac
}

echo "[e2e-env] deploying contracts"
cd "$ROOT/packages/contracts"
MANIFEST="$ROOT/packages/contracts/deployments/local.json"
# Node on Windows cannot resolve MSYS-style paths (/c/...), and backslashes
# would corrupt JS string literals (e.g. \r in a directory name). Convert to a
# forward-slash Windows path with cygpath -m; fall back to the raw path when
# cygpath is absent.
MANIFEST_NODE=$(command -v cygpath >/dev/null 2>&1 && cygpath -m "$MANIFEST" || echo "$MANIFEST")
deploy_ok=0
for attempt in 1 2 3; do
  timeout 180 forge script script/DeployLocal.s.sol --rpc-url "$RPC" --broadcast \
    --unlocked --sender 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 \
    >> "$ROOT/.e2e/deploy.log" 2>&1
  echo "[e2e-env] deploy attempt ${attempt}: forge rc $?"
  if [ -f "$MANIFEST" ]; then
    REQUIRED=$(node -p "const m=require('$MANIFEST_NODE'); [m.usdg, m.mockSwapAdapter, m.predictionEntryRouter, ...m.markets.map(x=>x.address)].join(' ')" 2>/dev/null || echo "")
    all=1
    for addr in $REQUIRED; do
      if [ -z "$addr" ] || [ "$(code_at "$addr")" != "1" ]; then all=0; break; fi
    done
    if [ "$all" = "1" ] && [ -n "$REQUIRED" ]; then
      deploy_ok=1
      echo "[e2e-env] all contracts present on chain"
      break
    fi
  fi
  echo "[e2e-env] deploy incomplete (poller may have been killed mid-broadcast) — retrying"
  sleep 2
done
if [ "$deploy_ok" != "1" ]; then
  echo "[e2e-env] FAILED: contracts missing after 3 attempts"
  tail -40 "$ROOT/.e2e/deploy.log"
  kill "$ANVIL_PID" 2>/dev/null || true
  exit 1
fi

echo "[e2e-env] starting funding API and isolated indexer"
cd "$ROOT"
E2E_WEB_URL="$WEB" E2E_RPC_URL="$RPC" E2E_API_PORT="${E2E_API_PORT:-13001}" \
node "$ROOT/apps/api/node_modules/tsx/dist/cli.mjs" "$ROOT/e2e/funding-server.ts" > "$ROOT/.e2e/funding.log" 2>&1 &
API_PID=$!
echo "[e2e-env] starting web on ${WEB}"
cd "$ROOT/apps/web"
NEXT_PUBLIC_CHAIN_ID="${CHAIN_ID}" NEXT_PUBLIC_LOCAL_CHAIN=true \
NEXT_PUBLIC_RPC_TESTNET="$RPC" NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_API_URL="http://127.0.0.1:${E2E_API_PORT:-13001}" \
node "$ROOT/apps/web/node_modules/next/dist/bin/next" dev -p "${WEB_PORT}" \
  > "$ROOT/.e2e/web.log" 2>&1 &
WEB_PID=$!

echo "${ANVIL_PID} ${WEB_PID} ${API_PID}" > "$ROOT/.e2e/pids"
echo "[e2e-env] READY anvil=${ANVIL_PID} web=${WEB_PID} rpc=${RPC} weburl=${WEB}"
wait
