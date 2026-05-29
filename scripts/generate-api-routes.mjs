#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerPath = join(rootDir, "worker.js");
const workerRoutesDir = join(rootDir, "worker", "routes");
const outputPath = join(rootDir, "docs", "GROUPWARE_API_ROUTES.md");
const checkOnly = process.argv.includes("--check");

function routeArea(path) {
  if (path === "/") return "root";
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "api") return "other";
  if (parts[1] === "board" && parts[2]) return `board/${parts[2]}`;
  return parts[1] || "api";
}

function handlerName(expression) {
  const match = String(expression || "").trim().match(/^([A-Za-z0-9_$]+)/);
  return match ? match[1] : "";
}

function routeSourceFiles() {
  const files = [workerPath];
  if (!existsSync(workerRoutesDir)) return files;

  for (const entry of readdirSync(workerRoutesDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".js")) files.push(join(workerRoutesDir, entry.name));
  }
  return files;
}

function extractRoutes(source, sourcePath) {
  const routes = [];
  const lines = source.split(/\r?\n/);
  const sourceName = relative(rootDir, sourcePath);

  lines.forEach((line, index) => {
    const match = line.match(/if \(request\.method === "([^"]+)" && path === "([^"]+)"\) return(?: await)? ([^;]+);/);
    if (!match) return;

    const [, method, path, expression] = match;
    routes.push({
      line: index + 1,
      source: sourceName,
      method,
      path,
      area: routeArea(path),
      handler: handlerName(expression),
      expression: expression.trim()
    });
  });

  return routes;
}

function routeTable(routes) {
  return [
    "| Area | Method | Path | Handler | Source | Line |",
    "| --- | --- | --- | --- | --- | --- |",
    ...routes.map((route) => [
      route.area,
      route.method,
      `\`${route.path}\``,
      `\`${route.handler || route.expression}\``,
      `\`${route.source}\``,
      route.line
    ].join(" | ")).map((row) => `| ${row} |`)
  ].join("\n");
}

function areaSummary(routes) {
  const counts = new Map();
  routes.forEach((route) => counts.set(route.area, (counts.get(route.area) || 0) + 1));

  return [
    "| Area | Routes | Suggested module |",
    "| --- | ---: | --- |",
    ...Array.from(counts.entries()).map(([area, count]) => {
      const modulePath = area === "root" ? "worker/index.js" : `worker/routes/${area.replace("/", "-")}.js`;
      return `| ${area} | ${count} | \`${modulePath}\` |`;
    })
  ].join("\n");
}

function render(routes) {
  const routeCount = routes.length;
  const methodCounts = routes.reduce((acc, route) => {
    acc[route.method] = (acc[route.method] || 0) + 1;
    return acc;
  }, {});

  return `# Worker API 라우트 인벤토리

이 문서는 \`worker.js\`의 라우팅 조건을 기준으로 자동 생성한 API 목록이다.

재생성:

\`\`\`bash
node scripts/generate-api-routes.mjs
\`\`\`

## 요약

- 총 라우트: ${routeCount}
- GET: ${methodCounts.GET || 0}
- POST: ${methodCounts.POST || 0}
- OPTIONS: CORS preflight 공통 처리

## 모듈화 후보

${areaSummary(routes)}

## 라우트 목록

${routeTable(routes)}
`;
}

const routes = routeSourceFiles().flatMap((sourcePath) => {
  const source = readFileSync(sourcePath, "utf8");
  return extractRoutes(source, sourcePath);
});

if (!routes.length) {
  console.error("No routes found in worker.js");
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });
const nextContent = render(routes);

if (checkOnly) {
  if (!existsSync(outputPath)) {
    console.error(`${relative(rootDir, outputPath)} is missing`);
    process.exit(1);
  }

  const currentContent = readFileSync(outputPath, "utf8");
  if (currentContent !== nextContent) {
    console.error(`${relative(rootDir, outputPath)} is out of date`);
    console.error("Run: node scripts/generate-api-routes.mjs");
    process.exit(1);
  }

  console.log(`${relative(rootDir, outputPath)} is up to date`);
} else {
  writeFileSync(outputPath, nextContent);
  console.log(`Wrote ${relative(rootDir, outputPath)} with ${routes.length} routes`);
}
