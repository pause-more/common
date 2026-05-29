#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const backupDir = process.argv[2];
const binding = process.env.KV_BINDING || "MAIL_KV";

if (!backupDir) {
  console.error("Usage: node scripts/backup-kv.mjs <backup-dir>");
  process.exit(1);
}

const keyListPath = join(backupDir, "kv", "kv-keys.json");
const valueDir = join(backupDir, "kv", "values");
const bulkPath = join(backupDir, "kv", "bulk-put.json");

function run(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "").trim() || "wrangler command failed");
  }
  return result.stdout;
}

function readKeys() {
  const parsed = JSON.parse(readFileSync(keyListPath, "utf8"));
  return (Array.isArray(parsed) ? parsed : [])
    .map((item) => typeof item === "string" ? item : item && item.name)
    .filter(Boolean);
}

function fileNameForKey(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]+/g, "__") + ".json";
}

mkdirSync(valueDir, { recursive: true });

const keys = readKeys();
const bulkItems = [];

for (const key of keys) {
  console.error(`Backing up KV key: ${key}`);
  const value = run(["kv", "key", "get", key, "--binding", binding, "--remote", "--text"]);
  const filePath = join(valueDir, fileNameForKey(key));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
  bulkItems.push({ key, value });
}

writeFileSync(bulkPath, JSON.stringify(bulkItems, null, 2));
console.error(`KV backup complete: ${keys.length} keys`);
console.error(`Bulk restore file: ${bulkPath}`);
