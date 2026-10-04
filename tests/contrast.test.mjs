// WCAG 2.2 contrast audit of both palettes, read straight from tokens.css.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const css = fs.readFileSync(path.join(root, "assets/css/tokens.css"), "utf8");
const NL = String.fromCharCode(10);

// Pull one palette out of the block whose selector matches.
function palette(selector) {
  const block = css.slice(css.indexOf(selector));
  const body = block.slice(block.indexOf("{") + 1, block.indexOf("}"));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Every foreground/background pairing the stylesheets actually produce.
const PAIRS = [
  ["body text", "ink", "paper", 4.5],
  ["body text on card", "ink", "paper-2", 4.5],
  ["secondary text", "ink-2", "paper", 4.5],
  ["secondary text on card", "ink-2", "paper-2", 4.5],
  ["muted / tiny text", "ink-3", "paper", 4.5],
  ["muted text on card", "ink-3", "paper-2", 4.5],
  ["accent text", "accent", "paper", 4.5],
  ["accent text on card", "accent", "paper-2", 4.5],
  ["monogram on accent tint", "accent", "accent-soft", 4.5],
  ["error text", "danger", "paper", 4.5],
  ["success text", "ok", "paper", 4.5],
  ["primary button", "paper", "ink", 4.5],
  ["focus ring", "focus", "paper", 3],
  ["border on ground", "line", "paper", 1.2],
];

const report = [];
let failures = 0;

for (const [theme, selector] of [["light", ":root,"], ["dark", '[data-theme="dark"]']]) {
  const p = palette(selector);
  report.push(`${NL}--- ${theme} ---`);
  for (const [label, fg, bg, min] of PAIRS) {
    if (!p[fg] || !p[bg]) { failures++; report.push(`FAIL  ${label}: missing token ${p[fg] ? bg : fg}`); continue; }
    const r = ratio(p[fg], p[bg]);
    const ok = r >= min;
    if (!ok) failures++;
    report.push(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(26)} ${r.toFixed(2)}:1 (min ${min})  ${p[fg]} on ${p[bg]}`);
  }
}

// Client logos are flat files with baked-in colour, so they must clear the plate
// they sit on in BOTH themes — the tile deliberately stays light in dark mode.
const imgDir = path.join(root, "assets/img");
const plates = { light: palette(":root,")["logo-plate"], dark: palette('[data-theme="dark"]')["logo-plate"] };
report.push(`${NL}--- client logos on --logo-plate ---`);
for (const file of fs.readdirSync(imgDir).filter((f) => f.startsWith("logo-c-"))) {
  const svg = fs.readFileSync(path.join(imgDir, file), "utf8");
  const box = (svg.match(/viewBox="0 0 (\d+) (\d+)"/) || []).slice(1).map(Number);
  if (box.length !== 2 || box[0] !== box[1]) { failures++; report.push(`FAIL  ${file} is not square (${box.join("x") || "no viewBox"}) — it will squash in the tile`); }
  const brand = [...new Set(svg.match(/#[0-9a-f]{6}/gi))].map((c) => c.toLowerCase()).find((c) => c !== plates.light.toLowerCase());
  if (!brand) { failures++; report.push(`FAIL  ${file} has no distinct brand colour`); continue; }
  const worst = Math.min(ratio(brand, plates.light), ratio(brand, plates.dark));
  const ok = worst >= 4.5;
  if (!ok) failures++;
  report.push(`${ok ? "PASS" : "FAIL"}  ${file.replace(/^logo-c-|\.svg$/g, "").padEnd(14)} ${worst.toFixed(2)}:1 worst case  ${brand}`);
}

console.log(report.join(NL));
console.log(failures ? `${NL}${failures} CONTRAST FAILURES` : `${NL}Both palettes pass WCAG AA.`);
process.exit(failures ? 1 : 0);
