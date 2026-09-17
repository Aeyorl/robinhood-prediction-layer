import { mkdirSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  toBytes,
  zeroHash,
} from "viem";

// Read-only release preparation. This script verifies current mainnet state,
// simulates the schedule call, and writes Safe Transaction Builder payloads.
// It never loads a private key or broadcasts a transaction.
const chainId = 4663;
const rpcUrl = "https://rpc.mainnet.chain.robinhood.com";
const safe = "0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39";
const timelock = "0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8";
const resolver = "0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5";
const factory = "0x62A301F2A0356a16fC1BB02991CfB9cFDb00152C";
const feeVault = "0x72792B5916dCbf5f0Ae8DB67B748fb5f5c37b89f";
const collateral = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const pons = "0x39dBED3a2bd333467115dE45665cC57F813C4571";
const delay = 172800n;

const openTime = BigInt(Date.parse("2026-09-20T00:00:00Z") / 1000);
const lockTime = BigInt(Date.parse("2026-09-23T20:00:00Z") / 1000);
const resolutionTime = lockTime;
const gracePeriod = 345600n; // Four days: enough for governance publication plus challenge.
const challengePeriod = 3600n;
const maxObservationDelay = 259200n;
const strike = 650000n; // $0.65 with six decimals.
const minEntry = 1000000n; // 1 USDG (canonical mainnet USDG has six decimals).
const maxEntry = 0n; // No per-user cap.
const question = "Will PONS be above $0.65 at 20:00 UTC on September 23, 2026?";
const metadataUri = "https://www.usepoku.fun/market/pons-above-065-sep-23-2026";

const timelockAbi = parseAbi([
  "function getMinDelay() view returns (uint256)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
  "function hashOperationBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt) pure returns (bytes32)",
  "function getTimestamp(bytes32 id) view returns (uint256)",
  "function scheduleBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt,uint256 delay)",
  "function executeBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt) payable",
]);
const safeAbi = parseAbi(["function getThreshold() view returns (uint256)"]);
const ownerAbi = parseAbi(["function owner() view returns (address)"]);
const resolverAbi = parseAbi([
  "function configHash(bytes32 assetKey) view returns (bytes32)",
  "function setAssetConfig(bytes32 assetKey,uint8 decimals,uint64 challengePeriod,uint64 maxObservationDelay,bool paused)",
]);
const factoryAbi = parseAbi([
  "function marketCount() view returns (uint256)",
  "function createMarket((address collateral,address resolver,bytes32 oracleAssetKey,uint8 comparator,int256 strike,uint8 strikeDecimals,uint256 openTime,uint256 lockTime,uint256 resolutionTime,uint256 gracePeriod,uint256 feeBps,uint256 minEntry,uint256 maxEntry,string question,string metadataUri,address feeVault) params) returns (address market)",
]);
const tokenAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

const client = createPublicClient({
  transport: http(rpcUrl, { timeout: 20000, retryCount: 1 }),
});
const blockNumber = await client.getBlockNumber();
if ((await client.getChainId()) !== chainId) throw new Error("Wrong chain");
for (const address of [safe, timelock, resolver, factory, feeVault, collateral, pons]) {
  const code = await client.getCode({ address, blockNumber });
  if (!code || code === "0x") throw new Error(`Missing code: ${address}`);
}
const read = (address, abi, functionName, args = []) =>
  client.readContract({ address, abi, functionName, args, blockNumber });
if ((await read(safe, safeAbi, "getThreshold")) !== 2n) throw new Error("Safe is not 2-of-N");
if ((await read(timelock, timelockAbi, "getMinDelay")) !== delay)
  throw new Error("Unexpected timelock delay");
for (const role of ["PROPOSER_ROLE", "EXECUTOR_ROLE", "CANCELLER_ROLE"]) {
  if (!(await read(timelock, timelockAbi, "hasRole", [keccak256(toBytes(role)), safe])))
    throw new Error(`Safe is missing ${role}`);
}
for (const [name, address] of [
  ["resolver", resolver],
  ["factory", factory],
]) {
  const owner = await read(address, ownerAbi, "owner");
  if (owner.toLowerCase() !== timelock.toLowerCase()) throw new Error(`${name} owner changed`);
}
if ((await read(collateral, tokenAbi, "symbol")) !== "USDG") throw new Error("Wrong collateral");
if ((await read(collateral, tokenAbi, "decimals")) !== 6) throw new Error("USDG decimals changed");
if ((await read(pons, tokenAbi, "symbol")) !== "PONS") throw new Error("Wrong PONS token");

const assetKey = keccak256(
  encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [BigInt(chainId), pons]),
);
if ((await read(resolver, resolverAbi, "configHash", [assetKey])) !== zeroHash)
  throw new Error("PONS resolver config already exists; refusing to overwrite it");
if ((await read(factory, factoryAbi, "marketCount")) !== 0n)
  throw new Error("Factory is no longer empty; review the launch package before continuing");

const configure = encodeFunctionData({
  abi: resolverAbi,
  functionName: "setAssetConfig",
  args: [assetKey, 6, challengePeriod, maxObservationDelay, false],
});
const create = encodeFunctionData({
  abi: factoryAbi,
  functionName: "createMarket",
  args: [
    {
      collateral,
      resolver,
      oracleAssetKey: assetKey,
      comparator: 0,
      strike,
      strikeDecimals: 6,
      openTime,
      lockTime,
      resolutionTime,
      gracePeriod,
      feeBps: 100n,
      minEntry,
      maxEntry,
      question,
      metadataUri,
      feeVault,
    },
  ],
});
const targets = [resolver, factory];
const values = [0n, 0n];
const payloads = [configure, create];
const salt = keccak256(toBytes("poku-first-pons-market-v1-2026-09-17"));
const operationArgs = [targets, values, payloads, zeroHash, salt];
const operationId = await read(timelock, timelockAbi, "hashOperationBatch", operationArgs);
const timestamp = await read(timelock, timelockAbi, "getTimestamp", [operationId]);
const scheduleData = encodeFunctionData({
  abi: timelockAbi,
  functionName: "scheduleBatch",
  args: [...operationArgs, delay],
});
if (timestamp === 0n) {
  await client.call({ account: safe, to: timelock, data: scheduleData, blockNumber });
}

const directory = "docs/governance-pons-first-market";
mkdirSync(directory, { recursive: true });
const json = (name, value) =>
  writeFileSync(
    `${directory}/${name}.json`,
    JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2) +
      "\n",
  );
for (const [name, data] of [
  ["schedule", scheduleData],
  [
    "execute-after-delay",
    encodeFunctionData({ abi: timelockAbi, functionName: "executeBatch", args: operationArgs }),
  ],
]) {
  json(name, {
    version: "1.0",
    chainId: String(chainId),
    createdAt: Date.now(),
    meta: {
      name: `Poku first PONS market: ${name}`,
      description:
        "Configure PONS resolution and create the first USDG market in one governed batch.",
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: safe,
    },
    transactions: [
      { to: timelock, value: "0", data, contractMethod: null, contractInputsValues: null },
    ],
  });
}
json("verification", {
  checkedAt: new Date().toISOString(),
  blockNumber,
  chainId,
  safe,
  timelock,
  resolver,
  factory,
  feeVault,
  collateral,
  pons,
  assetKey,
  operationId,
  salt,
  currentTimestamp: timestamp,
  delaySeconds: delay,
  terms: {
    question,
    strike,
    strikeDecimals: 6,
    openTime,
    lockTime,
    resolutionTime,
    gracePeriod,
    feeBps: 100,
    minEntry,
    maxEntry,
    metadataUri,
  },
  resolverConfig: { decimals: 6, challengePeriod, maxObservationDelay, paused: false },
  scheduleSimulated: timestamp === 0n,
  broadcast: false,
});
console.log(
  JSON.stringify({
    blockNumber: String(blockNumber),
    assetKey,
    operationId,
    timestamp: String(timestamp),
    output: directory,
    broadcast: false,
  }),
);
