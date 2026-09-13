import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const NAME = "prediction-layer/production/data-streams";
const SOURCE_REGION = "us-east-1";
const TARGET_REGION = "eu-west-1";

function awsJson(args) {
  const stdout = execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return JSON.parse(stdout);
}

function exists(region) {
  try {
    awsJson([
      "secretsmanager",
      "describe-secret",
      "--region",
      region,
      "--secret-id",
      NAME,
      "--output",
      "json",
    ]);
    return true;
  } catch {
    return false;
  }
}

if (exists(TARGET_REGION)) {
  console.log(JSON.stringify({ created: false, existed: true, region: TARGET_REGION, name: NAME }));
  process.exit(0);
}

const source = awsJson([
  "secretsmanager",
  "get-secret-value",
  "--region",
  SOURCE_REGION,
  "--secret-id",
  NAME,
  "--output",
  "json",
]);
const parsed = JSON.parse(source.SecretString);
const keys = Object.keys(parsed).sort();
if (keys.join(",") !== "API_KEY,ENDPOINT,USER_SECRET") {
  throw new Error(`unexpected source keys: ${keys.join(",")}`);
}

const dir = mkdtempSync(join(tmpdir(), "poku-secret-"));
const file = join(dir, "payload.json");
try {
  writeFileSync(
    file,
    JSON.stringify({
      Name: NAME,
      Description: "Chainlink Data Streams credentials for ECS tasks in eu-west-1.",
      SecretString: source.SecretString,
      Tags: [
        { Key: "Product", Value: "prediction-layer" },
        { Key: "Environment", Value: "production" },
      ],
    }),
  );
  const created = awsJson([
    "secretsmanager",
    "create-secret",
    "--region",
    TARGET_REGION,
    "--cli-input-json",
    `file://${file}`,
    "--output",
    "json",
  ]);
  console.log(
    JSON.stringify({
      created: true,
      region: TARGET_REGION,
      name: NAME,
      arn: created.ARN,
      keys,
    }),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
