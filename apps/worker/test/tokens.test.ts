import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPublicClient, http, type Address } from "viem";
import { tokens, tokenTransfers } from "@pl/database";
import { testDatabase } from "../../api/test/database.js";
import { fetchTokenMetadata, isErc20TransferLog, projectTokenTransfers } from "../src/tokens.js";
import { rollbackProjections } from "../src/projections.js";

const token = `0x${"11".repeat(20)}` as Address;
const wallet = `0x${"22".repeat(20)}` as Address;
const zero = `0x${"00".repeat(20)}` as Address;
const hash = `0x${"33".repeat(32)}` as const;
const block = { number: 10n, hash, timestamp: 1000n };
const deps = { chainId: 46630, factoryAddress: token, marketAddresses: new Set<Address>() };
const logs = [
  {
    address: token,
    transactionHash: hash,
    logIndex: 0,
    args: { from: zero, to: wallet, value: 123n },
  },
];

describe("token projections against isolated PostgreSQL", () => {
  let storage: Awaited<ReturnType<typeof testDatabase>>;
  beforeAll(async () => {
    storage = await testDatabase();
  });
  afterAll(async () => {
    await storage?.close();
  });
  it("ignores ERC-721 topic shape", () => {
    expect(isErc20TransferLog({ topics: [hash, hash, hash, hash] })).toBe(false);
    expect(isErc20TransferLog({ topics: [hash, hash, hash] })).toBe(true);
  });
  it("is idempotent across replay/restart and rewinds transfers on a reorg", async () => {
    expect(
      (await storage.db.transaction((tx) => projectTokenTransfers(tx, deps, block, logs)))
        .transfers,
    ).toBe(1);
    expect(
      (await storage.db.transaction((tx) => projectTokenTransfers(tx, deps, block, logs)))
        .transfers,
    ).toBe(0);
    expect(await storage.db.select().from(tokenTransfers)).toHaveLength(1);
    await rollbackProjections(storage.client, 46630, 10n);
    expect(await storage.db.select().from(tokenTransfers)).toHaveLength(0);
    expect(
      (await storage.db.transaction((tx) => projectTokenTransfers(tx, deps, block, logs)))
        .transfers,
    ).toBe(1);
  });
  it("fetches metadata once and marks unreadable contracts explicitly", async () => {
    const client = createPublicClient({ transport: http("http://localhost:1") });
    const read = vi
      .spyOn(client, "readContract")
      .mockImplementation(async (args) =>
        args.functionName === "decimals"
          ? 18
          : args.functionName === "symbol"
            ? "TEST"
            : "Test token",
      );
    expect(await fetchTokenMetadata(client, storage.db, 46630, [token])).toBe(1);
    expect(await fetchTokenMetadata(client, storage.db, 46630, [token])).toBe(0);
    expect(read).toHaveBeenCalledTimes(3);
    const broken = `0x${"44".repeat(20)}` as Address;
    await storage.db.insert(tokens).values({ chainId: 46630, address: broken });
    read.mockRejectedValue(new Error("reverted"));
    await fetchTokenMetadata(client, storage.db, 46630, [broken]);
    const row = await storage.db.query.tokens.findFirst({
      where: (t, { eq }) => eq(t.address, broken),
    });
    expect(row?.metadataStatus).toBe("UNREADABLE");
    expect(row?.decimals).toBeNull();
    read.mockRestore();
  });
});
