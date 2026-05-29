import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const nativeDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const rootDir = resolve(nativeDir, "..");
const buildDir = resolve(nativeDir, "dist");
const appName = "오토원워크";
const executableName = "AutoneWork";
const appBundle = resolve(buildDir, `${appName}.app`);
const contentsDir = resolve(appBundle, "Contents");
const macOSDir = resolve(contentsDir, "MacOS");
const resourcesDir = resolve(contentsDir, "Resources");
const webRoot = resolve(resourcesDir, "webapp");
const zipPath = resolve(buildDir, "오토원워크-mac-local.zip");
const excludedNames = new Set(["desktop", "native", "node_modules", ".git", "dist", "release", ".DS_Store", ".wrangler"]);

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

async function copyWebAssets() {
  await rm(webRoot, { recursive: true, force: true });
  await mkdir(webRoot, { recursive: true });

  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludedNames.has(entry.name)) continue;
    await copyEntry(join(rootDir, entry.name), join(webRoot, entry.name));
  }
}

async function writeInfoPlist() {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>ko</string>
  <key>CFBundleDisplayName</key>
  <string>오토원워크</string>
  <key>CFBundleExecutable</key>
  <string>${executableName}</string>
  <key>CFBundleIconFile</key>
  <string>app.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.autone.work.native</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>오토원워크</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleSignature</key>
  <string>AWRK</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.business</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoadsInWebContent</key>
    <true/>
    <key>NSAllowsLocalNetworking</key>
    <true/>
    <key>NSExceptionDomains</key>
    <dict>
      <key>127.0.0.1</key>
      <dict>
        <key>NSIncludesSubdomains</key>
        <false/>
        <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
        <true/>
      </dict>
      <key>localhost</key>
      <dict>
        <key>NSIncludesSubdomains</key>
        <false/>
        <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
        <true/>
      </dict>
    </dict>
  </dict>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;

  await writeFile(resolve(contentsDir, "Info.plist"), plist, "utf8");
  await writeFile(resolve(contentsDir, "PkgInfo"), "APPLAWRK", "utf8");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      HOME: "/private/tmp",
      TMPDIR: "/private/tmp"
    },
    ...options
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} failed${output ? `:\n${output}` : ""}`);
  }
  return result;
}

async function compileSwift() {
  const sourcePath = resolve(nativeDir, "main.swift");
  const outputPath = resolve(macOSDir, executableName);
  const moduleCachePath = resolve(buildDir, ".swift-module-cache");
  await mkdir(moduleCachePath, { recursive: true });
  run("swiftc", [
    sourcePath,
    "-O",
    "-module-cache-path", moduleCachePath,
    "-framework", "AppKit",
    "-framework", "WebKit",
    "-framework", "UserNotifications",
    "-o", outputPath
  ], { cwd: nativeDir });
}

async function makeZip() {
  await rm(zipPath, { force: true });
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appBundle, zipPath], { cwd: buildDir });
}

function signAppBundle() {
  run("codesign", [
    "--force",
    "--deep",
    "--sign", "-",
    appBundle
  ], { cwd: buildDir });
}

async function buildApp() {
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(macOSDir, { recursive: true });
  await mkdir(resourcesDir, { recursive: true });

  await copyWebAssets();
  await writeInfoPlist();

  const iconSource = resolve(rootDir, "desktop/assets/app.icns");
  await cp(iconSource, resolve(resourcesDir, "app.icns"), { force: true });
  await compileSwift();
  signAppBundle();
  await makeZip();
}

buildApp().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
