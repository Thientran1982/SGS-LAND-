import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["components", "pages", "apps/nextjs/app", "apps/nextjs/components", "styles", "apps/nextjs"];
const extensions = new Set([".css", ".tsx", ".ts", ".jsx", ".js", ".html"]);
const ignored = new Set(["node_modules", ".next", "dist", "coverage"]);
const tokenFiles = new Set([
  "styles/globals.css",
  "apps/nextjs/app/globals.css",
  "tailwind.config.js",
  "index.html",
]);
const baselinePath = path.join(root, "scripts/ui-audit-baseline.json");
const forbiddenFonts = /\b(?:Inter|JetBrains Mono|Noto Serif)\b|font-(?:inter|jetbrains-mono|noto-serif)/i;
const tinyCss = /font-size\s*:\s*(?:[0-9]|1[01])px\b/i;
const tinyUtility = /text-\[(?:[0-9]|1[01])px\]/;

function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.relative(root, path.join(dir, entry.name));
    if (entry.isDirectory()) {
      if (ignored.has(entry.name)) return [];
      return filesIn(path.join(dir, entry.name));
    }
    if (!extensions.has(path.extname(entry.name))) return [];
    return [relative];
  });
}

const files = [...new Set(roots.flatMap((entry) => filesIn(path.join(root, entry))))];
const violations = [];

for (const file of files) {
  if (tokenFiles.has(file)) continue;
  const content = fs.readFileSync(path.join(root, file), "utf8");
  content.split(/\r?\n/).forEach((line, index) => {
    if (forbiddenFonts.test(line)) violations.push(`${file}:${index + 1} forbidden font family`);
    if (tinyCss.test(line) || tinyUtility.test(line)) violations.push(`${file}:${index + 1} font size below 12px`);
  });
}

if (process.argv.includes("--update-baseline")) {
  fs.writeFileSync(baselinePath, JSON.stringify(violations.sort(), null, 2) + "\n");
  console.log(`UI audit baseline updated with ${violations.length} existing finding(s).`);
} else if (violations.length) {
  const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, "utf8")) : [];
  const known = new Set(baseline);
  const regressions = violations.filter((violation) => !known.has(violation));
  console.log(`UI system audit checked ${files.length} UI source files.`);
  console.log(`Known baseline findings: ${violations.length - regressions.length}.`);
  if (regressions.length) {
    console.error(`New UI regressions found (${regressions.length}):`);
    console.error(regressions.slice(0, 80).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("No new color/font/size regressions detected.");
  }
} else {
  console.log(`UI system audit passed (${files.length} UI source files checked).`);
}