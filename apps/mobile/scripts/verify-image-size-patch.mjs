import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageDir = process.env.IMAGE_SIZE_PACKAGE_DIR
  ? resolve(process.env.IMAGE_SIZE_PACKAGE_DIR)
  : resolve("node_modules/image-size");

const [utils, icns] = await Promise.all([
  readFile(resolve(packageDir, "dist/types/utils.js"), "utf8"),
  readFile(resolve(packageDir, "dist/types/icns.js"), "utf8"),
]);

if (
  !/if \(box\.size < 8\)\s+break;\s+if \(box\.name === boxName\)/.test(
    utils,
  )
) {
  throw new Error("image-size zero-length box guard is missing");
}

const icnsGuard = "Invalid ICNS image entry length";
if ((icns.match(new RegExp(icnsGuard, "g")) ?? []).length !== 2) {
  throw new Error("image-size ICNS entry-length guards are missing");
}

console.log(`Verified image-size security patch in ${packageDir}`);