// Draws the footer's background: fine wave bundles for two opposite corners, in the purples of
// the category tiles. Run: node tools/waves.mjs — writes assets/img/footer-waves-a.svg and -b.svg.
import { writeFileSync } from "node:fs";

const LINE = "#5b47b8";  // between the tiles' violet (--brand-b) and the accent
const FILL = "#45338f";  // --brand-b
const W = 900, H = 560, LINES = 30, STEPS = 48;

// One ribbon of lines along a centreline that sweeps from the left edge up to the top edge.
// Each line's offset from the centre swings through a cosine, so the bundle twists and pinches.
function ribbon({ from, to, lift, width, twist }) {
  const paths = [];
  for (let k = 0; k < LINES; k++) {
    const s = k / (LINES - 1) - 0.5;
    const pts = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const x = from[0] + (to[0] - from[0]) * t;
      const y = from[1] + (to[1] - from[1]) * t ** 0.8 + lift * Math.sin(Math.PI * t);
      const w = width * (0.25 + 0.75 * Math.abs(Math.sin(Math.PI * t * 1.1)));
      pts.push(`${x.toFixed(1)} ${(y + w * s * Math.cos(twist * t + s)).toFixed(1)}`);
    }
    paths.push(`M${pts.join("L")}`);
  }
  return paths.join("");
}

const corner = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">`
  + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
  + `<stop offset="0" stop-color="${FILL}" stop-opacity=".22"/><stop offset=".55" stop-color="${FILL}" stop-opacity=".08"/><stop offset="1" stop-color="${FILL}" stop-opacity="0"/>`
  + `</linearGradient></defs>`
  // Soft filled wave behind the lines.
  + `<path fill="url(#g)" d="M0 0H${W}C760 40 640 30 540 70C420 120 360 40 250 110C160 170 90 230 0 300Z"/>`
  + `<path fill="none" stroke="${LINE}" stroke-width=".7" stroke-opacity=".4" d="${ribbon({ from: [-20, 300], to: [620, -20], lift: -40, width: 130, twist: 5.2 })}"/>`
  + `<path fill="none" stroke="${LINE}" stroke-width=".6" stroke-opacity=".24" d="${ribbon({ from: [-20, 200], to: [900, -30], lift: 30, width: 70, twist: 3.4 })}"/>`
  + `</svg>`;

const a = corner();
// The second corner is the first turned half a turn, so it sweeps in from the bottom right.
const b = a.replace(/aria-hidden="true">/, `aria-hidden="true"><g transform="rotate(180 ${W / 2} ${H / 2})">`).replace(/<\/svg>$/, "</g></svg>");
writeFileSync("assets/img/footer-waves-a.svg", a);
writeFileSync("assets/img/footer-waves-b.svg", b);
console.log("wrote footer-waves-a.svg", a.length, "and footer-waves-b.svg", b.length, "bytes");
