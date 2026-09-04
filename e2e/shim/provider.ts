/**
 * EIP-1193 provider shim for local E2E only. Bundled to a single IIFE with
 * esbuild and injected via page.addInitScript BEFORE any app script runs, so
 * wagmi's `injected` connector sees a real window.ethereum.
 *
 * It signs eth_sendTransaction with a fixed anvil dev key (via viem) and
 * forwards every other JSON-RPC method straight to the local anvil RPC.
 * Never use this outside local E2E — it holds a private key in the page.
 */
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

interface ShimConfig {
  rpcUrl: string;
  privateKey: `0x${string}`;
  chainId: number;
}

// Replaced at bundle time by global-setup (esbuild define) with the wallet
// config for this run's anvil instance.
declare const __SHIM_CONFIG_EMBEDDED__: ShimConfig;
const opts: ShimConfig = __SHIM_CONFIG_EMBEDDED__;

const CHAIN_ID_HEX = `0x${opts.chainId.toString(16)}`;
const account = privateKeyToAccount(opts.privateKey);

const wallet = createWalletClient({
  account,
  chain: {
    id: opts.chainId,
    name: "Robinhood Chain Testnet (local)",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [opts.rpcUrl] } },
  },
  transport: http(opts.rpcUrl),
});

interface RequestArgs {
  method: string;
  params?: unknown[];
}

class ShimProvider {
  private connectFns = new Set<(info: { chainId: string }) => void>();
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  get isMetaMask() {
    return true;
  }
  get isShim() {
    return true;
  }
  get chainId() {
    return CHAIN_ID_HEX;
  }

  enable = () => this.request({ method: "eth_requestAccounts" });

  on(event: string, fn: (...args: unknown[]) => void) {
    if (event === "connect") this.connectFns.add(fn as (info: { chainId: string }) => void);
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)?.add(fn);
    return this;
  }
  removeListener(event: string, fn: (...args: unknown[]) => void) {
    if (event === "connect") this.connectFns.delete(fn as (info: { chainId: string }) => void);
    this.listeners.get(event)?.delete(fn);
    return this;
  }
  once(event: string, fn: (...args: unknown[]) => void) {
    const wrapped = (...args: unknown[]) => {
      this.removeListener(event, wrapped);
      fn(...args);
    };
    return this.on(event, wrapped);
  }
  off = this.removeListener;
  addListener(event: string, fn: (...args: unknown[]) => void) {
    return this.on(event, fn);
  }
  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
    return true;
  }
  removeAllListeners(event?: string) {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
    return this;
  }

  private announceConnect() {
    for (const fn of this.connectFns) fn({ chainId: CHAIN_ID_HEX });
  }

  async request({ method, params = [] }: RequestArgs): Promise<unknown> {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        this.announceConnect();
        return [account.address];
      case "eth_chainId":
        return CHAIN_ID_HEX;
      case "net_version":
        return String(opts.chainId);
      case "eth_sendTransaction": {
        const tx = params[0] as {
          to: `0x${string}`;
          data?: `0x${string}`;
          value?: string;
          gas?: string;
        };
        // Fees are omitted: viem fills them via anvil RPC (eip-1559). Sending
        // a fixed gasPrice alongside maxFee fields would be invalid.
        const hash = await wallet.sendTransaction({
          to: tx.to,
          data: (tx.data ?? "0x") as `0x${string}`,
          value: tx.value ? BigInt(tx.value) : undefined,
          gas: tx.gas ? BigInt(tx.gas) : undefined,
        });
        return hash;
      }
      case "personal_sign": {
        const [message, from] = params as [`0x${string}`, `0x${string}`];
        if (from.toLowerCase() !== account.address.toLowerCase())
          throw rpcError(-32602, "wrong account");
        return account.signMessage({ message: { raw: message } });
      }
      case "eth_signTypedData_v4": {
        const [, from, typedData] = params as [unknown, `0x${string}`, string];
        if (from.toLowerCase() !== account.address.toLowerCase())
          throw rpcError(-32602, "wrong account");
        return account.signTypedData(JSON.parse(typedData) as never);
      }
      default:
        return this.forward(method, params);
    }
  }

  private async forward(method: string, params: unknown[]): Promise<unknown> {
    const res = await fetch(opts.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = (await res.json()) as {
      result?: unknown;
      error?: { code: number; message: string };
    };
    if (json.error) throw rpcError(json.error.code, json.error.message);
    return json.result;
  }

  // Legacy / unused surface.
  send(_payload: unknown, _cb: unknown) {
    throw rpcError(-32601, "legacy send() not supported");
  }
}

function rpcError(code: number, message: string): Error & { code: number } {
  const err = new Error(message) as Error & { code: number };
  err.code = code;
  return err;
}

(globalThis as Record<string, unknown>).ethereum = new ShimProvider();
(globalThis as Record<string, unknown>).__PL_E2E_PROVIDER__ = true;
