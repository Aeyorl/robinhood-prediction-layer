/** Explicit opt-in: only a loopback Anvil mainnet fork can receive transactions. */
import { createWalletClient, erc20Abi, http, parseAbi, type Address } from "viem";
import { getChain, getChainAddresses } from "@pl/chain-config";
import { apiEnvSchema } from "@pl/config";
import { createFundingService } from "../src/funding.js";

const rpc = process.env.FUNDING_FORK_RPC_URL;
if (!rpc || !process.env.UNISWAP_API_KEY)
  throw new Error(
    "Provide a loopback FUNDING_FORK_RPC_URL and server-side UNISWAP_API_KEY. This check never substitutes fixtures.",
  );
const url = new URL(rpc);
if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.protocol !== "http:")
  throw new Error("Fork transactions require a loopback HTTP Anvil RPC.");
async function anvil(method: string, params: unknown[]) {
  const response = await fetch(rpc!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const result = await response.json();
  if (result.error) throw new Error(`Fork RPC rejected ${method}`);
  return result.result;
}
const node = await anvil("web3_clientVersion", []);
if (!String(node).toLowerCase().includes("anvil")) throw new Error("Anvil is required.");
const accounts = (await anvil("eth_accounts", [])) as Address[];
const owner = process.env.FUNDING_FORK_WALLET as Address | undefined;
const addresses = getChainAddresses(4663);
const tokenIn = (process.env.FUNDING_FORK_TOKEN ?? addresses.weth) as Address | undefined;
const amountIn = process.env.FUNDING_FORK_AMOUNT ?? "100000000000000"; // 0.0001 WETH
if (!accounts.length || !owner || !tokenIn)
  throw new Error(
    "Provide FUNDING_FORK_WALLET for a public holder whose live balance Uniswap can simulate.",
  );
const snapshot = await anvil("evm_snapshot", []);
try {
  const env = apiEnvSchema.parse({
    ...process.env,
    DATABASE_URL: "fork-only",
    CHAIN_ID: 4663,
    SWAP_ADAPTER: "uniswap",
    RPC_HTTP_URL: rpc,
    RPC_TIMEOUT_MS: 60_000,
  });
  const service = createFundingService(env);
  const { usdg } = await service.ready();
  const before = await service.client.readContract({
    address: usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  await anvil("anvil_impersonateAccount", [owner]);
  await anvil("anvil_setBalance", [owner, "0x56bc75e2d63100000"]);
  const wallet = createWalletClient({
    chain: getChain(4663),
    account: owner,
    transport: http(rpc),
  });
  const balance = await service.client.readContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  if (balance < BigInt(amountIn)) {
    if (tokenIn.toLowerCase() !== addresses.weth?.toLowerCase())
      throw new Error("Fork wallet does not hold enough FUNDING_FORK_TOKEN.");
    const wrap = await wallet.writeContract({
      address: tokenIn,
      abi: parseAbi(["function deposit() payable"]),
      functionName: "deposit",
      value: BigInt(amountIn) - balance,
    });
    if ((await service.client.waitForTransactionReceipt({ hash: wrap })).status !== "success")
      throw new Error("Fork WETH deposit reverted");
  }
  const q = await service.quote({ tokenIn, amountIn, wallet: owner });
  const approve = await wallet.writeContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: "approve",
    args: [q.approvalSpender as Address, BigInt(amountIn)],
  });
  if ((await service.client.waitForTransactionReceipt({ hash: approve })).status !== "success")
    throw new Error("Fork approval reverted");
  const tx = {
    to: q.swapPlan.to as Address,
    data: q.swapPlan.data as `0x${string}`,
    value: BigInt(q.swapPlan.value),
  };
  await service.client.call({ account: owner, ...tx });
  const hash = await wallet.sendTransaction(tx);
  if ((await service.client.waitForTransactionReceipt({ hash })).status !== "success")
    throw new Error("Fork swap reverted");
  const after = await service.client.readContract({
    address: usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  if (after - before < BigInt(q.minAmountOut)) throw new Error("Fork output below minimum");
  console.log("Verified real Uniswap route, simulation and USDG receipt on an isolated fork.");
} finally {
  await anvil("evm_revert", [snapshot]);
}
