#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const backupDir = process.argv[2];
const failures = [];
const warnings = [];

if (!backupDir) {
  console.error("Usage: node scripts/verify-backup.mjs <backup-dir>");
  process.exit(1);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`[FAIL] ${message}`);
}

function filePath(path) {
  return join(backupDir, path);
}

function requireFile(path, options = {}) {
  const target = filePath(path);
  if (!existsSync(target)) {
    fail(`${path} is missing`);
    return false;
  }

  const stats = statSync(target);
  if (options.nonEmpty && stats.size <= 0) {
    fail(`${path} is empty`);
    return false;
  }

  ok(`${path} exists${options.nonEmpty ? ` (${stats.size} bytes)` : ""}`);
  return true;
}

function readJson(path, options = {}) {
  if (!requireFile(path, options)) return null;
  try {
    const parsed = JSON.parse(readFileSync(filePath(path), "utf8"));
    ok(`${path} is valid JSON`);
    return parsed;
  } catch (error) {
    fail(`${path} JSON parse failed: ${error.message}`);
    return null;
  }
}

function countFiles(dirPath) {
  if (!existsSync(dirPath)) return 0;
  let count = 0;
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const target = join(dirPath, entry.name);
    if (entry.isDirectory()) count += countFiles(target);
    else if (entry.isFile()) count += 1;
  }
  return count;
}

console.log("Verifying groupware backup...");
console.log(`Backup directory: ${backupDir}`);

requireFile("d1/groupware-db.sql", { nonEmpty: true });
const d1Info = readJson("meta/d1-info.json", { nonEmpty: true });
const kvKeys = readJson("kv/kv-keys.json", { nonEmpty: true });
const objectKeys = readJson("r2/object-keys.json");
const manifest = readJson("meta/backup-manifest.json");
requireFile("meta/wrangler.toml", { nonEmpty: true });
requireFile("meta/README.txt", { nonEmpty: true });

if (Array.isArray(kvKeys)) {
  ok(`KV key list contains ${kvKeys.length} key(s)`);
} else if (kvKeys) {
  fail("kv/kv-keys.json should be an array");
}

const bulkPutPath = filePath("kv/bulk-put.json");
if (existsSync(bulkPutPath)) {
  const bulkItems = readJson("kv/bulk-put.json", { nonEmpty: true });
  if (Array.isArray(bulkItems)) {
    ok(`KV bulk restore file contains ${bulkItems.length} item(s)`);
    if (Array.isArray(kvKeys) && bulkItems.length !== kvKeys.length) {
      fail(`KV bulk restore item count ${bulkItems.length} does not match key list count ${kvKeys.length}`);
    }
  } else if (bulkItems) {
    fail("kv/bulk-put.json should be an array");
  }

  const valueFileCount = countFiles(filePath("kv/values"));
  if (Array.isArray(kvKeys) && valueFileCount !== kvKeys.length) {
    fail(`KV value file count ${valueFileCount} does not match key list count ${kvKeys.length}`);
  } else {
    ok(`KV value directory contains ${valueFileCount} file(s)`);
  }
} else {
  warn("Full KV value backup is not present: kv/bulk-put.json");
}

if (objectKeys) {
  ok("R2 object key metadata is readable");
} else {
  warn("R2 object key metadata is missing or unreadable");
}

if (manifest) {
  if (manifest.project && manifest.createdAt && manifest.d1Database && manifest.kvBinding) {
    ok("backup manifest has required metadata");
  } else {
    fail("backup manifest is missing required metadata");
  }
}

if (d1Info && typeof d1Info === "object") {
  ok("D1 info metadata is readable");
}

console.log("");
console.log(`Backup verification complete: ${failures.length} failure(s), ${warnings.length} warning(s)`);

if (failures.length) process.exit(1);
