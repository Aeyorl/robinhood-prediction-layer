import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import process from "node:process";

import { encodeFunctionData, getAddress, isHex, keccak256, stringToHex } from "viem";

const resolverAbi = [
  {
    type: "function",
    name: "proposeObservation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetKey", type: "bytes32" },
      { name: "referenceTime", type: "uint256" },
      { name: "price", type: "int256" },
      { name: "evidenceHash", type: "bytes32" },
      { name: "evidenceUri", type: "string" },
    ],
    outputs: [],
  },
];

function fail(message) {
  throw new Error(message);
}

function readInput(path) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!isHex(value.assetKey, { strict: true }) || value.assetKey.length !== 66)
    fail("assetKey must be bytes32 hex");
  if (!Number.isSafeInteger(value.referenceTime) || value.referenceTime <= 0)
    fail("referenceTime must be a positive Unix timestamp");
  if (!Number.isInteger(value.decimals) || value.decimals < 0 || value.decimals > 36)
    fail("decimals must be between 0 and 36");
  if (!/^\d+$/.test(value.price) || BigInt(value.price) <= 0n)
    fail("price must be a positive scaled integer string");
  if (!Array.isArray(value.sources) || value.sources.length < 2)
    fail("at least two independent sources are required");
  for (const source of value.sources) {
    if (!source.name || !URL.canParse(source.url) || !source.retrievedAt || !source.price)
      fail("each source requires name, URL, retrievedAt and price");
    if (source.price !== value.price) fail(`source ${source.name} does not match submitted price`);
  }
  if (value.marketSession !== "regular-close") fail("marketSession must be regular-close");
  if (value.corporateActionChecked !== true)
    fail("corporateActionChecked must be true before evidence can be produced");
  if (
    typeof value.evidenceUri !== "string" ||
    !(value.evidenceUri.startsWith("ipfs://") || value.evidenceUri.startsWith("https://"))
  )
    fail("evidenceUri must be an ipfs:// or https:// URI for the immutable evidence document");
  return value;
}

function canonicalize(value) {
  return JSON.stringify(
    {
      schema: "wagerly-safe-close-evidence-v1",
      assetKey: value.assetKey.toLowerCase(),
      symbol: String(value.symbol).toUpperCase(),
      referenceTime: value.referenceTime,
      marketSession: value.marketSession,
      decimals: value.decimals,
      price: value.price,
      corporateActionChecked: value.corporateActionChecked,
      notes: value.notes ?? "",
      sources: value.sources.map((source) => ({
        name: source.name,
        url: source.url,
        retrievedAt: source.retrievedAt,
        price: source.price,
      })),
    },
    null,
    2,
  );
}

const inputPath = process.argv[2];
if (!inputPath) fail("usage: pnpm oracle:evidence <input.json> [output-directory] [--dry-run]");
const input = readInput(resolve(inputPath));
const outputArg = process.argv[3]?.startsWith("--") ? undefined : process.argv[3];
const dryRun = process.argv.includes("--dry-run");
const outputDirectory = resolve(outputArg ?? "evidence");
const evidenceName = `${input.symbol.toLowerCase()}-${input.referenceTime}.json`;
const evidencePath = resolve(outputDirectory, evidenceName);
const canonical = `${canonicalize(input)}\n`;
const evidenceHash = keccak256(stringToHex(canonical));
const sha256 = createHash("sha256").update(canonical).digest("hex");
const evidenceUri = input.evidenceUri;

if (!dryRun) {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, canonical);
}

const transaction = {
  chainId: 4663,
  to: getAddress(input.resolverAddress),
  value: "0",
  data: encodeFunctionData({
    abi: resolverAbi,
    functionName: "proposeObservation",
    args: [
      input.assetKey,
      BigInt(input.referenceTime),
      BigInt(input.price),
      evidenceHash,
      evidenceUri,
    ],
  }),
  method: "proposeObservation(bytes32,uint256,int256,bytes32,string)",
  evidence: { uri: evidenceUri, keccak256: evidenceHash, sha256: `0x${sha256}` },
};
const transactionPath = resolve(
  outputDirectory,
  `${input.symbol.toLowerCase()}-${input.referenceTime}-safe-tx.json`,
);
if (!dryRun) writeFileSync(transactionPath, `${JSON.stringify(transaction, null, 2)}\n`);

console.log(`Evidence: ${basename(evidencePath)}`);
console.log(`Keccak256: ${evidenceHash}`);
console.log(`Safe transaction: ${basename(transactionPath)}`);
if (dryRun) console.log("Dry run: no files written.");
console.log("Review both files independently before scheduling through the Safe and timelock.");
