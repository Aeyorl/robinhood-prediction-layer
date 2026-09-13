import { createHash, createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";

/**
 * Loads production RPC and Data Streams secrets into process memory, checks
 * chain ID 4663 over HTTP and WebSocket, and runs Data Streams discovery.
 * Never prints secret values, URL paths, or credential material.
 */

const RPC_SECRET = "prediction-layer/production/rpc-endpoints";
const DS_SECRET = "prediction-layer/production/data-streams";
const EXPECTED_CHAIN_ID = 4663;

function awsJson(args) {
  const stdout = execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return JSON.parse(stdout);
}

function secretObject(secretId, region) {
  const value = awsJson([
    "secretsmanager",
    "get-secret-value",
    "--region",
    region,
    "--secret-id",
    secretId,
    "--output",
    "json",
  ]);
  const parsed = JSON.parse(value.SecretString);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${secretId} is not a JSON object`);
  }
  return { keys: Object.keys(parsed).sort(), values: parsed, arn: value.ARN };
}

function hostOnly(url) {
  const parsed = new URL(url);
  return { protocol: parsed.protocol.replace(":", ""), hostname: parsed.hostname };
}

async function readHttpChainId(url) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`RPC HTTP status ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC HTTP error ${body.error.code}`);
  return Number.parseInt(body.result, 16);
}

async function discover(endpoint, apiKey, userSecret, path) {
  const timestamp = Date.now().toString();
  const bodyHash = createHash("sha256").update("").digest("hex");
  const signature = createHmac("sha256", userSecret)
    .update(`GET ${path} ${bodyHash} ${apiKey} ${timestamp}`)
    .digest("hex");
  const response = await fetch(`${endpoint}${path}`, {
    headers: {
      Authorization: apiKey,
      "X-Authorization-Timestamp": timestamp,
      "X-Authorization-Signature-SHA256": signature,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  const feeds = Array.isArray(payload?.feeds) ? payload.feeds : [];
  const unique = (key) => [...new Set(feeds.map((feed) => feed[key]).filter(Boolean))].sort();
  return {
    httpStatus: response.status,
    feedCount: feeds.length,
    payloadKeys: payload ? Object.keys(payload).sort() : [],
    unique: {
      baseAsset: unique("baseAsset"),
      quoteAsset: unique("quoteAsset"),
      assetClass: unique("assetClass"),
      feedType: unique("feedType"),
      attributeType: unique("attributeType"),
      schemaVersion: unique("schemaVersion"),
      networkType: unique("networkType"),
      status: unique("status"),
      marketHours: unique("marketHours"),
    },
    feeds: feeds.map((feed) => ({
      baseAsset: feed.baseAsset,
      quoteAsset: feed.quoteAsset,
      assetClass: feed.assetClass,
      attributeType: feed.attributeType,
      feedId: feed.feedId,
      schemaVersion: feed.schemaVersion,
      marketHours: feed.marketHours,
      networkType: feed.networkType,
      status: feed.status,
    })),
  };
}

function summarize(feeds) {
  const unique = (key) => [...new Set(feeds.map((feed) => feed[key]).filter(Boolean))].sort();
  return {
    feedCount: feeds.length,
    unique: {
      baseAsset: unique("baseAsset"),
      quoteAsset: unique("quoteAsset"),
      assetClass: unique("assetClass"),
      attributeType: unique("attributeType"),
      schemaVersion: unique("schemaVersion"),
      networkType: unique("networkType"),
      status: unique("status"),
      marketHours: unique("marketHours"),
    },
  };
}

function wsChainIdAndHead(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket timed out waiting for newHeads"));
    }, 25_000);
    let chainId = null;
    let subscribed = false;
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket connection failed"));
    });
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }));
      ws.send(
        JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_subscribe", params: ["newHeads"] }),
      );
    });
    ws.addEventListener("message", (event) => {
      const body = JSON.parse(String(event.data));
      if (body.id === 1 && body.result) chainId = Number.parseInt(body.result, 16);
      if (body.id === 2 && body.result) subscribed = true;
      if (body.method === "eth_subscription" && body.params?.result?.number) {
        clearTimeout(timer);
        ws.close();
        resolve({
          chainId,
          subscribed,
          headBlock: Number.parseInt(body.params.result.number, 16),
        });
      }
    });
  });
}

const rpc = secretObject(RPC_SECRET, "eu-west-1");
const dsRegions = [];
try {
  dsRegions.push({ region: "eu-west-1", ...secretObject(DS_SECRET, "eu-west-1") });
} catch (error) {
  dsRegions.push({
    region: "eu-west-1",
    missing: true,
    error: error instanceof Error ? error.message.split("\n")[0] : "unknown",
  });
}
const dsUs = secretObject(DS_SECRET, "us-east-1");
dsRegions.push({ region: "us-east-1", keys: dsUs.keys, arn: dsUs.arn });

const mapping = {
  RPC_HTTP_URL: typeof rpc.values.RPC_HTTP_URL === "string",
  RPC_WS_URL: typeof rpc.values.RPC_WS_URL === "string",
  DATA_STREAMS_API_KEY: typeof dsUs.values.API_KEY === "string",
  DATA_STREAMS_USER_SECRET: typeof dsUs.values.USER_SECRET === "string",
  DATA_STREAMS_ENDPOINT: typeof dsUs.values.ENDPOINT === "string",
};

if (!mapping.RPC_HTTP_URL || !mapping.RPC_WS_URL) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "rpc_key_mapping_failed",
        rpcKeys: rpc.keys,
        mapping,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const httpMeta = hostOnly(rpc.values.RPC_HTTP_URL);
const wsMeta = hostOnly(rpc.values.RPC_WS_URL);
if (httpMeta.protocol !== "https") throw new Error("RPC_HTTP_URL must use HTTPS");
if (wsMeta.protocol !== "wss") throw new Error("RPC_WS_URL must use WSS");

const httpChainId = await readHttpChainId(rpc.values.RPC_HTTP_URL);
const wsResult = await wsChainIdAndHead(rpc.values.RPC_WS_URL);
if (httpChainId !== EXPECTED_CHAIN_ID || wsResult.chainId !== EXPECTED_CHAIN_ID) {
  console.log(
    JSON.stringify(
      { ok: false, reason: "chain_id_mismatch", httpChainId, wsChainId: wsResult.chainId },
      null,
      2,
    ),
  );
  process.exit(1);
}

if (!mapping.DATA_STREAMS_API_KEY || !mapping.DATA_STREAMS_USER_SECRET) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "data_streams_key_mapping_failed",
        dataStreamsKeys: dsUs.keys,
        mapping,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const dsEndpoint = (dsUs.values.ENDPOINT ?? "https://api.dataengine.chain.link").replace(/\/$/, "");
const dsHost = hostOnly(dsEndpoint);
const queries = {
  configured:
    "/api/v1/discovery?base_asset=AAPL,NVDA,TSLA&asset_class=Equities&status=live&network_type=mainnet&hidden=true",
  livePublicFilter: "/api/v1/discovery?base_asset=AAPL,NVDA,TSLA&status=live&network_type=mainnet",
  liveIncludingHidden:
    "/api/v1/discovery?base_asset=AAPL,NVDA,TSLA&status=live&network_type=mainnet&hidden=true",
};
const inventories = {};
for (const [name, path] of Object.entries(queries)) {
  inventories[name] = await discover(
    dsEndpoint,
    dsUs.values.API_KEY,
    dsUs.values.USER_SECRET,
    path,
  );
}

const selected = inventories.livePublicFilter.feeds.filter(
  (feed) =>
    ["AAPL", "NVDA", "TSLA"].includes(feed.baseAsset) &&
    feed.schemaVersion === "V11" &&
    feed.networkType === "mainnet" &&
    feed.status === "live",
);
const discoveryPayload = {
  authenticated: inventories.livePublicFilter.httpStatus === 200,
  feeds: selected,
};

if (inventories.livePublicFilter.httpStatus !== 200) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        reason: "data_streams_auth_failed",
        httpStatus: inventories.livePublicFilter.httpStatus,
        endpointHost: dsHost.hostname,
        fieldMapping: {
          secretKeys: dsUs.keys,
          runtimeVariables: [
            "DATA_STREAMS_API_KEY<=API_KEY",
            "DATA_STREAMS_USER_SECRET<=USER_SECRET",
            "DATA_STREAMS_ENDPOINT<=ENDPOINT",
          ],
        },
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const expected = {
  AAPL: {
    regularHoursFeedId: "0x000bbd87a23775b4c11092ae9a1fc7b3393636ae1dbb9f1ef460f845c0f4cff1",
    extendedHoursFeedId: "0x000b8b9394931d376dbfd988ab3e459b1954ca10880d6a2ec706cd2573910b5b",
    overnightHoursFeedId: "0x000b313c8a4997a3bc871130415ffeb42cd37b79cf68c11478780650cc553c0b",
  },
  NVDA: {
    regularHoursFeedId: "0x000b6aa036224454037bab103184565f6aa9ea589c3b349f6d8471ee753524b9",
    extendedHoursFeedId: "0x000bb043961643d051393c085a4dd0cded6f67b4b71e47e9dcec739b7b3e2145",
    overnightHoursFeedId: "0x000b47988e89f3e63e1d679c84b774e6c38bb9929ad9de6e5e56d657a80388a9",
  },
  TSLA: {
    regularHoursFeedId: "0x000b2dbed1640ead18d37338b75e4755630a900649261baf4ed79d9a749be13d",
    extendedHoursFeedId: "0x000b9e87f3f1ac8e590e47cce07a3e964d94f2abd5692b2f92f1dbab79874b07",
    overnightHoursFeedId: "0x000b67554457bf6c7e70d4d599d9634888fc8d79145c534ddd77ba1dae840107",
  },
};

const hourKey = {
  "Regular Market Hours": "regularHoursFeedId",
  "Extended Market Hours": "extendedHoursFeedId",
  "Overnight Market Hours": "overnightHoursFeedId",
  "US Equities Regular": "regularHoursFeedId",
  "US Equities Extended": "extendedHoursFeedId",
  "US Equities Overnight": "overnightHoursFeedId",
};

const mismatches = [];
for (const feed of discoveryPayload.feeds) {
  const configured = expected[feed.baseAsset]?.[hourKey[feed.marketHours]];
  if (!configured) {
    mismatches.push({
      symbol: feed.baseAsset,
      marketHours: feed.marketHours,
      reason: "unexpected_or_unmapped_hours",
    });
    continue;
  }
  if (configured !== feed.feedId) {
    mismatches.push({
      symbol: feed.baseAsset,
      marketHours: feed.marketHours,
      reason: "feed_id_mismatch",
    });
  }
}

const result = {
  ok: selected.length >= 9 && mismatches.length === 0,
  timestamp: new Date().toISOString(),
  rpc: {
    secretRegion: "eu-west-1",
    keys: rpc.keys,
    http: { ...httpMeta, chainId: httpChainId },
    websocket: {
      ...wsMeta,
      chainId: wsResult.chainId,
      subscribed: wsResult.subscribed,
      headBlock: wsResult.headBlock,
    },
  },
  dataStreams: {
    regions: dsRegions.map(({ region, keys, arn, missing, error }) => ({
      region,
      keys,
      arn,
      missing: Boolean(missing),
      error,
    })),
    mapping,
    endpointHost: dsHost.hostname,
    authenticated: discoveryPayload.authenticated === true,
    queryHttpStatus: Object.fromEntries(
      Object.entries(inventories).map(([name, value]) => [name, value.httpStatus]),
    ),
    inventory: Object.fromEntries(
      Object.entries(inventories).map(([name, value]) => [
        name,
        { httpStatus: value.httpStatus, ...summarize(value.feeds) },
      ]),
    ),
    feedCount: selected.length,
    feeds: selected,
    mismatches,
  },
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
