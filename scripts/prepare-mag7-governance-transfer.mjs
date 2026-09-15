import { mkdirSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  toBytes,
  zeroHash,
} from "viem";

// Read-only: generates calldata; never loads a signer or broadcasts a transaction.
const safe = "0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39";
const current = "0x96aC6E8964bdDA7604520B868d60B49FfA9e6ad4";
const destination = "0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8";
const contracts = {
  OracleRegistry: "0x0628a09AFF40FE8590026e498dA7a216C83C6c94",
  ChainlinkPriceResolver: "0x49f460112E9D2b378D7AC9dEa9Bb368f2Dc5af9a",
  DataStreamsRwaResolver: "0x516bbeE20Ee4e0Fe440Ea6b9531581e6C0f558f8",
  SafeClosingPriceResolver: "0x5f25Ad22C84BfCEb146468cC74c73b5C9Bb3BAa5",
  FeeVault: "0x72792B5916dCbf5f0Ae8DB67B748fb5f5c37b89f",
  MarketFactory: "0x62A301F2A0356a16fC1BB02991CfB9cFDb00152C",
  PredictionEntryRouter: "0x02c12517564d727CdD2f16736F7486EF31352195",
};
const abi = parseAbi([
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
  "function getMinDelay() view returns (uint256)",
  "function hasRole(bytes32 role,address account) view returns (bool)",
  "function getThreshold() view returns (uint256)",
  "function hashOperationBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt) pure returns (bytes32)",
  "function getTimestamp(bytes32 id) view returns (uint256)",
  "function scheduleBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt,uint256 delay)",
  "function executeBatch(address[] targets,uint256[] values,bytes[] payloads,bytes32 predecessor,bytes32 salt) payable",
]);
const client = createPublicClient({
  transport: http("https://rpc.mainnet.chain.robinhood.com", { timeout: 20000, retryCount: 1 }),
});
const blockNumber = await client.getBlockNumber();
const read = (address, functionName, args = []) =>
  client.readContract({ address, abi, functionName, args, blockNumber });
if ((await client.getChainId()) !== 4663) throw new Error("Wrong chain");
for (const address of [current, destination, safe, ...Object.values(contracts)]) {
  const code = await client.getCode({ address, blockNumber });
  if (!code || code === "0x") throw new Error(`Missing code: ${address}`);
}
for (const address of [current, destination]) {
  if ((await read(address, "getMinDelay")) !== 172800n)
    throw new Error("Unexpected timelock delay");
  for (const role of ["PROPOSER_ROLE", "EXECUTOR_ROLE", "CANCELLER_ROLE"]) {
    if (!(await read(address, "hasRole", [keccak256(toBytes(role)), safe])))
      throw new Error(`Safe missing ${role} at ${address}`);
  }
}
const threshold = await read(safe, "getThreshold");
if (threshold !== 2n) throw new Error("Unexpected Safe threshold");
const data = encodeFunctionData({ abi, functionName: "transferOwnership", args: [destination] });
for (const [name, address] of Object.entries(contracts)) {
  if ((await read(address, "owner")).toLowerCase() !== current.toLowerCase())
    throw new Error(`${name}: owner changed`);
  await client.call({ account: current, to: address, data, blockNumber });
}
const targets = Object.values(contracts);
const values = targets.map(() => 0n);
const payloads = targets.map(() => data);
const salt = keccak256(toBytes("poku-transfer-governance-to-mag7-v1"));
const args = [targets, values, payloads, zeroHash, salt];
const operationId = await read(current, "hashOperationBatch", args);
const timestamp = await read(current, "getTimestamp", [operationId]);
const scheduleData = encodeFunctionData({
  abi,
  functionName: "scheduleBatch",
  args: [...args, 172800n],
});
if (timestamp === 0n)
  await client.call({ account: safe, to: current, data: scheduleData, blockNumber });
const directory = "docs/governance-mag7-transfer";
mkdirSync(directory, { recursive: true });
const write = (name, value) =>
  writeFileSync(
    `${directory}/${name}.json`,
    JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2) +
      "\n",
  );
for (const [name, calldata] of [
  ["schedule", scheduleData],
  ["execute-after-delay", encodeFunctionData({ abi, functionName: "executeBatch", args })],
]) {
  write(name, {
    version: "1.0",
    chainId: "4663",
    createdAt: Date.now(),
    meta: {
      name: `Poku governance transfer: ${name}`,
      description:
        "Transfer seven Poku contracts to the existing MAG7 timelock. No token transfer or market creation.",
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: safe,
    },
    transactions: [
      { to: current, value: "0", data: calldata, contractMethod: null, contractInputsValues: null },
    ],
  });
}
write("verification", {
  blockNumber,
  checkedAt: new Date().toISOString(),
  safe,
  threshold,
  current,
  destination,
  delaySeconds: 172800,
  contracts,
  operationId,
  salt,
  timestamp,
  ownershipCallsSimulated: true,
  scheduleSimulated: timestamp === 0n,
  executionSimulated: false,
  broadcast: false,
});
console.log(
  JSON.stringify({
    blockNumber: String(blockNumber),
    operationId,
    timestamp: String(timestamp),
    output: directory,
    broadcast: false,
  }),
);
