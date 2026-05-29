const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const appOutDir = context.appOutDir;
  const appNameKo = "오토원워크";
  const infoPlist = join(appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Info.plist");

  execFileSync("/usr/bin/plutil", ["-replace", "CFBundleDisplayName", "-string", appNameKo, infoPlist], { stdio: "ignore" });
  execFileSync("/usr/bin/plutil", ["-replace", "CFBundleName", "-string", appNameKo, infoPlist], { stdio: "ignore" });
};
