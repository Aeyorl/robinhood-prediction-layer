/** Test-only API + real projection loop, backed by an isolated PostgreSQL schema. */
import { readFileSync } from "node:fs";
import { apiEnvSchema } from "../packages/config/src/index.js";
import { testDatabase } from "../apps/api/test/database.js";
import { buildServer } from "../apps/api/src/server.js";
import { createFundingService } from "../apps/api/src/funding.js";
import { processBlock, rollbackProjections } from "../apps/worker/src/projections.js";
import { fetchTokenMetadata } from "../apps/worker/src/tokens.js";
import type { Address } from "viem";

const manifest = JSON.parse(
  readFileSync(new URL("../packages/contracts/deployments/local.json", import.meta.url), "utf8"),
);
const storage = await testDatabase();
const env = apiEnvSchema.parse({
  DATABASE_URL: "isolated-test-schema",
  CHAIN_ID: 46630,
  CORS_ORIGIN: process.env.E2E_WEB_URL ?? "http://127.0.0.1:13100",
  PORT: process.env.E2E_API_PORT ?? 13001,
  RPC_HTTP_URL: process.env.E2E_RPC_URL ?? "http://127.0.0.1:18545",
  USDG_ADDRESS: manifest.usdg,
  MOCK_SWAP_ADAPTER_ADDRESS: manifest.mockSwapAdapter,
  PREDICTION_ENTRY_ROUTER_ADDRESS: manifest.predictionEntryRouter,
  KNOWN_TOKEN_ADDRESSES: Object.values(manifest.mocks as Record<string, { address: string }>)
    .map((t) => t.address)
    .join(","),
});
const service = createFundingService(env);
const server = await buildServer({
  env,
  db: storage.db,
  sql: storage.client,
  redis: null,
  funding: service,
});
const marketAddresses = new Set<Address>();
let next = 0n;
let previousHash: string | undefined;
let closing = false;
async function shutdown() {
  closing = true;
  await server.close();
  await storage.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
// Explicit test-only shutdown permits cleanup before Windows terminates the process tree.
server.post("/__test/shutdown", async (_request, reply) => {
  reply.send({ ok: true });
  setTimeout(() => void shutdown(), 50);
});
await server.listen({ port: env.PORT, host: "127.0.0.1" });
while (!closing) {
  try {
    const head = await service.client.getBlockNumber({ cacheTime: 0 });
    if (
      next > 0n &&
      (head < next - 1n ||
        (await service.client.getBlock({ blockNumber: next - 1n })).hash !== previousHash)
    ) {
      await rollbackProjections(storage.client, 46630, 0n);
      marketAddresses.clear();
      next = 0n;
    }
    while (next <= head && !closing) {
      const block = await service.client.getBlock({ blockNumber: next });
      const result = await processBlock(
        {
          db: storage.db,
          client: service.client,
          chainId: 46630,
          factoryAddress: manifest.factory,
          entryRouterAddress: manifest.predictionEntryRouter,
          marketAddresses,
        },
        { number: next, hash: block.hash!, timestamp: block.timestamp },
      );
      await fetchTokenMetadata(service.client, storage.db, 46630, result.newTokens);
      previousHash = block.hash!;
      next++;
    }
  } catch (err) {
    if (!closing) console.error("[e2e-indexer]", err);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
