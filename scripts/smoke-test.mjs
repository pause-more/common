#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const appName = "오토원워크";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 8000);
const frontendOrigin = normalizeOrigin(process.env.FRONTEND_ORIGIN || "http://127.0.0.1:8000");
const apiOrigin = normalizeOrigin(process.env.API_ORIGIN || readDefaultApiOrigin());
const skipFrontend = process.env.SMOKE_SKIP_FRONTEND === "1";
const skipApi = process.env.SMOKE_SKIP_API === "1";
const failures = [];

const frontendChecks = [
  { path: "/", label: "frontend root", contains: "Auto One" },
  { path: "/index.html", label: "home page", contains: "오토원워크" },
  { path: "/login.html", label: "login page", contains: "오토원워크" },
  { path: "/offline.html", label: "offline page", contains: "네트워크 연결을 확인해주세요." },
  { path: "/chat.html", label: "chat page", contains: "오토원워크" },
  { path: "/mail/inbox.html", label: "mail page", contains: "오토원워크" },
  { path: "/approval/dashboard.html", label: "approval page", contains: "오토원워크" }
];

const apiChecks = [
  { path: "/", label: "Worker health", expectJsonSuccess: true }
];

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readDefaultApiOrigin() {
  const source = readFileSync(join(rootDir, "layout", "config.js"), "utf8");
  const match = source.match(/DEFAULT_API_ORIGIN\s*=\s*["']([^"']+)["']/);
  if (!match) throw new Error("DEFAULT_API_ORIGIN was not found in layout/config.js");
  return match[1];
}

function buildUrl(origin, path) {
  return origin + (String(path).startsWith("/") ? path : "/" + path);
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`[FAIL] ${message}`);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "text/html,application/json,text/plain,*/*" }
    });
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

async function checkFrontend(item) {
  const url = buildUrl(frontendOrigin, item.path);
  try {
    const { response, text } = await fetchText(url);
    if (!response.ok) {
      fail(`${item.label} returned HTTP ${response.status}: ${url}`);
      return;
    }

    if (item.json) {
      const parsed = JSON.parse(text);
      if (parsed.name !== appName) fail(`${item.label} app name mismatch`);
      else ok(`${item.label} responded with app name`);
      return;
    }

    if (item.contains && !text.includes(item.contains)) {
      fail(`${item.label} did not contain "${item.contains}"`);
      return;
    }

    ok(`${item.label} responded`);
  } catch (error) {
    fail(`${item.label} request failed: ${error.message}`);
  }
}

async function checkApi(item) {
  const url = buildUrl(apiOrigin, item.path);
  try {
    const { response, text } = await fetchText(url);
    if (!response.ok) {
      fail(`${item.label} returned HTTP ${response.status}: ${url}`);
      return;
    }

    if (item.expectJsonSuccess) {
      const data = JSON.parse(text);
      if (data && data.success === true) ok(`${item.label} responded`);
      else fail(`${item.label} JSON success was not true`);
      return;
    }

    ok(`${item.label} responded`);
  } catch (error) {
    fail(`${item.label} request failed: ${error.message}`);
  }
}

console.log("Running groupware smoke tests...");
console.log(`Frontend: ${frontendOrigin}`);
console.log(`API: ${apiOrigin}`);

if (skipFrontend) {
  console.log("[SKIP] frontend checks");
} else {
  for (const item of frontendChecks) {
    await checkFrontend(item);
  }
}

if (skipApi) {
  console.log("[SKIP] API checks");
} else {
  for (const item of apiChecks) {
    await checkApi(item);
  }
}

console.log("");
console.log(`Smoke test complete: ${failures.length} failure(s)`);

if (failures.length) process.exit(1);
