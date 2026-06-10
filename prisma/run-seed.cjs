#!/usr/bin/env node
/**
 * Routes prisma db seed by SEED_MODE (plain JS — no ts-node compile for router).
 * SEED_MODE=full | scenarios | penalty
 */
const { spawnSync } = require("child_process");
const path = require("path");

const mode = (process.env.SEED_MODE || "full").toLowerCase();
const fileByMode = {
  full: "seed.ts",
  scenarios: "seed-scenarios.ts",
  penalty: "seed-penalty-only.ts",
};
const file = fileByMode[mode] || fileByMode.full;
const root = path.join(__dirname, "..");
const tsNode = path.join(root, "node_modules", ".bin", "ts-node");
const target = path.join(__dirname, file);

const nodeOpts = process.env.NODE_OPTIONS || "";
const mem = nodeOpts.includes("max-old-space-size")
  ? nodeOpts
  : `${nodeOpts} --max-old-space-size=768`.trim();

console.log(`== run-seed: mode=${mode} file=${file} ==`);

const result = spawnSync(tsNode, ["--transpile-only", target], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: mem },
  cwd: root,
});

process.exit(result.status === null ? 1 : result.status);
