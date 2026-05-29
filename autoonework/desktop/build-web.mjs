import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const sourceRoot = resolve(desktopDir, "..");
const outputRoot = resolve(desktopDir, "dist/webapp");
const excludedNames = new Set(["desktop", "node_modules", ".git", "dist", ".DS_Store"]);

async function copyEntry(source, destination) {
  const entryStat = await stat(source);
  if (entryStat.isDirectory()) {
    await mkdir(destination, { recursive: true });
    const children = await readdir(source, { withFileTypes: true });
    for (const child of children) {
      if (excludedNames.has(child.name)) continue;
      await copyEntry(join(source, child.name), join(destination, child.name));
    }
    return;
  }

  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { force: true });
}

async function main() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  const entries = await readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (excludedNames.has(entry.name)) continue;
    await copyEntry(join(sourceRoot, entry.name), join(outputRoot, entry.name));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
