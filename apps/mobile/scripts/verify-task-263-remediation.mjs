import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const mobileRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectRoot = resolve(mobileRoot, "../..");

const [mobileLock, sandboxLock, exceptionFile, patch] = await Promise.all([
  readFile(resolve(mobileRoot, "package-lock.json"), "utf8").then(JSON.parse),
  readFile(
    resolve(projectRoot, "artifacts/mockup-sandbox/package-lock.json"),
    "utf8",
  ).then(JSON.parse),
  readFile(resolve(mobileRoot, "security-audit-exceptions.json"), "utf8").then(
    JSON.parse,
  ),
  readFile(resolve(mobileRoot, "patches/image-size+1.2.1.patch"), "utf8"),
]);

const packages = mobileLock.packages;
const versionAtLeast = (version, target) => {
  const actual = version.split(".").map(Number);
  const expected = target.split(".").map(Number);

  return actual.some((part, index) => {
    if (part === expected[index]) return false;
    return part > expected[index];
  }) || actual.every((part, index) => part === expected[index]);
};

const braceVersions = Object.entries(packages)
  .filter(([path]) => path.endsWith("/node_modules/brace-expansion"))
  .map(([, packageInfo]) => packageInfo.version);

if (
  braceVersions.length === 0 ||
  !braceVersions.every((version) =>
    version.startsWith("1.")
      ? versionAtLeast(version, "1.1.18")
      : versionAtLeast(version, "2.1.4"),
  )
) {
  throw new Error(`Unsafe brace-expansion resolution: ${braceVersions.join(", ")}`);
}

const babelVersion =
  packages["node_modules/@babel/plugin-transform-modules-systemjs"]?.version;
if (!babelVersion || !versionAtLeast(babelVersion, "7.29.8")) {
  throw new Error(`Unsafe SystemJS Babel plugin resolution: ${babelVersion}`);
}

const viteVersion = sandboxLock.packages["node_modules/vite"]?.version;
if (!viteVersion || !versionAtLeast(viteVersion, "7.3.5")) {
  throw new Error(`Unsafe Vite resolution: ${viteVersion}`);
}

const imageException = exceptionFile.exceptions?.find(
  (exception) =>
    exception.advisory === "CVE-2025-71329" &&
    exception.package === "image-size" &&
    exception.version === "1.2.1" &&
    exception.status === "mitigated-by-local-patch",
);

if (
  !imageException ||
  !patch.includes("if (box.size < 8)") ||
  !patch.includes("Invalid ICNS image entry length")
) {
  throw new Error("image-size CVE-2025-71329 exception or patch is incomplete");
}

console.log(
  JSON.stringify(
    {
      "CVE-2025-71329@image-size-1.2.1": "accepted-local-patch",
      "CVE-2026-13149@brace-expansion-1.1.14": "resolved",
      "CVE-2026-14257@brace-expansion-1.1.14": "resolved",
      "CVE-2026-69152@brace-expansion-1.1.14": "resolved",
      "CVE-2026-44728@@babel/plugin-transform-modules-systemjs-7.29.0":
        "resolved",
      "CVE-2026-53571@vite-7.3.2": "resolved",
    },
    null,
    2,
  ),
);