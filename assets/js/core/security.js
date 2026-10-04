// Client-side security primitives: sanitising, hashing, throttling, validation.
// NOTE: browser code can only harden UX. Re-run every check on the server once a backend exists.

const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "EM", "B", "I", "U", "UL", "OL", "LI", "A", "H2", "H3", "H4", "BLOCKQUOTE", "CODE", "HR", "SPAN"]);
const ALLOWED_ATTR = { A: ["href", "title", "target", "rel"], SPAN: ["class"] };
// These are deleted whole — unwrapping them would surface their source as text.
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE", "LINK", "META", "SVG", "MATH", "FORM"]);

// Strip everything not on the allow-list; used for any admin-authored rich text.
export function sanitizeHTML(dirty) {
  const doc = new DOMParser().parseFromString(`<div>${dirty ?? ""}</div>`, "text/html");
  const walk = (node) => {
    [...node.children].forEach((child) => {
      if (DROP_WITH_CONTENT.has(child.tagName)) return child.remove();
      if (!ALLOWED_TAGS.has(child.tagName)) return child.replaceWith(...child.childNodes);
      [...child.attributes].forEach((attr) => {
        const ok = (ALLOWED_ATTR[child.tagName] || []).includes(attr.name.toLowerCase());
        if (!ok || (attr.name === "href" && safeURL(attr.value, "") === "")) child.removeAttribute(attr.name);
      });
      if (child.tagName === "A" && child.target === "_blank") child.rel = "noopener noreferrer";
      walk(child);
    });
  };
  walk(doc.body.firstElementChild);
  return doc.body.firstElementChild.innerHTML;
}

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const INLINE_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,[a-z0-9+/=]+$/i;

// Allows relative paths and the admin uploader's data URIs; blocks javascript: and friends.
export function safeURL(url, fallback = "#") {
  const raw = String(url ?? "").trim();
  if (!raw) return fallback;
  // Probe a whitespace-stripped copy so "java\tscript:" cannot slip past the scheme check.
  const probe = raw.replace(/[\s\p{Cc}]/gu, "");
  if (INLINE_IMAGE.test(probe)) return raw;
  if (probe.startsWith("//")) return fallback;
  const scheme = probe.match(SCHEME);
  if (scheme) return ALLOWED_SCHEMES.has(scheme[1].toLowerCase()) ? raw : fallback;
  return raw;
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v ?? "").trim());
export const isPhone = (v) => /^[+()\d\s.-]{6,24}$/.test(String(v ?? "").trim());
export const isURL = (v) => { try { const u = new URL(v); return ["http:", "https:"].includes(u.protocol); } catch { return false; } };

// Drop control characters, collapse runs of whitespace, hard-cap length.
export const clean = (v, max = 2000) => String(v ?? "").replace(/\p{Cc}/gu, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const randomHex = (bytes = 16) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

// PBKDF2-SHA256; the salt travels with the hash so records are self-contained.
export async function hashPassword(password, salt = randomHex(16), iterations = 210_000) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${iterations}$${salt}$${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt] = String(stored ?? "").split("$");
  if (scheme !== "pbkdf2") return false;
  return timingSafeEqual(await hashPassword(password, salt, Number(iterations)), stored);
}

// Constant-time compare so a wrong guess leaks no timing signal.
export function timingSafeEqual(a = "", b = "") {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Exponential lockout for login and form submission attempts.
export class RateLimiter {
  constructor(key, { max = 5, windowMs = 15 * 60_000 } = {}) { Object.assign(this, { key: `rl:${key}`, max, windowMs }); }
  #read() { try { return JSON.parse(localStorage.getItem(this.key)) ?? { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; } }
  #write(v) { try { localStorage.setItem(this.key, JSON.stringify(v)); } catch { /* storage blocked */ } }
  get blockedFor() { return Math.max(0, this.#read().until - Date.now()); }
  fail() {
    const s = this.#read();
    s.n += 1;
    if (s.n >= this.max) s.until = Date.now() + this.windowMs * Math.min(8, 2 ** (s.n - this.max));
    this.#write(s);
    return s;
  }
  reset() { this.#write({ n: 0, until: 0 }); }
}

// Per-session token echoed by forms so a cross-site POST cannot reuse a page.
export function csrfToken() {
  let token = sessionStorage.getItem("csrf");
  if (!token) { token = randomHex(24); sessionStorage.setItem("csrf", token); }
  return token;
}
export const verifyCSRF = (token) => timingSafeEqual(token ?? "", sessionStorage.getItem("csrf") ?? " ");

// Reject submissions filled faster than a human could type, or with the honeypot set.
export const looksLikeBot = ({ elapsedMs, honeypot }) => Boolean(honeypot) || elapsedMs < 2500;
