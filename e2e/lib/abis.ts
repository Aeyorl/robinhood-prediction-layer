import type { Abi } from "viem";

/**
 * Minimal ABI slices for the e2e suite. Kept local (instead of re-exporting
 * @pl/sdk) because @pl/sdk imports its ABIs from JSON files, which Node's ESM
 * loader rejects without import attributes — and the global-setup process is
 * plain Node, not the Playwright transform.
 */
export const marketAbi: Abi = [
  {
    type: "function",
    name: "status",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8", name: "" }],
  },
  {
    type: "function",
    name: "winningOutcome",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8", name: "" }],
  },
  {
    type: "function",
    name: "resolvedPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "int256", name: "" }],
  },
  {
    type: "function",
    name: "yesPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    type: "function",
    name: "noPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    type: "function",
    name: "lockTime",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    type: "function",
    name: "resolutionTime",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [{ type: "address", name: "" }],
    outputs: [{ type: "bool", name: "" }],
  },
  {
    type: "function",
    name: "enter",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint8", name: "side" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [],
  },
  { type: "function", name: "lock", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "resolve", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
];

export const erc20Abi: Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "" }],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address", name: "to" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [{ type: "bool", name: "" }],
  },
];
