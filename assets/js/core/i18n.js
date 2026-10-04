// Translation engine: UI strings from /i18n/*.json, content strings from the store.

export const LANGS = [
  { code: "sq", label: "Shqip", english: "Albanian", dir: "ltr" },
  { code: "en", label: "English", english: "English", dir: "ltr" },
];

export const DEFAULT_LANG = "sq";
export const FALLBACK_LANG = "en";
const STORE_KEY = "nsa:lang";
const base = new URL("../../i18n/", import.meta.url);

const inflight = new Map();
const ready = new Map();
let current = DEFAULT_LANG;

const codes = () => LANGS.map((l) => l.code);
export const isSupported = (code) => codes().includes(code);
export const meta = (code = current) => LANGS.find((l) => l.code === code) ?? LANGS[0];

// URL ?lang wins, then the stored choice, then the browser, then the default.
// `fallback` comes from settings.defaultLang so the owner can change it in the panel.
export function detect(fallback = DEFAULT_LANG) {
  const fromURL = new URLSearchParams(location.search).get("lang");
  const stored = (() => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } })();
  const fromNav = navigator.languages?.map((l) => l.slice(0, 2)).find(isSupported);
  return [fromURL, stored, fromNav, fallback, DEFAULT_LANG].find((c) => c && isSupported(c));
}

// Fetched once per code; resolved bundles are kept so t() can stay synchronous.
function bundle(code) {
  if (ready.has(code)) return Promise.resolve(ready.get(code));
  if (!inflight.has(code)) {
    inflight.set(code, fetch(new URL(`${code}.json`, base), { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((json) => { ready.set(code, json); return json; }));
  }
  return inflight.get(code);
}

export const preload = (list = [current, FALLBACK_LANG]) => Promise.all(list.map(bundle));

export async function setLang(code) {
  current = isSupported(code) ? code : DEFAULT_LANG;
  await Promise.all([bundle(current), bundle(FALLBACK_LANG)]);
  try { localStorage.setItem(STORE_KEY, current); } catch { /* storage blocked */ }
  const { dir } = meta(current);
  Object.assign(document.documentElement, { lang: current, dir });
  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: current } }));
  return current;
}

export const getLang = () => current;

const dig = (obj, key) => key.split(".").reduce((o, k) => o?.[k], obj);

// t("nav.work", { n: 3 }) — falls back to English, then to the key itself.
export function t(key, vars) {
  const raw = dig(ready.get(current), key) ?? dig(ready.get(FALLBACK_LANG), key) ?? key;
  return vars ? String(raw).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`) : raw;
}

// Two-form plural: looks for `<key>One` when n is 1, otherwise `<key>`.
export const plural = (key, n) => t(n === 1 ? `${key}One` : key, { n });

// tr({sq:"…", en:"…"}) — the per-item shape admin-edited content uses.
export function tr(value, lang = current) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] || value[FALLBACK_LANG] || value[DEFAULT_LANG] || Object.values(value).find(Boolean) || "";
}

// Swap text/attributes for every [data-i18n] node in one pass.
export function apply(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const [key, attr] = node.dataset.i18n.split("@");
    const value = t(key);
    if (attr) node.setAttribute(attr, value);
    else node.textContent = value;
  });
  root.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    node.dataset.i18nAttr.split(",").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      node.setAttribute(attr, t(key));
    });
  });
}

export const fmtDate = (value, opts = { year: "numeric", month: "long" }) =>
  value ? new Intl.DateTimeFormat(current, opts).format(new Date(value)) : "";
export const fmtNumber = (value) => new Intl.NumberFormat(current).format(value);
