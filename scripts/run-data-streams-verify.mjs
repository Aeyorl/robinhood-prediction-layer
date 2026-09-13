import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raw = execFileSync(
  "aws",
  [
    "secretsmanager",
    "get-secret-value",
    "--region",
    "eu-west-1",
    "--secret-id",
    "prediction-layer/production/data-streams",
    "--query",
    "SecretString",
    "--output",
    "text",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
const secret = JSON.parse(raw);
const result = spawnSync(process.execPath, ["scripts/data-streams-discovery.mjs"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: {
    ...process.env,
    DATA_STREAMS_API_KEY: secret.API_KEY,
    DATA_STREAMS_USER_SECRET: secret.USER_SECRET,
    DATA_STREAMS_ENDPOINT: secret.ENDPOINT,
  },
  encoding: "utf8",
  windowsHide: true,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.status !== 0) {
  const sanitized = `${result.stderr || ""}`.replace(/[A-Za-z0-9_\-+/=]{16,}/g, "[redacted]");
  process.stderr.write(sanitized);
  process.exit(result.status ?? 1);
}
