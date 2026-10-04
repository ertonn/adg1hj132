// GDPR / Law 9887 consent: granular categories, versioned, revocable at any time.

import { el, on, trapFocus } from "./dom.js";
import { t } from "./i18n.js";

const KEY = "nsa:consent";
const VERSION = 1;

// "necessary" is locked on; everything else defaults to off until opted in.
export const CATEGORIES = ["necessary", "preferences", "analytics", "marketing"];

export const readConsent = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved?.version === VERSION ? saved : null;
  } catch { return null; }
};

export const hasConsent = (category) => category === "necessary" || Boolean(readConsent()?.granted?.includes(category));

export function saveConsent(granted) {
  const record = { version: VERSION, at: new Date().toISOString(), granted: [...new Set(["necessary", ...granted])] };
  try { localStorage.setItem(KEY, JSON.stringify(record)); } catch { /* storage blocked */ }
  document.dispatchEvent(new CustomEvent("consentchange", { detail: record }));
  return record;
}

export function revokeConsent() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } location.reload(); }

// Bar first; the dialog only appears if the visitor wants per-category control.
export function mountConsent(host = document.body, { privacyHref = "legal/privacy.html", cookieHref = "legal/cookies.html" } = {}) {
  if (readConsent()) return null;

  const bar = el("aside.cookie-bar", { role: "region", "aria-label": t("consent.title") });
  const done = (granted) => { saveConsent(granted); bar.remove(); };

  bar.append(el("div.cookie-bar__inner", {},
    el("p", { html: `${t("consent.body")} <a href="${cookieHref}">${t("consent.cookiePolicy")}</a> · <a href="${privacyHref}">${t("consent.privacyPolicy")}</a>` }),
    el("div.row", {},
      el("button.btn.btn--sm", { type: "button", text: t("consent.customise"), onclick: () => openPreferences(host, done) }),
      el("button.btn.btn--sm", { type: "button", text: t("consent.rejectAll"), onclick: () => done([]) }),
      el("button.btn.btn--sm.btn--primary", { type: "button", text: t("consent.acceptAll"), onclick: () => done(CATEGORIES) }))));

  host.append(bar);
  return bar;
}

export function openPreferences(host = document.body, onDone) {
  const current = readConsent()?.granted ?? ["necessary"];
  const overlay = el("div.overlay", { role: "presentation" });
  const panel = el("div.panel", { role: "dialog", "aria-modal": "true", "aria-labelledby": "consent-title" });
  const close = () => { release(); overlay.remove(); };

  const rows = CATEGORIES.map((c) =>
    el("label.checkbox", {},
      el("input", { type: "checkbox", name: c, checked: c === "necessary" || current.includes(c), disabled: c === "necessary" }),
      el("span", {}, el("strong", { text: t(`consent.cat.${c}`) }), el("br"), el("span.tiny", { text: t(`consent.catDesc.${c}`) }))));

  const chosen = () => rows.filter((r) => r.querySelector("input").checked).map((r) => r.querySelector("input").name);

  panel.append(
    el("div.panel__head", {},
      el("h2", { id: "consent-title", text: t("consent.prefsTitle") }),
      el("button.icon-btn", { type: "button", "aria-label": t("common.close"), onclick: close, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>' })),
    el("p.muted", { text: t("consent.prefsBody") }),
    el("div.stack", { style: "margin-block:1.5rem" }, rows),
    el("div.row", {},
      el("button.btn.btn--primary", { type: "button", text: t("consent.savePrefs"), onclick: () => { onDone ? onDone(chosen()) : saveConsent(chosen()); close(); } }),
      el("button.btn.btn--ghost", { type: "button", text: t("consent.acceptAll"), onclick: () => { onDone ? onDone(CATEGORIES) : saveConsent(CATEGORIES); close(); } })));

  on(overlay, "click", (e) => { if (e.target === overlay) close(); });
  overlay.append(panel);
  host.append(overlay);
  const release = trapFocus(panel, close);
  return overlay;
}
