const base = process.env.MONITOR_BASE_URL ?? "http://127.0.0.1:3001";
const webhook = process.env.ALERT_WEBHOOK_URL;
const started = performance.now();
let result;
try {
  const [healthResponse, metricsResponse] = await Promise.all([
    fetch(`${base}/health`, { signal: AbortSignal.timeout(10_000) }),
    fetch(`${base}/metrics`, { signal: AbortSignal.timeout(10_000) }),
  ]);
  const health = await healthResponse.json();
  const metrics = await metricsResponse.json();
  result = {
    ok: healthResponse.ok && metricsResponse.ok && health.ok && health.db === "up",
    base,
    latencyMs: Math.round(performance.now() - started),
    health,
    metrics,
  };
} catch (error) {
  result = {
    ok: false,
    base,
    latencyMs: Math.round(performance.now() - started),
    error: String(error),
  };
}
console.log(JSON.stringify(result));
if (!result.ok && webhook) {
  await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "prediction-layer-health-failed", ...result }),
    signal: AbortSignal.timeout(10_000),
  });
}
if (!result.ok) process.exitCode = 1;
