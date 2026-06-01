#!/usr/bin/env node
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const backupDir = process.argv[2];
const bucket = process.env.R2_BUCKET || "autone-groupware-files";

if (!backupDir) {
  console.error("Usage: node scripts/backup-r2.mjs <backup-dir>");
  process.exit(1);
}

const objectKeyPath = join(backupDir, "r2", "object-keys.json");
const fileDir = join(backupDir, "r2", "files");

function collectObjectKeys(value, keys = []) {
  if (!value) return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectKeys(item, keys));
    return keys;
  }
  if (typeof value === "object") {
    if (typeof value.object_key === "string" && value.object_key.trim()) {
      keys.push(value.object_key.trim());
    }
    Object.keys(value).forEach((key) => collectObjectKeys(value[key], keys));
  }
  return keys;
}

function safeRelativePath(key) {
  return String(key).replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "__/");
}

const parsed = JSON.parse(readFileSync(objectKeyPath, "utf8"));
const keys = Array.from(new Set(collectObjectKeys(parsed))).filter(Boolean);
mkdirSync(fileDir, { recursive: true });

for (const key of keys) {
  const targetPath = join(fileDir, safeRelativePath(key));
  mkdirSync(dirname(targetPath), { recursive: true });
  console.error(`Downloading R2 object: ${key}`);
  const result = spawnSync("npx", [
    "wrangler",
    "r2",
    "object",
    "get",
    `${bucket}/${key}`,
    "--remote",
    "--file",
    targetPath
  ], {
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.error(`R2 backup complete: ${keys.length} objects`);
