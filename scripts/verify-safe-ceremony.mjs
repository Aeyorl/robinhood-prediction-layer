import { readFileSync } from "node:fs";
import { getAddress, hashTypedData, verifyTypedData } from "viem";

const payloadPath = process.argv[2] ?? "audit/safe-ceremony-eip712-v2.json";
const signaturesPath = process.argv[3] ?? "audit/safe-ceremony-metamask-signatures-v2.json";

const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
const evidence = JSON.parse(readFileSync(signaturesPath, "utf8"));
const allowedOwners = new Set([
  getAddress("0xa5e7d6C189b37D9293908E0A28Da4D65d65a7f7A"),
  getAddress("0x26032745BcB969B95B4610A9a48D33Bd4340812D"),
  getAddress("0x8cA71B70C91BD8250073dfDD323b9219Bce6A165"),
]);

console.log(`Typed-data hash: ${hashTypedData(payload)}`);

if (evidence.signatures.length === 0) {
  console.log("No signatures recorded; two distinct Safe owners are still required.");
  process.exit(2);
}

const verifiedOwners = new Set();
for (const item of evidence.signatures) {
  const owner = getAddress(item.owner);
  if (!allowedOwners.has(owner)) throw new Error(`${owner} is not an approved Safe owner`);
  if (verifiedOwners.has(owner)) throw new Error(`Duplicate signer: ${owner}`);
  const valid = await verifyTypedData({ address: owner, ...payload, signature: item.signature });
  if (!valid) throw new Error(`Invalid signature for ${owner}`);
  verifiedOwners.add(owner);
  console.log(`Verified: ${owner}`);
}

if (verifiedOwners.size < evidence.requiredForSafeThreshold) {
  throw new Error(
    `Only ${verifiedOwners.size} valid owner signature(s); ${evidence.requiredForSafeThreshold} required`,
  );
}

console.log(`Ceremony threshold satisfied: ${verifiedOwners.size} verified owners`);
