#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appName = "오토원워크";
const skipDirs = new Set([".git", ".wrangler", "node_modules", "dist", "release"]);
const failures = [];
const warnings = [];

function rel(path) {
  return relative(rootDir, path) || ".";
}

function pass(message) {
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

function readProjectFile(path) {
  return readFileSync(join(rootDir, path), "utf8");
}

function requireFile(path) {
  if (existsSync(join(rootDir, path))) {
    pass(`${path} exists`);
    return true;
  }
  fail(`${path} is missing`);
  return false;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function checkManifest() {
  if (existsSync(join(rootDir, "manifest.webmanifest"))) {
    fail("manifest.webmanifest should be removed");
    return;
  }

  pass("manifest.webmanifest is removed");
}

function checkServiceWorker() {
  if (existsSync(join(rootDir, "service-worker.js"))) {
    fail("service-worker.js should be removed");
    return;
  }

  pass("service-worker.js is removed");
}

function checkPwaClient() {
  if (existsSync(join(rootDir, "layout/pwa.js"))) {
    fail("layout/pwa.js should be removed");
    return;
  }

  pass("layout/pwa.js is removed");
}

function checkHtmlMetadata() {
  const htmlFiles = walk(rootDir).filter((file) => extname(file) === ".html");
  let checked = 0;

  for (const file of htmlFiles) {
    const source = readFileSync(file, "utf8");
    if (!/<html[\s>]/i.test(source)) continue;
    checked += 1;

    const name = rel(file);
    if (!source.includes(`name="application-name" content="${appName}"`)) fail(`${name} is missing application-name`);
    if (source.includes("manifest.webmanifest")) fail(`${name} still references a web manifest`);
    if (source.includes(`name="apple-mobile-web-app-title"`)) fail(`${name} still references apple-mobile-web-app-title`);
    if (source.includes(`name="apple-mobile-web-app-capable"`)) fail(`${name} still references apple-mobile-web-app-capable`);
  }

  pass(`checked HTML metadata in ${checked} pages`);
}

function checkWrangler() {
  if (!requireFile("wrangler.toml")) return;
  const source = readProjectFile("wrangler.toml");

  [
    'binding = "GROUPWARE_DB"',
    'binding = "GROUPWARE_FILES"',
    'binding = "MAIL_KV"',
    'name = "CHAT_ROOMS"',
    'main = "worker.js"'
  ].forEach((needle) => {
    if (source.includes(needle)) pass(`wrangler.toml contains ${needle}`);
    else fail(`wrangler.toml is missing ${needle}`);
  });
}

function checkJavaScriptSyntax() {
  const scriptFiles = walk(rootDir).filter((file) => {
    const ext = extname(file);
    return ext === ".js" || ext === ".mjs";
  });

  for (const file of scriptFiles) {
    const name = rel(file);
    const isWorkerModule = name === "worker.js"
      || name.startsWith("worker/routes/")
      || name.startsWith("worker/services/")
      || name.startsWith("worker/shared/")
      || name.startsWith("worker/storage/");
    const args = isWorkerModule ? ["--check", "--input-type=module"] : ["--check", file];
    const result = spawnSync("node", args, {
      cwd: rootDir,
      encoding: "utf8",
      input: isWorkerModule ? readFileSync(file, "utf8") : undefined
    });

    if (result.status === 0) {
      pass(`syntax ok: ${name}`);
    } else {
      fail(`syntax failed: ${name}\n${(result.stderr || result.stdout).trim()}`);
    }
  }
}

function checkShellSyntax() {
  const shellFiles = walk(rootDir).filter((file) => extname(file) === ".sh");

  for (const file of shellFiles) {
    const name = rel(file);
    const result = spawnSync("bash", ["-n", file], {
      cwd: rootDir,
      encoding: "utf8"
    });

    if (result.status === 0) {
      pass(`shell syntax ok: ${name}`);
    } else {
      fail(`shell syntax failed: ${name}\n${(result.stderr || result.stdout).trim()}`);
    }
  }
}

function checkGeneratedDocs() {
  const checks = [
    ["node", ["scripts/generate-api-routes.mjs", "--check"], "API route inventory is up to date"]
  ];

  for (const [command, args, message] of checks) {
    const result = spawnSync(command, args, {
      cwd: rootDir,
      encoding: "utf8"
    });

    if (result.status === 0) {
      pass(message);
    } else {
      fail(`${message} check failed\n${(result.stderr || result.stdout).trim()}`);
    }
  }
}

console.log("Running groupware preflight checks...");
checkManifest();
checkServiceWorker();
checkPwaClient();
requireFile("offline.html");
checkHtmlMetadata();
checkWrangler();
checkJavaScriptSyntax();
checkShellSyntax();
checkGeneratedDocs();

console.log("");
console.log(`Preflight complete: ${failures.length} failure(s), ${warnings.length} warning(s)`);

if (failures.length) process.exit(1);
