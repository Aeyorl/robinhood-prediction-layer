import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const revision = process.argv[2];
const output = process.argv[3];

if (!revision || !output) {
  console.error("Usage: node scripts/release-manifest.mjs <git-revision> <output-file>");
  process.exit(1);
}

const commit = execFileSync("git", ["rev-parse", `${revision}^{commit}`], {
  encoding: "utf8",
}).trim();

const trackedFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", commit], {
  encoding: "utf8",
})
  .split(/\r?\n/u)
  .filter(Boolean)
  .filter((path) => !path.startsWith("packages/contracts/lib/"))
  .filter((path) => !path.startsWith("packages/contracts/broadcast/"))
  .filter((path) => !path.startsWith("audit/"));

const lines = trackedFiles.map((path) => {
  const blob = execFileSync("git", ["show", `${commit}:${path}`], {
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
  });
  const digest = createHash("sha256").update(blob).digest("hex");
  return `${digest}  ${path}`;
});

writeFileSync(output, `${lines.join("\n")}\n`, { encoding: "utf8" });
console.log(`Wrote ${lines.length} Git-blob hashes for ${commit} to ${output}`);
