// Motion performance lint: only compositor-friendly properties may animate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const cssDir = path.join(root, "assets/css");
const files = fs.readdirSync(cssDir).filter((f) => f.endsWith(".css"));
const NL = String.fromCharCode(10);

// transform/opacity never touch layout or paint; filter is GPU but capped in cost.
const COMPOSITED = new Set(["transform", "opacity", "filter", "backdrop-filter", "clip-path", "stroke-dashoffset", "offset-distance", "visibility"]);
// Cheap enough on the small elements that use them; still worth flagging if they spread.
const TOLERATED = new Set(["color", "background", "background-color", "border-color", "box-shadow", "stroke", "fill", "outline-color", "text-decoration-color", "scale", "rotate", "translate"]);
// These force layout or a full repaint on every frame.
const FORBIDDEN = new Set(["width", "height", "inline-size", "block-size", "top", "left", "right", "bottom", "margin", "padding", "font-size", "line-height", "inset", "gap", "grid-template-columns", "max-height", "min-height", "border-width", "all"]);

// Brace-matched so single-line and multi-line @keyframes both parse exactly.
function keyframeBlocks(css) {
  const out = [];
  for (const start of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let i = start.index + start[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    out.push({ name: start[1], body: css.slice(start.index + start[0].length, i - 1) });
  }
  return out;
}

let fail = 0;
const warn = [];
const lines = [];

for (const file of files) {
  const css = fs.readFileSync(path.join(cssDir, file), "utf8");
  css.split(NL).forEach((line, i) => {
    const match = line.match(/(?:^|[;{\s])transition:\s*([^;}]+)/);
    if (!match) return;
    for (const part of match[1].split(",")) {
      const prop = part.trim().split(/\s+/)[0];
      if (!prop || prop === "none" || prop.startsWith("var(")) continue;
      if (FORBIDDEN.has(prop)) { fail++; lines.push(`FAIL  ${file}:${i + 1}  animates "${prop}" — forces layout every frame`); }
      else if (!COMPOSITED.has(prop) && !TOLERATED.has(prop)) { warn.push(`WARN  ${file}:${i + 1}  "${prop}" is not a known cheap property`); }
    }
  });

  // Keyframes must only move transform/opacity; anything else animates on the main thread.
  for (const { name, body } of keyframeBlocks(css)) {
    for (const decl of body.matchAll(/([a-z-]+)\s*:/g)) {
      const prop = decl[1];
      if (FORBIDDEN.has(prop)) { fail++; lines.push(`FAIL  ${file}  @keyframes ${name} animates "${prop}"`); }
      else if (!COMPOSITED.has(prop) && !TOLERATED.has(prop)) { warn.push(`WARN  ${file}  @keyframes ${name} uses "${prop}"`); }
    }
  }
}

// Infinite animations keep a compositor layer alive forever; keep the count deliberate.
const all = files.map((f) => fs.readFileSync(path.join(cssDir, f), "utf8")).join(NL);
const infinite = (all.match(/animation:[^;]*infinite/g) || []).length;
if (infinite > 3) { fail++; lines.push(`FAIL  ${infinite} infinite animations (max 3) — each holds a layer alive`); }

// `translate`/`rotate`/`scale` are separate properties from `transform`; animating transform
// on an element positioned with them stacks a second offset and makes it jump.
const selectorsWith = (prop) => {
  const out = new Set();
  for (const file of files) {
    const css = fs.readFileSync(path.join(cssDir, file), "utf8");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = rule[2];
      const hit = prop === "transform"
        ? /(^|;|\s)transform\s*:/.test(body)
        : new RegExp("(^|;|\\s)" + prop + "\\s*:").test(body);
      if (!hit) continue;
      // Compare on the base selector so :hover and the base rule match up.
      rule[1].split(",").forEach((s) => out.add(s.trim().replace(/:{1,2}[a-z-]+(\([^)]*\))?/g, "").trim()));
    }
  }
  return out;
};

const positioned = new Set([...selectorsWith("translate"), ...selectorsWith("rotate"), ...selectorsWith("scale")]);
const transformed = selectorsWith("transform");
for (const sel of positioned) {
  if (sel && transformed.has(sel)) { fail++; lines.push(`FAIL  "${sel}" mixes the translate/rotate/scale properties with transform — offsets will stack`); }
}

// Reduced motion must be honoured by both the OS query and the in-page toggle.
const motion = fs.readFileSync(path.join(cssDir, "motion.css"), "utf8");
for (const guard of ["prefers-reduced-motion: reduce", '[data-motion="reduced"]']) {
  if (!motion.includes(guard)) { fail++; lines.push(`FAIL  motion.css has no ${guard} kill switch`); }
}

console.log(lines.join(NL) || "No layout-triggering animations.");
if (warn.length) console.log(NL + warn.join(NL));
console.log(`${NL}${files.length} stylesheets · ${infinite} infinite animations · ${warn.length} warnings`);
console.log(fail ? `${NL}${fail} MOTION FAILURES` : `${NL}All animation is compositor-safe.`);
process.exit(fail ? 1 : 0);
