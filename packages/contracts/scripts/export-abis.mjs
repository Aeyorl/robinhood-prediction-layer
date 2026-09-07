/**
 * Exports ABIs from the Foundry build into abi/<Contract>.json so the SDK and
 * web app can import them without hand-maintained copies.
 *
 * Run after `forge build`:  node scripts/export-abis.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "abi");

const contracts = [
  ["src/market/BinaryPoolMarket.sol", "BinaryPoolMarket"],
  ["src/market/MarketFactory.sol", "MarketFactory"],
  ["src/oracle/OracleRegistry.sol", "OracleRegistry"],
  ["src/oracle/ChainlinkPriceResolver.sol", "ChainlinkPriceResolver"],
  ["src/oracle/DataStreamsRwaResolver.sol", "DataStreamsRwaResolver"],
  ["src/fee/FeeVault.sol", "FeeVault"],
  ["src/router/PredictionEntryRouter.sol", "PredictionEntryRouter"],
  ["src/mocks/MockUSDG.sol", "MockUSDG"],
  ["src/mocks/MockERC20.sol", "MockERC20"],
  ["src/mocks/MockAggregatorV3.sol", "MockAggregatorV3"],
  ["src/mocks/MockSequencerFeed.sol", "MockSequencerFeed"],
  ["src/mocks/MockSwapAdapter.sol", "MockSwapAdapter"],
];

mkdirSync(outDir, { recursive: true });

for (const [file, name] of contracts) {
  try {
    const raw = execSync(`forge inspect ${file}:${name} abi --json`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const parsed = JSON.parse(raw);
    const abi = Array.isArray(parsed) ? parsed : parsed.abi;
    writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(abi, null, 2));
    console.log(`exported ${name} (${abi.length} entries)`);
  } catch (err) {
    console.error(`failed to export ${name}:`, err.message?.split("\n")[0] ?? err);
    process.exitCode = 1;
  }
}
