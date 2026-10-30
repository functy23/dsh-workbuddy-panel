import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const args = process.argv.slice(2);

function run(script) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts", script), ...args], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("scan.mjs");
run("report.mjs");
