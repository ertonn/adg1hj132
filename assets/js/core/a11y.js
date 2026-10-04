// Accessibility preferences: persisted on <html> as data-* attributes read by CSS.

import { el, on, trapFocus } from "./dom.js";
import { t } from "./i18n.js";

const KEY = "nsa:a11y";

// Each preference is one attribute with an explicit option list — CSS does the rest.
export const PREFS = {
  // Light is the default; "auto" is opt-in for visitors who want the OS to decide.
  theme: { attr: "data-theme", values: ["light", "dark", "auto"], fallback: "light" },
  textSize: { attr: "data-text-size", values: ["md", "lg", "xl"], fallback: "md" },
  contrast: { attr: "data-contrast", values: ["normal", "high"], fallback: "normal" },
  motion: { attr: "data-motion", values: ["auto", "reduced"], fallback: "auto" },
  font: { attr: "data-font", values: ["default", "readable"], fallback: "default" },
  spacing: { attr: "data-spacing", values: ["normal", "loose"], fallback: "normal" },
  underline: { attr: "data-underline", values: ["off", "on"], fallback: "off" },
};

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };

let state = {};

export function getPref(name) { return state[name] ?? PREFS[name].fallback; }

export function setPref(name, value) {
  const spec = PREFS[name];
  if (!spec?.values.includes(value)) return;
  state[name] = value;
  write(state);
  paint();
  document.dispatchEvent(new CustomEvent("a11ychange", { detail: { name, value } }));
}

export function resetPrefs() { state = {}; write(state); paint(); document.dispatchEvent(new CustomEvent("a11ychange", { detail: { name: "*" } })); }

const GROUND = { light: "#faf9f7", dark: "#100e0d" };
const prefersDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

// The stored theme may be "auto"; the attribute is always an explicit light or dark.
export const resolvedTheme = () => (getPref("theme") === "auto" ? (prefersDark() ? "dark" : "light") : getPref("theme"));

// Every other preference clears its attribute when it is at the neutral default.
function paint() {
  const root = document.documentElement;
  for (const [name, spec] of Object.entries(PREFS)) {
    if (name === "theme") continue;
    const value = getPref(name);
    if (value === spec.fallback) root.removeAttribute(spec.attr);
    else root.setAttribute(spec.attr, value);
  }
  const theme = resolvedTheme();
  root.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", GROUND[theme]);
}

export function initA11y() {
  state = read();
  paint();
  // While the preference is "auto", follow the operating system as it changes.
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (getPref("theme") === "auto") { paint(); document.dispatchEvent(new CustomEvent("a11ychange", { detail: { name: "theme" } })); } });
  return state;
}

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="4.2" r="1.8" fill="currentColor" stroke="none"/><path d="M4 8h16M12 8v5m0 0-3.2 7M12 13l3.2 7" stroke-linecap="round"/></svg>';

// Floating dock; options come straight from PREFS so adding one needs no markup.
export function mountA11yDock(host = document.body) {
  const dock = el("div.a11y-dock");
  const panel = el("div.a11y-dock__panel", { role: "dialog", "aria-modal": "false", "aria-label": t("a11y.title"), hidden: true });
  const toggle = el("button.a11y-dock__toggle", {
    type: "button",
    "aria-expanded": "false",
    "aria-haspopup": "dialog",
    "data-i18n-attr": "aria-label:a11y.open,title:a11y.open",
    html: ICON,
  });

  let release = null;
  const close = () => { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); release?.(); release = null; };
  const open = () => { render(); panel.hidden = false; toggle.setAttribute("aria-expanded", "true"); release = trapFocus(panel, close); };

  function render() {
    const groups = Object.entries(PREFS).map(([name, spec]) =>
      el("div.a11y-group", {},
        el("span.a11y-group__label", { id: `a11y-${name}`, text: t(`a11y.${name}`) }),
        el("div.a11y-options", { role: "group", "aria-labelledby": `a11y-${name}` },
          spec.values.map((value) =>
            el("button.chip", {
              type: "button",
              "aria-pressed": String(getPref(name) === value),
              text: t(`a11y.value.${value}`),
              onclick: () => { setPref(name, value); render(); },
            })))));
    panel.replaceChildren(
      el("div.row", {}, el("strong", { text: t("a11y.title") }),
        el("button.icon-btn.push", { type: "button", "aria-label": t("common.close"), onclick: close, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>' })),
      ...groups,
      el("button.btn.btn--ghost.btn--sm", { type: "button", text: t("a11y.reset"), onclick: () => { resetPrefs(); render(); } }),
      el("p.tiny", { text: t("a11y.note") }));
  }

  on(toggle, "click", () => (panel.hidden ? open() : close()));
  on(document, "click", (e) => { if (!panel.hidden && !dock.contains(e.target)) close(); });
  document.addEventListener("langchange", () => { if (!panel.hidden) render(); });
  document.addEventListener("a11ychange", () => { if (!panel.hidden) render(); });

  dock.append(panel, toggle);
  host.append(dock);
  return dock;
}
