const ROBINHOOD_CHAIN_ID = "0x1237";
const ALLOWED_OWNERS = new Set([
  "0xa5e7d6c189b37d9293908e0a28da4d65d65a7f7a",
  "0x26032745bcb969b95b4610a9a48d33bd4340812d",
  "0x8ca71b70c91bd8250073dfdd323b9219bce6a165",
]);

const connectButton = document.querySelector("#connect");
const signButton = document.querySelector("#sign");
const downloadButton = document.querySelector("#download");
const status = document.querySelector("#status");
const signatureView = document.querySelector("#signature");

let account;
let evidence;

function setStatus(message) {
  status.textContent = message;
}

async function requireApprovedOwner() {
  if (!window.ethereum) throw new Error("MetaMask was not detected in this browser.");
  const [selected] = await window.ethereum.request({ method: "eth_requestAccounts" });
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId.toLowerCase() !== ROBINHOOD_CHAIN_ID) {
    throw new Error("Switch MetaMask to Robinhood Chain (chain ID 4663), then try again.");
  }
  if (!ALLOWED_OWNERS.has(selected.toLowerCase())) {
    throw new Error("The selected MetaMask account is not one of the three approved Safe owners.");
  }
  return selected;
}

connectButton.addEventListener("click", async () => {
  try {
    account = await requireApprovedOwner();
    signButton.disabled = false;
    setStatus(`Approved Safe owner connected: ${account}`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

signButton.addEventListener("click", async () => {
  try {
    account = await requireApprovedOwner();
    const typedData = await fetch("../../audit/safe-ceremony-eip712-v3.json", {
      cache: "no-store",
    }).then((response) => {
      if (!response.ok) throw new Error("Could not load the fixed ceremony payload.");
      return response.json();
    });
    const signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [account, JSON.stringify(typedData)],
    });
    evidence = {
      format: "poku-metamask-ceremony-v3",
      signedAt: new Date().toISOString(),
      signer: account,
      signature,
      typedData,
    };
    signatureView.hidden = false;
    signatureView.textContent = `${account}\n${signature}`;
    downloadButton.disabled = false;
    setStatus("Signature captured locally. Download the evidence file for verification.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

downloadButton.addEventListener("click", () => {
  if (!evidence) return;
  const blob = new Blob([`${JSON.stringify(evidence, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `poku-deployment-authorization-v3-${evidence.signer}.json`;
  link.click();
  URL.revokeObjectURL(url);
});
