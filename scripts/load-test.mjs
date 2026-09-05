const base = process.env.LOAD_TEST_BASE_URL ?? "http://127.0.0.1:3001";
const total = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const maxP95 = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 1000);
if (![total, concurrency, maxP95].every(Number.isFinite) || total < 1 || concurrency < 1) {
  throw new Error("invalid load-test configuration");
}
const timings = [];
let failures = 0;
let cursor = 0;
async function worker() {
  while (cursor < total) {
    cursor++;
    const started = performance.now();
    try {
      const response = await fetch(`${base}/health`);
      if (!response.ok) failures++;
      await response.arrayBuffer();
    } catch {
      failures++;
    }
    timings.push(performance.now() - started);
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
timings.sort((a, b) => a - b);
const p95 = timings[Math.min(timings.length - 1, Math.ceil(timings.length * 0.95) - 1)];
console.log(JSON.stringify({ base, total, concurrency, failures, p95Ms: Math.round(p95) }));
if (failures > 0 || p95 > maxP95) process.exitCode = 1;
