#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const backupDir = process.argv[2];
const binding = process.env.KV_BINDING || "MAIL_KV";

if (!backupDir) {
  console.error("Usage: node scripts/restore-kv.mjs <backup-dir>");
  process.exit(1);
}

const bulkPath = join(backupDir, "kv", "bulk-put.json");
if (!existsSync(bulkPath)) {
  console.error(`Missing bulk file: ${bulkPath}`);
  process.exit(1);
}

console.error(`Restoring KV from ${bulkPath}`);
const result = spawnSync("npx", [
  "wrangler",
  "kv",
  "bulk",
  "put",
  bulkPath,
  "--binding",
  binding,
  "--remote"
], {
  encoding: "utf8",
  stdio: "inherit"
});

process.exit(result.status || 0);
