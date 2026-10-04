// One inline SVG path table — no sprite file, no icon font, no extra request.

const PATHS = {
  spark: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5zM8 3v18"/>',
  code: '<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-2-11-4 14"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5"/>',
  play: '<path d="M5 4.5v15l13-7.5z"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-1.5a4 4 0 0 0-3-3.9M16 3.6a4 4 0 0 1 0 7.7"/>',
  mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>',
  phone: '<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11"/><circle cx="12" cy="10" r="2.6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M14.5 8.5H17V5h-2.5A4 4 0 0 0 10.5 9v2H8v3.5h2.5V22H14v-7.5h2.6l.4-3.5H14V9.4c0-.5.2-.9.5-.9"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7.5 10.5V17M7.5 7.2v.1M11.5 17v-3.6a2.4 2.4 0 0 1 4.8 0V17"/>',
  behance: '<path d="M2 6h5.5a3 3 0 0 1 0 6H2zm0 6h6a3 3 0 0 1 0 6H2zM14.5 8.5H21M14 14.5h7a3.5 3.5 0 1 0-7 0v.5a3 3 0 0 0 5.6 1.5"/>',
  x: '<path d="m4 4 16 16M20 4 4 20"/>',
  save: '<path d="M4 4h13l3 3v13H4zM8 4v6h8V4M8 20v-6h8v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16"/>',
  upload: '<path d="M12 21V9m0 0 4 4M12 9 8 13M4 5h16"/>',
  reset: '<path d="M4 4v6h6M4 10a8 8 0 1 1 2 6"/>',
  check: '<path d="m5 13 4 4 10-10"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
  moon: '<path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2"/>',
};

// icon("mail", { class: "service__icon" }) → <svg> string for html:/innerHTML.
export function icon(name, { size = 24, cls = "" } = {}) {
  const body = PATHS[name] ?? PATHS.spark;
  return `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export const hasIcon = (name) => name in PATHS;
