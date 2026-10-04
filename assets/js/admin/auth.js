// Admin gate. PLACEHOLDER AUTH: a fixed password until the database provides real
// verification. Everything here is client-side and must not be trusted as a control.

import { el, on } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { randomHex, RateLimiter, timingSafeEqual } from "../core/security.js";

// TEMPORARY. Delete this and the check below when the backend issues sessions.
export const DEV_PASSWORD = "admin";

const SESSION_KEY = "nsa:session";
const limiter = new RateLimiter("admin-login", { max: 10, windowMs: 5 * 60_000 });

export function currentSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return s && s.expires > Date.now() ? s : null;
  } catch { return null; }
}

const startSession = (minutes) => {
  const s = { token: randomHex(24), expires: Date.now() + minutes * 60_000 };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
};

export const endSession = () => { sessionStorage.removeItem(SESSION_KEY); location.reload(); };

// Any interaction pushes the expiry out; inactivity logs the owner out.
export function keepAlive(minutes) {
  const touch = () => { const s = currentSession(); if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, expires: Date.now() + minutes * 60_000 })); };
  ["pointerdown", "keydown"].forEach((type) => document.addEventListener(type, touch, { passive: true }));
  setInterval(() => { if (!currentSession()) endSession(); }, 30_000);
}

// Renders the login form into `host`; resolves once the password matches.
export function gate(host, sessionMinutes = 60) {
  return new Promise((resolve) => {
    const status = el("p.field__error", { role: "alert" });
    const password = el("input.input", { type: "password", id: "pw", autocomplete: "current-password", required: true });

    const form = el("form.stack", { novalidate: true },
      el("div.field", {}, el("label.field__label", { for: "pw", text: "Fjalëkalimi" }), password),
      el("button.btn.btn--primary", { type: "submit", text: "Hyr" }),
      status);

    on(form, "submit", (e) => {
      e.preventDefault();
      const blocked = limiter.blockedFor;
      if (blocked > 0) return void (status.textContent = `Shumë përpjekje. Provoni pas ${Math.ceil(blocked / 60_000)} minutash.`);

      if (timingSafeEqual(password.value, DEV_PASSWORD)) {
        limiter.reset();
        startSession(sessionMinutes);
        return resolve(true);
      }
      limiter.fail();
      status.textContent = "Fjalëkalim i gabuar.";
      password.select();
    });

    host.replaceChildren(
      el("div.admin-gate", {},
        el("div.panel", {},
          el("p.eyebrow", { html: `${icon("lock", { size: 16 })}<span>Paneli i administrimit</span>` }),
          el("h1", { style: "margin-block:var(--s-3) var(--s-5)", text: "Mirë se erdhe" }),
          form,
          el("p.tiny", { style: "margin-block-start:var(--s-4)", text: `Fjalëkalim i përkohshëm: «${DEV_PASSWORD}». Autentikimi i vërtetë vjen me bazën e të dhënave.` }))));
    password.focus();
  });
}
