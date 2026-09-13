import { execFileSync } from "node:child_process";

function awsSecret(region, id) {
  const raw = execFileSync(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--region",
      region,
      "--secret-id",
      id,
      "--query",
      "SecretString",
      "--output",
      "text",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  return JSON.parse(raw);
}

function cast(args, rpc) {
  return execFileSync("cast", [...args, "--rpc-url", rpc], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

const rpc = awsSecret("eu-west-1", "prediction-layer/production/rpc-endpoints").RPC_HTTP_URL;
if (!rpc.startsWith("https://")) throw new Error("RPC_HTTP_URL must be HTTPS");

const SAFE = "0x5A205159348BBe6c4A5a264B59fC8Df7A4ab6a39";
const DEPLOYER = "0x913B8D346625736958664C77b0C8Efd3DA2a7bA2";
const FEE = "0xBC8A2ac01AeEb849A15825e9FA12ebFBe83Dd8d8";
const PROPOSER = execFileSync("cast", ["keccak", "PROPOSER_ROLE"], { encoding: "utf8" }).trim();
const EXECUTOR = execFileSync("cast", ["keccak", "EXECUTOR_ROLE"], { encoding: "utf8" }).trim();
const CANCELLER = execFileSync("cast", ["keccak", "CANCELLER_ROLE"], { encoding: "utf8" }).trim();
const ADMIN = execFileSync("cast", ["keccak", "TIMELOCK_ADMIN_ROLE"], { encoding: "utf8" }).trim();

const addresses = {
  USDG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  WETH: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  SWAP_TARGET: "0x8876789976decbfcbbbe364623c63652db8c0904",
  DATA_STREAMS_VERIFIER: "0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7",
};

const code = {};
for (const [name, address] of Object.entries({ SAFE, FEE, DEPLOYER, ...addresses })) {
  const size = Number(cast(["codesize", address], rpc));
  const hash = size > 0 ? cast(["keccak", cast(["code", address], rpc)], rpc) : null;
  code[name] = { address, size, hash };
}

const deployerNonce = Number(cast(["nonce", DEPLOYER], rpc));
const predicted = {};
const names = [
  "ProtocolTimelock",
  "OracleRegistry",
  "ChainlinkPriceResolver",
  "DataStreamsRwaResolver",
  "SafeClosingPriceResolver",
  "FeeVault",
  "MarketFactory",
  "PredictionEntryRouter",
];
for (let i = 0; i < names.length; i++) {
  predicted[names[i]] = execFileSync(
    "cast",
    ["compute-address", DEPLOYER, "--nonce", String(deployerNonce + i)],
    { encoding: "utf8" },
  )
    .trim()
    .replace(/^Computed Address:\s*/u, "");
}

const out = {
  timestamp: new Date().toISOString(),
  chainId: Number(cast(["chain-id"], rpc)),
  block: Number(cast(["block-number"], rpc)),
  gasPriceWei: cast(["gas-price"], rpc),
  baseFeeWei: cast(["base-fee"], rpc),
  safe: {
    address: SAFE,
    owners: cast(["call", SAFE, "getOwners()(address[])"], rpc),
    threshold: cast(["call", SAFE, "getThreshold()(uint256)"], rpc),
    nonce: cast(["call", SAFE, "nonce()(uint256)"], rpc),
  },
  deployer: {
    address: DEPLOYER,
    nonce: deployerNonce,
    balanceWei: cast(["balance", DEPLOYER], rpc),
    balanceEth: cast(["balance", DEPLOYER, "--ether"], rpc),
    isSafeOwner: cast(["call", SAFE, "isOwner(address)(bool)", DEPLOYER], rpc),
  },
  mag7Timelock: {
    address: FEE,
    delay: cast(["call", FEE, "getMinDelay()(uint256)"], rpc),
    safeProposer: cast(["call", FEE, "hasRole(bytes32,address)(bool)", PROPOSER, SAFE], rpc),
    safeExecutor: cast(["call", FEE, "hasRole(bytes32,address)(bool)", EXECUTOR, SAFE], rpc),
    safeCanceller: cast(["call", FEE, "hasRole(bytes32,address)(bool)", CANCELLER, SAFE], rpc),
    zeroAdmin: cast(
      [
        "call",
        FEE,
        "hasRole(bytes32,address)(bool)",
        ADMIN,
        "0x0000000000000000000000000000000000000000",
      ],
      rpc,
    ),
  },
  code,
  predictedFromCurrentNonce: predicted,
};

console.log(JSON.stringify(out, null, 2));
