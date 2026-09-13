import { createHmac, createHash } from "node:crypto";

const apiKey = process.env.DATA_STREAMS_API_KEY;
const userSecret = process.env.DATA_STREAMS_USER_SECRET;
const endpoint = (process.env.DATA_STREAMS_ENDPOINT ?? "https://api.dataengine.chain.link").replace(
  /\/$/,
  "",
);

if (!apiKey || !userSecret) {
  throw new Error("DATA_STREAMS_API_KEY and DATA_STREAMS_USER_SECRET are required");
}

async function discover(path) {
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
  if (!response.ok) {
    throw new Error(`Data Streams discovery authentication failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.feeds) ? payload.feeds : [];
}

const livePath = "/api/v1/discovery?base_asset=AAPL,NVDA,TSLA&status=live&network_type=mainnet";
const hiddenPath = `${livePath}&hidden=true`;
const feedsById = new Map();
for (const feed of await discover(livePath)) {
  if (feed?.feedId) feedsById.set(feed.feedId, feed);
}
try {
  for (const feed of await discover(hiddenPath)) {
    if (feed?.feedId) feedsById.set(feed.feedId, feed);
  }
} catch {
  // Hidden-stream lookup is additive. Live launch IDs must still verify.
}
const feeds = [...feedsById.values()];
const selected = feeds
  .filter(
    (feed) =>
      ["AAPL", "NVDA", "TSLA"].includes(feed.baseAsset) &&
      feed.schemaVersion === "V11" &&
      feed.networkType === "mainnet" &&
      feed.status === "live",
  )
  .map(({ baseAsset, quoteAsset, attributeType, feedId, schemaVersion, marketHours, status }) => ({
    baseAsset,
    quoteAsset,
    attributeType,
    feedId,
    schemaVersion,
    marketHours,
    status,
  }))
  .sort((a, b) =>
    `${a.baseAsset}:${a.attributeType}`.localeCompare(`${b.baseAsset}:${b.attributeType}`),
  );

if (selected.length < 9) {
  throw new Error(
    `Expected at least 9 entitled AAPL/NVDA/TSLA v11 streams; received ${selected.length}`,
  );
}

console.log(JSON.stringify({ authenticated: true, feeds: selected }, null, 2));
