// Turns Nevila's source photographs into optimised web assets. Run: node tools/photos.mjs <srcDir>
import sharp from "sharp";
import { statSync } from "node:fs";
import { join } from "node:path";

// Each entry is one slot on the page, so the widths track the column they render in.
const JOBS = [
  { src: "2.png", out: "portrait.webp", width: 900, alt: "portrait — About" },
  { src: "1.png", out: "about-lecture.webp", width: 960, alt: "lecture — About" },
];

const dir = process.argv[2];
if (!dir) { console.error("usage: node tools/photos.mjs <srcDir>"); process.exit(1); }

const kb = (p) => (statSync(p).size / 1024).toFixed(0);

for (const { src, out, width, alt } of JOBS) {
  const from = join(dir, src);
  const to = join("assets/img", out);
  const { width: w, height: h } = await sharp(from)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(to);
  console.log(`${out.padEnd(20)} ${w}x${h}  ${kb(to).padStart(4)} KB  (from ${kb(from)} KB)  ${alt}`);
}
