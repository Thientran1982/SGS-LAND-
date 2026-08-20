import fs from "node:fs";

const files = ["styles/globals.css", "apps/nextjs/app/globals.css"];
const requiredRoles = [
  ["--ui-text", "--ui-bg"],
  ["--ui-text-secondary", "--ui-bg"],
  ["--ui-text-inverse", "--ui-brand"],
  ["--ui-on-brand", "--ui-brand"],
  ["--ui-on-accent", "--ui-accent"],
  ["--ui-danger", "--ui-surface"],
  ["--ui-success", "--ui-surface"],
  ["--ui-info", "--ui-surface"],
];

function hex(value) {
  const match = value?.trim().match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return null;
  let raw = match[1];
  if (raw.length === 3 || raw.length === 4) raw = [...raw].map((c) => c + c).join("");
  if (raw.length !== 6 && raw.length !== 8) return null;
  return [0, 2, 4].map((i) => Number.parseInt(raw.slice(i, i + 2), 16) / 255);
}

function luminance(rgb) {
  return rgb.map((c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

function contrast(a, b) {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const themes = {
  light: source.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? "",
  dark: source.match(/\.dark\s*\{([\s\S]*?)\}/)?.[1] ?? "",
};
const failures = [];

for (const [theme, body] of Object.entries(themes)) {
  const values = Object.fromEntries([...body.matchAll(/(--ui-[\w-]+)\s*:\s*(#[0-9a-f]{3,8})/gi)]
    .map(([, name, value]) => [name, hex(value)]));
  for (const [foreground, background] of requiredRoles) {
    const fg = values[foreground];
    const bg = values[background];
    if (!fg || !bg) continue;
    const ratio = contrast(fg, bg);
    if (ratio < 4.5) failures.push(`${theme}: ${foreground} on ${background} = ${ratio.toFixed(2)}:1`);
  }
}

if (failures.length) {
  console.error("Theme contrast check failed:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Theme contrast check passed for light/dark semantic roles.");