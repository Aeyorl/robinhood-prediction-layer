import process from "node:process";

import { createPublicClient, getAddress, http, parseAbi } from "viem";

const MAINNET_CHAIN_ID = 4663;
const EXPECTED_DEPLOYER_NONCE = 14;
const MIN_DEPLOYER_BALANCE_WEI = 3_000_000_000_000_000n;
const CANONICAL = {
  USDG_ADDRESS: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  WETH_ADDRESS: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  SWAP_TARGET: "0x8876789976decbfcbbbe364623c63652db8c0904",
  DATA_STREAMS_VERIFIER: "0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7",
};

const safeAbi = parseAbi([
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
]);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function approved(name) {
  if (required(name) !== "true") throw new Error(`${name} must equal true`);
}

function address(name, fallback) {
  return getAddress((process.env[name]?.trim() || fallback).trim());
}

function expectedOwners() {
  const owners = required("EXPECTED_SAFE_OWNERS")
    .split(",")
    .map((owner) => getAddress(owner.trim()));
  if (owners.length < 3) throw new Error("EXPECTED_SAFE_OWNERS must contain at least three owners");
  if (new Set(owners.map((owner) => owner.toLowerCase())).size !== owners.length) {
    throw new Error("EXPECTED_SAFE_OWNERS contains duplicates");
  }
  return owners;
}

async function requireCode(client, name, value) {
  const code = await client.getCode({ address: value });
  if (!code || code === "0x") throw new Error(`${name} has no deployed bytecode at ${value}`);
  console.log(`[ok] ${name}: ${value}`);
}

async function main() {
  approved("MAINNET_COMPLIANCE_APPROVED");

  const rpcUrl = new URL(required("RPC_HTTP_URL"));
  if (rpcUrl.protocol !== "https:") throw new Error("RPC_HTTP_URL must use HTTPS");

  const addresses = {
    USDG_ADDRESS: address("USDG_ADDRESS", CANONICAL.USDG_ADDRESS),
    WETH_ADDRESS: address("WETH_ADDRESS", CANONICAL.WETH_ADDRESS),
    SWAP_TARGET: address("SWAP_TARGET", CANONICAL.SWAP_TARGET),
    SAFE_ADDRESS: address("SAFE_ADDRESS", ""),
    FEE_RECIPIENT: address("FEE_RECIPIENT", ""),
    DATA_STREAMS_VERIFIER: address("DATA_STREAMS_VERIFIER", ""),
    DEPLOYER_ADDRESS: address("DEPLOYER_ADDRESS", ""),
  };

  for (const [name, expected] of Object.entries(CANONICAL)) {
    if (addresses[name] !== getAddress(expected)) {
      throw new Error(`${name} does not match the verified canonical address`);
    }
  }
  if (addresses.SAFE_ADDRESS === addresses.FEE_RECIPIENT) {
    throw new Error("FEE_RECIPIENT must be distinct from SAFE_ADDRESS");
  }

  const client = createPublicClient({ transport: http(rpcUrl.toString(), { retryCount: 1 }) });
  const chainId = await client.getChainId();
  if (chainId !== MAINNET_CHAIN_ID) {
    throw new Error(`RPC returned chain ${chainId}; expected ${MAINNET_CHAIN_ID}`);
  }
  console.log(`[ok] RPC chain id: ${chainId}`);

  await Promise.all(
    Object.entries(addresses)
      .filter(([name]) => name !== "FEE_RECIPIENT" && name !== "DEPLOYER_ADDRESS")
      .map(([name, value]) => requireCode(client, name, value)),
  );

  const [deployerNonce, deployerBalance, deployerCode] = await Promise.all([
    client.getTransactionCount({ address: addresses.DEPLOYER_ADDRESS }),
    client.getBalance({ address: addresses.DEPLOYER_ADDRESS }),
    client.getCode({ address: addresses.DEPLOYER_ADDRESS }),
  ]);
  if (deployerCode && deployerCode !== "0x") {
    throw new Error("DEPLOYER_ADDRESS must be an EOA without deployed bytecode");
  }
  if (deployerNonce !== EXPECTED_DEPLOYER_NONCE) {
    throw new Error(
      `Deployer nonce ${deployerNonce} invalidates the reviewed package; expected ${EXPECTED_DEPLOYER_NONCE}`,
    );
  }
  if (deployerBalance < MIN_DEPLOYER_BALANCE_WEI) {
    throw new Error(
      `Deployer balance ${deployerBalance} wei is below the 0.003 ETH deployment minimum`,
    );
  }
  console.log(`[ok] Deployer: nonce ${deployerNonce}, funded for deployment`);

  const [owners, threshold] = await Promise.all([
    client.readContract({
      address: addresses.SAFE_ADDRESS,
      abi: safeAbi,
      functionName: "getOwners",
    }),
    client.readContract({
      address: addresses.SAFE_ADDRESS,
      abi: safeAbi,
      functionName: "getThreshold",
    }),
  ]);
  const expected = expectedOwners();
  const actualSet = new Set(owners.map((owner) => owner.toLowerCase()));
  if (
    owners.length !== expected.length ||
    expected.some((owner) => !actualSet.has(owner.toLowerCase()))
  ) {
    throw new Error("Safe owners do not match EXPECTED_SAFE_OWNERS");
  }
  const expectedThreshold = BigInt(required("EXPECTED_SAFE_THRESHOLD"));
  if (expectedThreshold < 2n || threshold !== expectedThreshold) {
    throw new Error(
      `Safe threshold ${threshold} does not match approved threshold ${expectedThreshold}`,
    );
  }
  console.log(`[ok] Safe: ${owners.length} owners, threshold ${threshold}`);
  console.log("Mainnet preflight passed. No transaction was sent.");
}

main().catch((error) => {
  console.error(`[mainnet-preflight] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
