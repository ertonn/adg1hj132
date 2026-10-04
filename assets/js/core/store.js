// Content store: seed JSON + swappable persistence adapter + change subscriptions.
// Swap LocalAdapter for RestAdapter when the database lands — nothing else changes.

const SEED_URL = new URL("../../data/content.json", import.meta.url).href;
const KEY = "nsa:content";

// Adapters only need load/save/reset; the store owns merging and notification.
export const LocalAdapter = {
  name: "local",
  async load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  async save(data) { localStorage.setItem(KEY, JSON.stringify(data)); return data; },
  async reset() { localStorage.removeItem(KEY); },
};

// Drop-in replacement once an API exists: new RestAdapter("/api/content").
export class RestAdapter {
  constructor(base, headers = {}) { Object.assign(this, { name: "rest", base, headers }); }
  #req(method, body) {
    return fetch(this.base, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": sessionStorage.getItem("csrf") ?? "", ...this.headers },
      body: body && JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${method} ${r.status}`))));
  }
  load() { return this.#req("GET").catch(() => null); }
  save(data) { return this.#req("PUT", data); }
  reset() { return this.#req("DELETE"); }
}

// Deep merge so a new seed field appears without wiping the owner's edits.
export function merge(base, patch) {
  if (Array.isArray(patch) || patch === null || typeof patch !== "object") return structuredClone(patch ?? base);
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) out[k] = k in base ? merge(base[k], v) : structuredClone(v);
  return out;
}

const get = (obj, path) => path.split(".").reduce((o, k) => o?.[Array.isArray(o) ? Number(k) : k], obj);

// Write a dotted path, creating objects/arrays as the path implies.
function set(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k, i) => (o[k] ??= /^\d+$/.test(keys[i + 1] ?? last) ? [] : {}), obj);
  if (value === undefined) Array.isArray(target) ? target.splice(Number(last), 1) : delete target[last];
  else target[last] = value;
  return obj;
}

class Store extends EventTarget {
  #data = null;
  #seed = null;
  #dirty = false;

  constructor(adapter = LocalAdapter) { super(); this.adapter = adapter; }

  get data() { return this.#data; }
  get dirty() { return this.#dirty; }

  async init() {
    this.#seed = await fetch(SEED_URL, { cache: "no-cache" }).then((r) => r.json());
    const saved = await this.adapter.load();
    this.#data = saved ? merge(this.#seed, saved) : structuredClone(this.#seed);
    this.#emit("ready");
    return this.#data;
  }

  get(path, fallback) { return path ? get(this.#data, path) ?? fallback : this.#data; }

  // Every mutation funnels here so listeners and the dirty flag stay honest.
  set(path, value, { silent = false } = {}) {
    set(this.#data, path, value);
    this.#dirty = true;
    if (!silent) this.#emit("change", { path, value });
    return value;
  }

  push(path, value) { const list = this.get(path, []); list.push(value); return this.set(path, list); }
  removeAt(path, index) { const list = [...this.get(path, [])]; list.splice(index, 1); return this.set(path, list); }
  move(path, from, to) {
    const list = [...this.get(path, [])];
    if (to < 0 || to >= list.length) return list;
    list.splice(to, 0, ...list.splice(from, 1));
    return this.set(path, list);
  }

  // Staged edits live under __drafts until committed, so a cancelled add leaves no trace.
  beginDraft(key, blank) {
    this.set(`__drafts.${key}`, structuredClone(blank), { silent: true });
    return `__drafts.${key}`;
  }

  commitDraft(key, listPath) {
    const value = this.get(`__drafts.${key}`);
    if (value === undefined) return null;
    this.cancelDraft(key);
    this.push(listPath, value);
    return value;
  }

  cancelDraft(key) { this.set(`__drafts.${key}`, undefined, { silent: true }); }

  // Drafts are scratch space; they never reach the adapter or an export.
  #publishable() {
    const { __drafts, ...rest } = this.#data;
    return rest;
  }

  async save() {
    this.#data.meta = { ...this.#data.meta, updatedAt: new Date().toISOString() };
    await this.adapter.save(this.#publishable());
    this.#dirty = false;
    this.#emit("save");
    return this.#data;
  }

  async resetToSeed() {
    await this.adapter.reset();
    this.#data = structuredClone(this.#seed);
    this.#dirty = false;
    this.#emit("change", { path: "*" });
    return this.#data;
  }

  // Import/export give the owner a backup path before any database exists.
  export() { return JSON.stringify(this.#publishable(), null, 2); }
  async import(json) {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid content file");
    this.#data = merge(this.#seed, parsed);
    this.#dirty = true;
    this.#emit("change", { path: "*" });
    return this.#data;
  }

  on(type, fn) { this.addEventListener(type, fn); return () => this.removeEventListener(type, fn); }
  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
}

export const store = new Store(LocalAdapter);
