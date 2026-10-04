// Generates placeholder artwork that reads as real design work, not grey boxes.
// Run: node tools/demo-art.mjs   — safe to re-run, it overwrites its own output.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../assets/img");
fs.mkdirSync(OUT, { recursive: true });

// Palettes stay inside the site's warm neutral range so the grid reads as one body of work.
const P = [
  { bg: "#f2f0ec", ink: "#14110f", accent: "#b4462f", tint: "#e0d8cc" },
  { bg: "#e8e3d9", ink: "#1d1a17", accent: "#7d6a52", tint: "#cdc3b2" },
  { bg: "#14110f", ink: "#faf9f7", accent: "#e2755a", tint: "#3a332e" },
  { bg: "#eceae6", ink: "#1b2a33", accent: "#2f6b7d", tint: "#c7d3d7" },
  { bg: "#f6efe7", ink: "#2b1d16", accent: "#a8622f", tint: "#e3d0bb" },
  { bg: "#1d2320", ink: "#f1efe9", accent: "#8fae91", tint: "#33403a" },
];

const SANS = "Inter Tight, Helvetica Neue, Arial, sans-serif";
const SERIF = "Instrument Serif, Georgia, Times New Roman, serif";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rand = (seed) => { let x = seed * 9301 + 49297; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); };

// Ragged text lines standing in for body copy, at a believable measure.
const lines = (x, y, w, n, lh, fill, r, op = 0.5) =>
  Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y + i * lh}" width="${(w * (0.62 + r() * 0.38)).toFixed(0)}" height="${Math.max(3, lh * 0.22).toFixed(1)}" fill="${fill}" opacity="${op}"/>`).join("");

const cols = (x, y, w, h, count, gap, fill, r) =>
  Array.from({ length: count }, (_, i) => {
    const cw = (w - gap * (count - 1)) / count;
    return lines(x + i * (cw + gap), y, cw, Math.floor(h / 14), 14, fill, r, 0.4);
  }).join("");

const TEMPLATES = {
  // Newspaper front page: nameplate, lead headline, photo well, columns.
  newspaper: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.bg}"/>
    <rect x="0" y="0" width="1200" height="96" fill="${p.ink}"/>
    <text x="60" y="66" font-family="${SERIF}" font-size="52" fill="${p.bg}">${esc(t.masthead)}</text>
    <text x="1140" y="62" text-anchor="end" font-family="${SANS}" font-size="18" fill="${p.bg}" opacity=".7">${esc(t.date)}</text>
    <line x1="60" y1="130" x2="1140" y2="130" stroke="${p.ink}" stroke-width="3"/>
    <text x="60" y="210" font-family="${SERIF}" font-size="72" fill="${p.ink}">${esc(t.headline)}</text>
    <rect x="60" y="250" width="620" height="380" fill="${p.tint}"/>
    <path d="M60 630 L300 400 L470 560 L610 450 L680 520 L680 630Z" fill="${p.accent}" opacity=".85"/>
    <circle cx="560" cy="330" r="42" fill="${p.accent}"/>
    ${cols(720, 262, 420, 360, 2, 26, p.ink, r)}
    ${cols(60, 664, 1080, 190, 4, 24, p.ink, r)}`,

  // Magazine cover: full-bleed image area, masthead over it, cover lines.
  magazine: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.tint}"/>
    <circle cx="640" cy="470" r="300" fill="${p.accent}" opacity=".9"/>
    <path d="M340 900 Q640 380 940 900Z" fill="${p.ink}" opacity=".85"/>
    <rect x="0" y="0" width="1200" height="150" fill="${p.bg}" opacity=".92"/>
    <text x="60" y="108" font-family="${SANS}" font-weight="700" font-size="86" letter-spacing="-3" fill="${p.ink}">${esc(t.masthead)}</text>
    <text x="1140" y="104" text-anchor="end" font-family="${SANS}" font-size="20" fill="${p.ink}" opacity=".6">${esc(t.issue)}</text>
    <rect x="60" y="700" width="470" height="140" fill="${p.bg}" opacity=".94"/>
    <text x="84" y="752" font-family="${SERIF}" font-size="38" fill="${p.ink}">${esc(t.headline)}</text>
    <text x="84" y="796" font-family="${SANS}" font-size="19" fill="${p.ink}" opacity=".65">${esc(t.kicker)}</text>`,

  // Book cover: tall trim centred on the canvas, title block, rule.
  book: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.tint}"/>
    <rect x="390" y="70" width="420" height="760" fill="${p.bg}"/>
    <rect x="390" y="70" width="22" height="760" fill="${p.ink}" opacity=".18"/>
    <rect x="450" y="150" width="300" height="300" fill="${p.accent}" opacity=".9"/>
    <circle cx="600" cy="300" r="86" fill="${p.bg}" opacity=".9"/>
    <text x="450" y="560" font-family="${SERIF}" font-size="46" fill="${p.ink}">${esc(t.title)}</text>
    <line x1="450" y1="600" x2="750" y2="600" stroke="${p.accent}" stroke-width="3"/>
    <text x="450" y="646" font-family="${SANS}" font-size="20" fill="${p.ink}" opacity=".6">${esc(t.author)}</text>
    <text x="450" y="790" font-family="${SANS}" font-size="16" letter-spacing="2" fill="${p.ink}" opacity=".45">${esc(t.imprint)}</text>`,

  // Editorial spread: gutter, pull quote, columns, caption.
  spread: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.bg}"/>
    <line x1="600" y1="40" x2="600" y2="860" stroke="${p.ink}" stroke-width="1" opacity=".18"/>
    <rect x="70" y="70" width="460" height="300" fill="${p.tint}"/>
    <path d="M70 370 L230 200 L360 320 L470 240 L530 290 L530 370Z" fill="${p.accent}" opacity=".8"/>
    <text x="70" y="420" font-family="${SANS}" font-size="15" fill="${p.ink}" opacity=".5">${esc(t.caption)}</text>
    ${cols(70, 450, 460, 380, 2, 24, p.ink, r)}
    <text x="640" y="150" font-family="${SERIF}" font-size="54" fill="${p.ink}">${esc(t.headline)}</text>
    <text x="640" y="205" font-family="${SANS}" font-size="19" fill="${p.accent}">${esc(t.kicker)}</text>
    ${cols(640, 250, 490, 250, 2, 24, p.ink, r)}
    <rect x="640" y="540" width="490" height="4" fill="${p.accent}"/>
    <text x="640" y="610" font-family="${SERIF}" font-style="italic" font-size="34" fill="${p.ink}">${esc(t.quote)}</text>
    ${cols(640, 680, 490, 150, 2, 24, p.ink, r)}`,

  // Identity sheet: mark, grid construction, wordmark, palette chips.
  brand: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.bg}"/>
    <g stroke="${p.ink}" stroke-width="1" opacity=".14">
      ${Array.from({ length: 9 }, (_, i) => `<line x1="${120 + i * 55}" y1="120" x2="${120 + i * 55}" y2="560"/>`).join("")}
      ${Array.from({ length: 9 }, (_, i) => `<line x1="120" y1="${120 + i * 55}" x2="560" y2="${120 + i * 55}"/>`).join("")}
    </g>
    <circle cx="340" cy="340" r="165" fill="none" stroke="${p.accent}" stroke-width="16"/>
    <path d="M258 422 V258 l164 164 V258" fill="none" stroke="${p.ink}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="660" y="250" font-family="${SANS}" font-weight="700" font-size="74" letter-spacing="-3" fill="${p.ink}">${esc(t.title)}</text>
    <text x="662" y="300" font-family="${SANS}" font-size="20" letter-spacing="7" fill="${p.ink}" opacity=".55">${esc(t.kicker)}</text>
    ${lines(660, 350, 460, 6, 26, p.ink, r, 0.35)}
    <g>${[p.ink, p.accent, p.tint, p.bg].map((c, i) => `<rect x="${660 + i * 120}" y="540" width="100" height="100" fill="${c}" stroke="${p.ink}" stroke-opacity=".15"/>`).join("")}</g>
    <text x="120" y="700" font-family="${SERIF}" font-size="120" fill="${p.ink}" opacity=".9">Aa</text>
    <text x="330" y="700" font-family="${SANS}" font-weight="700" font-size="120" fill="${p.accent}">Aa</text>
    ${lines(120, 740, 440, 3, 24, p.ink, r, 0.3)}`,

  // Exhibition panel: large title, interpretive text, bilingual caption band.
  exhibition: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.ink}"/>
    <rect x="0" y="0" width="1200" height="14" fill="${p.accent}"/>
    <text x="80" y="190" font-family="${SANS}" font-weight="700" font-size="78" letter-spacing="-2" fill="${p.bg}">${esc(t.title)}</text>
    <text x="84" y="240" font-family="${SANS}" font-size="22" letter-spacing="5" fill="${p.accent}">${esc(t.kicker)}</text>
    <rect x="80" y="300" width="500" height="340" fill="${p.tint}" opacity=".55"/>
    <circle cx="330" cy="470" r="96" fill="${p.accent}" opacity=".8"/>
    ${lines(640, 320, 480, 9, 30, p.bg, r, 0.45)}
    <rect x="80" y="700" width="1040" height="2" fill="${p.bg}" opacity=".3"/>
    <text x="80" y="760" font-family="${SERIF}" font-style="italic" font-size="30" fill="${p.bg}" opacity=".8">${esc(t.caption)}</text>`,

  // Official gazette: legal document with article hierarchy and seal.
  gazette: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.bg}"/>
    <rect x="90" y="60" width="1020" height="780" fill="none" stroke="${p.ink}" stroke-width="2" opacity=".35"/>
    <circle cx="600" cy="170" r="52" fill="none" stroke="${p.accent}" stroke-width="4"/>
    <circle cx="600" cy="170" r="38" fill="none" stroke="${p.accent}" stroke-width="2"/>
    <text x="600" y="182" text-anchor="middle" font-family="${SERIF}" font-size="30" fill="${p.accent}">RSH</text>
    <text x="600" y="280" text-anchor="middle" font-family="${SERIF}" font-size="44" fill="${p.ink}">${esc(t.title)}</text>
    <text x="600" y="322" text-anchor="middle" font-family="${SANS}" font-size="19" letter-spacing="4" fill="${p.ink}" opacity=".55">${esc(t.kicker)}</text>
    <line x1="420" y1="350" x2="780" y2="350" stroke="${p.ink}" stroke-width="1" opacity=".4"/>
    ${Array.from({ length: 4 }, (_, i) => `
      <text x="150" y="${420 + i * 110}" font-family="${SANS}" font-weight="700" font-size="17" fill="${p.accent}">Neni ${i + 1}</text>
      ${lines(150, 436 + i * 110, 900, 3, 22, p.ink, r, 0.45)}`).join("")}`,

  // Website mock: browser chrome over a layout that echoes this site.
  web: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.tint}"/>
    <rect x="90" y="90" width="1020" height="720" rx="10" fill="${p.bg}"/>
    <rect x="90" y="90" width="1020" height="52" rx="10" fill="${p.ink}" opacity=".9"/>
    <circle cx="126" cy="116" r="7" fill="${p.accent}"/><circle cx="150" cy="116" r="7" fill="${p.bg}" opacity=".4"/><circle cx="174" cy="116" r="7" fill="${p.bg}" opacity=".4"/>
    <rect x="220" y="104" width="620" height="24" rx="12" fill="${p.bg}" opacity=".18"/>
    <text x="130" y="250" font-family="${SANS}" font-weight="700" font-size="54" letter-spacing="-2" fill="${p.ink}">${esc(t.headline)}</text>
    ${lines(130, 285, 520, 3, 26, p.ink, r, 0.4)}
    <rect x="130" y="390" width="170" height="46" rx="23" fill="${p.ink}"/>
    <rect x="316" y="390" width="150" height="46" rx="23" fill="none" stroke="${p.ink}" stroke-opacity=".3"/>
    ${[0, 1, 2].map((i) => `<rect x="${130 + i * 306}" y="490" width="286" height="190" fill="${p.tint}"/><rect x="${130 + i * 306}" y="490" width="286" height="190" fill="${i === 1 ? p.accent : "none"}" opacity=".6"/>`).join("")}
    ${[0, 1, 2].map((i) => lines(130 + i * 306, 706, 286, 2, 22, p.ink, r, 0.4)).join("")}`,

  // Poster: one dominant word, geometric field.
  poster: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.bg}"/>
    <rect x="0" y="0" width="1200" height="480" fill="${p.accent}"/>
    <path d="M0 480 L400 120 L820 480Z" fill="${p.ink}" opacity=".9"/>
    <circle cx="960" cy="200" r="120" fill="${p.bg}" opacity=".85"/>
    <text x="70" y="620" font-family="${SANS}" font-weight="700" font-size="128" letter-spacing="-6" fill="${p.ink}">${esc(t.title)}</text>
    <text x="76" y="684" font-family="${SANS}" font-size="24" letter-spacing="9" fill="${p.accent}">${esc(t.kicker)}</text>
    ${lines(70, 730, 560, 3, 26, p.ink, r, 0.4)}
    <text x="1130" y="836" text-anchor="end" font-family="${SANS}" font-size="18" fill="${p.ink}" opacity=".5">${esc(t.date)}</text>`,

  // Menu / small print piece.
  menu: (p, r, t) => `
    <rect width="1200" height="900" fill="${p.tint}"/>
    <rect x="300" y="50" width="600" height="800" fill="${p.bg}"/>
    <text x="600" y="160" text-anchor="middle" font-family="${SERIF}" font-size="52" fill="${p.ink}">${esc(t.title)}</text>
    <text x="600" y="200" text-anchor="middle" font-family="${SANS}" font-size="17" letter-spacing="6" fill="${p.accent}">${esc(t.kicker)}</text>
    <line x1="420" y1="232" x2="780" y2="232" stroke="${p.accent}" stroke-width="2"/>
    ${Array.from({ length: 7 }, (_, i) => `
      <rect x="360" y="${290 + i * 72}" width="${(220 * (0.6 + r() * 0.4)).toFixed(0)}" height="7" fill="${p.ink}" opacity=".7"/>
      <rect x="360" y="${310 + i * 72}" width="${(300 * (0.5 + r() * 0.5)).toFixed(0)}" height="5" fill="${p.ink}" opacity=".32"/>
      <text x="840" y="${300 + i * 72}" text-anchor="end" font-family="${SANS}" font-size="19" fill="${p.accent}">${(4 + i * 2)}00</text>`).join("")}`,
};

// Each entry: [file, template, palette index, text]
const ART = [
  ["work-01", "newspaper", 0, { masthead: "Gazeta Shqiptare", date: "E premte, 12 Maj", headline: "Kryeqyteti rikthen sheshin" }],
  ["work-02", "exhibition", 2, { title: "BunkArt 2", kicker: "HISTORI / HISTORY", caption: "Sallat e brendshme, 1978" }],
  ["work-03", "gazette", 0, { title: "Fletorja Zyrtare", kicker: "REPUBLIKA E SHQIPERISE" }],
  ["work-04", "brand", 4, { title: "Nëntori", kicker: "STUDIO / 2023", }],
  ["work-05", "book", 1, { title: "Dritare mbi liqen", author: "Elira Hoxha", imprint: "BOTIME TIRANA" }],
  ["work-06", "web", 3, { headline: "Portofol 2025" }],
  ["work-07", "spread", 0, { headline: "Qyteti i ri", kicker: "URBANISTIKË", quote: "Forma ndjek tekstin.", caption: "Foto: arkiv" }],
  ["work-08", "magazine", 5, { masthead: "FOKUS", issue: "Nr. 42", headline: "Brezi që ndërton", kicker: "Dosje speciale" }],
  ["work-09", "poster", 2, { title: "TIPO", kicker: "JAVA E DIZAJNIT", date: "Tiranë 2024" }],
  ["work-10", "exhibition", 5, { title: "BunkArt 1", kicker: "MUZE / MUSEUM", caption: "Tuneli qendror" }],
  ["work-11", "book", 0, { title: "Kodi Civil", author: "Botim i tetë", imprint: "QBZ" }],
  ["work-12", "brand", 3, { title: "Ujëvara", kicker: "IDENTITET" }],
  ["work-13", "newspaper", 1, { masthead: "Suplement", date: "Shtojcë javore", headline: "Arti në periferi" }],
  ["work-14", "magazine", 4, { masthead: "SHIJE", issue: "Vjeshtë", headline: "Tryeza shqiptare", kicker: "Udhëzues" }],
  ["work-15", "menu", 1, { title: "Taverna e Vjetër", kicker: "TIRANË" }],
  ["work-16", "spread", 5, { headline: "Arkivi", kicker: "1996–2024", quote: "Njëzet e pesë vjet faqe.", caption: "Fletë provë" }],
  ["work-17", "web", 0, { headline: "Dyqani online" }],
  ["work-18", "poster", 4, { title: "FESTA", kicker: "KONCERT VEROR", date: "Korrik" }],
  ["work-19", "gazette", 1, { title: "Kushtetuta", kicker: "BOTIM ZYRTAR" }],
  ["work-20", "book", 5, { title: "Tipografia", author: "Manual universitar", imprint: "UMT" }],
];

let written = 0;
for (const [name, tpl, pal, text] of ART) {
  const r = rand(name.length + pal + tpl.length);
  const body = TEMPLATES[tpl](P[pal], r, text);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="${esc(text.title ?? text.headline ?? text.masthead ?? name)}">${body}</svg>`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg.replace(/\n\s*/g, ""));
  written++;
}

// Client logos are SQUARE marks, not wordmarks: the card prints the name beside the tile,
// so a wordmark would both duplicate it and shrink to an illegible smear inside 48px.
const PLATE = "#faf9f7";

// Each treatment fills a 120x120 box; `ink` is what the initials are drawn in.
const MARKS = {
  solidCircle: (c) => ({ bg: `<circle cx="60" cy="60" r="52" fill="${c}"/>`, ink: PLATE }),
  solidSquare: (c) => ({ bg: `<rect x="10" y="10" width="100" height="100" rx="6" fill="${c}"/>`, ink: PLATE }),
  solidRound: (c) => ({ bg: `<rect x="8" y="8" width="104" height="104" rx="32" fill="${c}"/>`, ink: PLATE }),
  ring: (c) => ({ bg: `<circle cx="60" cy="60" r="48" fill="none" stroke="${c}" stroke-width="9"/>`, ink: c }),
  outlineSquare: (c) => ({ bg: `<rect x="14" y="14" width="92" height="92" rx="4" fill="none" stroke="${c}" stroke-width="9"/>`, ink: c }),
  splitCircle: (c) => ({ bg: `<circle cx="60" cy="60" r="52" fill="${c}"/><path d="M60 8a52 52 0 0 0 0 104z" fill="${PLATE}" opacity=".22"/>`, ink: PLATE }),
  notch: (c) => ({ bg: `<path d="M10 10h100v70l-30 30H10z" fill="${c}"/>`, ink: PLATE }),
  triangle: (c) => ({ bg: `<path d="M60 12 116 108H4z" fill="${c}"/>`, ink: PLATE, dy: 26 }),
  rule: (c) => ({ bg: `<rect x="10" y="94" width="100" height="12" fill="${c}"/>`, ink: c, dy: -12 }),
  bars: (c) => ({ bg: `<rect x="12" y="24" width="14" height="72" fill="${c}" opacity=".35"/><rect x="94" y="24" width="14" height="72" fill="${c}" opacity=".35"/>`, ink: c }),
};

// [id, initials, treatment, colour, font] — every colour is AA-legible on the plate.
const LOGOS = [
  ["c-gazeta", "GS", "solidCircle", "#9c2f22", SERIF],
  ["c-edisud", "ED", "solidSquare", "#26406b", SANS],
  ["c-focus", "FP", "ring", "#2b2723", SANS],
  ["c-bunkart", "BA", "notch", "#4a5247", SANS],
  ["c-qbz", "QBZ", "outlineSquare", "#7a2a2a", SERIF],
  ["c-umt", "M", "triangle", "#235a69", SANS],
  ["c-news24", "24", "solidRound", "#a32219", SANS],
  ["c-balkanweb", "BW", "splitCircle", "#1f5f46", SANS],
  ["c-publishers", "B", "rule", "#6b5a42", SERIF],
  ["c-studio", "NS", "bars", "#b4462f", SANS],
];

for (const [id, initials, mark, colour, font] of LOGOS) {
  const { bg, ink, dy = 0 } = MARKS[mark](colour);
  const size = initials.length > 2 ? 32 : initials.length > 1 ? 42 : 54;
  const weight = font === SANS ? ' font-weight="700"' : "";
  // Baseline is set numerically; dominant-baseline is unreliable across SVG renderers.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${esc(id.replace("c-", ""))}">`
    + `${bg}<text x="60" y="${60 + size * 0.35 + dy}" text-anchor="middle" font-family="${font}"${weight} font-size="${size}" letter-spacing="-1" fill="${ink}">${esc(initials)}</text></svg>`;
  fs.writeFileSync(path.join(OUT, `logo-${id}.svg`), svg);
  written++;
}

// Portrait: an editorial figure, not a grey avatar circle.
const portrait = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000" role="img" aria-label="Portret">
<rect width="800" height="1000" fill="#e8e3d9"/>
<circle cx="400" cy="330" r="210" fill="#b4462f" opacity=".16"/>
<path d="M400 190c78 0 132 58 132 142 0 92-58 158-132 158s-132-66-132-158c0-84 54-142 132-142z" fill="#14110f" opacity=".88"/>
<path d="M268 318c0-96 58-150 132-150s132 54 132 150c0-42-44-58-132-58s-132 16-132 58z" fill="#14110f"/>
<path d="M150 1000c0-166 112-268 250-268s250 102 250 268z" fill="#14110f" opacity=".88"/>
<path d="M330 742c24 34 116 34 140 0l-16-44h-108z" fill="#14110f"/>
<circle cx="612" cy="196" r="54" fill="#b4462f"/>
<rect x="60" y="900" width="150" height="5" fill="#14110f" opacity=".45"/>
</svg>`;
fs.writeFileSync(path.join(OUT, "portrait.svg"), portrait.replace(/\n/g, ""));
written++;

// favicon.svg and og.* are real brand artwork now — tools/pdf-logo.mjs owns them.

const total = fs.readdirSync(OUT).filter((f) => f.endsWith(".svg")).length;
const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`wrote ${written} files · ${total} SVGs in assets/img · ${(bytes / 1024).toFixed(0)} KB total`);
