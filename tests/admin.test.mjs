import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const NL = String.fromCharCode(10);
const errors = [];

const dom = new JSDOM(fs.readFileSync(path.join(root, "admin.html"), "utf8"), {
  url: "https://local.test/admin.html", pretendToBeVisual: true, runScripts: "outside-only",
});
const { window } = dom;

for (const k of ["window","document","navigator","location","localStorage","sessionStorage","CustomEvent","Event","EventTarget","DOMParser","Node","HTMLElement","FileReader","Blob","URL","matchMedia","getComputedStyle","AbortController","AbortSignal"]) {
  if (window[k] === undefined) continue;
  try { globalThis[k] = window[k]; } catch { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
}
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });
Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
globalThis.structuredClone ??= (v) => JSON.parse(JSON.stringify(v));
const mm = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia = mm;
Object.defineProperty(globalThis, "matchMedia", { value: mm, configurable: true, writable: true });
class IO { observe() {} unobserve() {} disconnect() {} }
window.IntersectionObserver = IO;
Object.defineProperty(globalThis, "IntersectionObserver", { value: IO, configurable: true, writable: true });
window.confirm = () => true;
Object.defineProperty(globalThis, "confirm", { value: () => true, configurable: true, writable: true });
Object.defineProperty(globalThis, "innerWidth", { value: 1280, configurable: true, writable: true });

Object.defineProperty(globalThis, "fetch", { value: async (input) => {
  const href = typeof input === "string" ? input : input.href ?? input.url;
  const file = href.startsWith("file:") ? fileURLToPath(href) : path.join(root, new URL(href, "https://local.test/").pathname.slice(1));
  if (!fs.existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
}, configurable: true, writable: true });

window.addEventListener("error", (e) => errors.push("window error: " + e.message));
const origError = console.error;
console.error = (...a) => { errors.push("console.error: " + a.map(String).join(" ")); origError(...a); };

const imp = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
const check = (label, cond, extra = "") => {
  report.push((cond ? "PASS  " : "FAIL  ") + label + (extra ? " — " + extra : ""));
  if (!cond) errors.push("check failed: " + label);
};
const submit = (form) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

await imp("assets/js/admin/main.js");
await wait(500);
const d = window.document;

check("login gate shown", !!d.querySelector(".admin-gate"));
check("gate asks for one password only", d.querySelectorAll(".admin-gate input[type=password]").length === 1, String(d.querySelectorAll(".admin-gate input[type=password]").length));
check("gate states the password is temporary", /përkohsh|përkohsh/i.test(d.querySelector(".admin-gate .tiny")?.textContent ?? "") || /përkoh/i.test(d.querySelector(".admin-gate")?.textContent ?? ""));

const pw = d.querySelector("#pw");
pw.value = "wrong-password";
submit(d.querySelector(".admin-gate form"));
await wait(200);
check("wrong password refused", !!d.querySelector(".admin-gate"));
check("failure is announced", /gabuar/i.test(d.querySelector(".admin-gate [role=alert]")?.textContent ?? ""));

pw.value = "admin";
submit(d.querySelector(".admin-gate form"));
await wait(800);
check("shell renders after setup", !!d.querySelector(".admin-bar"));
check("sidebar lists every panel", d.querySelectorAll(".admin-nav__item").length === 12, String(d.querySelectorAll(".admin-nav__item").length));
check("profile panel renders fields", d.querySelectorAll(".admin-panel .field").length > 5, String(d.querySelectorAll(".admin-panel .field").length));
check("language tabs rendered", d.querySelectorAll(".admin-panel .filters .chip").length >= 6);

const { store } = await imp("assets/js/core/store.js");
const nameInput = d.querySelector(".admin-panel input.input");
nameInput.value = "Nevila S. Akulli";
nameInput.dispatchEvent(new window.Event("change", { bubbles: true }));
check("an edit reaches the store", store.get("profile.name") === "Nevila S. Akulli", String(store.get("profile.name")));
check("dirty flag is raised", d.querySelector("#save-state").textContent.includes("paruajtura"));

const byLabel = (text) => [...d.querySelectorAll(".admin-nav__item")].find((b) => b.textContent.includes(text));

byLabel("Punët").click();
await wait(200);
const before = store.get("works").length;
check("repeater cards render", d.querySelectorAll(".admin-card").length > 0, String(d.querySelectorAll(".admin-card").length));
// Add must precede the list, and every mobile CSS hook must match a real element.
const listField = [...d.querySelectorAll(".admin-panel .field")].find((n) => n.querySelector(".list-add"));
check("add control sits above the list", !!listField && listField.querySelector(".list-add").compareDocumentPosition(listField.querySelector(".admin-card")) === 4);
check("exactly one add control per list", listField.querySelectorAll(".list-add").length === 1, String(listField.querySelectorAll(".list-add").length));
check("no stray add button after the cards", [...listField.querySelectorAll(".btn--ghost")].every((b) => b.closest(".list-add")));
check("list shows its item count", /[0-9]/.test(listField.querySelector(".list-add .tiny")?.textContent ?? ""));
for (const sel of [".admin-bar__who", ".admin-bar__view", ".admin-bar__out", ".admin-nav hr", "#save-state", ".admin-card > summary > span"])
  check(`mobile hook ${sel} exists`, !!d.querySelector(sel));
check("nested item fields render", !!d.querySelector(".admin-card__body .field"));
// Adding opens a draft dialog; nothing is committed until it is confirmed.
const addProject = () => [...d.querySelectorAll(".admin-panel .btn--ghost")].find((b) => b.textContent.includes("Shto projekt")).click();
addProject();
await wait(200);
const dlg = d.querySelector(".overlay [role=\"dialog\"]");
check("add opens a dialog", !!dlg);
check("dialog has cancel and confirm", d.querySelectorAll(".modal__actions .btn").length === 2, String(d.querySelectorAll(".modal__actions .btn").length));
check("nothing committed while drafting", store.get("works").length === before, String(store.get("works").length));

// Confirming an empty draft is refused and keeps the dialog open.
const confirmBtn = [...d.querySelectorAll(".modal__actions .btn")].at(-1);
confirmBtn.click();
await wait(60);
check("empty draft is rejected", store.get("works").length === before, String(store.get("works").length));
check("dialog stays open on invalid", !!d.querySelector(".overlay [role=\"dialog\"]"));
check("missing fields are named", /Plotësoni/.test(d.querySelector(".overlay .field__error")?.textContent ?? ""));

// Cancelling discards the draft entirely.
[...d.querySelectorAll(".modal__actions .btn")][0].click();
await wait(60);
check("cancel closes the dialog", !d.querySelector(".overlay"));
check("cancel leaves no empty record", store.get("works").length === before, String(store.get("works").length));
check("cancel clears the staged draft", store.get("__drafts.works") === undefined);

// A filled draft commits.
addProject();
await wait(200);
store.set("__drafts.works.title.sq", "Projekt testues");
store.set("__drafts.works.clientId", "c-bunkart");
[...d.querySelectorAll(".modal__actions .btn")].at(-1).click();
await wait(80);
check("valid draft commits", store.get("works").length === before + 1, String(store.get("works").length));
check("committed values survive", store.get("works").at(-1).title.sq === "Projekt testues");
check("draft cleared after commit", store.get("__drafts.works") === undefined);
check("drafts never reach an export", !JSON.parse(store.export()).__drafts);

// Client picker is built from live store data, not a static list.
const clientSelect = [...d.querySelectorAll(".admin-card__body select")].find((s) => [...s.options].some((o) => o.textContent === "BunkArt 1 & 2"));
check("client select is populated from the store", !!clientSelect);
check("client select lists every client", clientSelect && clientSelect.options.length === store.get("clients.items").length + 1, clientSelect ? String(clientSelect.options.length) : "-");
clientSelect.value = "c-bunkart";
clientSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
check("choosing a client links the project", store.get("works.0.clientId") === "c-bunkart" || store.get("works")[0].clientId === "c-bunkart");

// Per-project gallery editor.
check("gallery editor renders thumbnails", d.querySelectorAll(".gallery-item").length >= 2, String(d.querySelectorAll(".gallery-item").length));
const firstWorkImages = store.get("works.0.images").length;
d.querySelectorAll(".gallery-item__bar .icon-btn")[2].click();
await wait(100);
check("gallery delete works", store.get("works.0.images").length === firstWorkImages - 1, String(store.get("works.0.images").length));

// Clients panel gained sector and blurb.
byLabel("Klientët").click();
await wait(200);
check("client cards render", d.querySelectorAll(".admin-card").length >= 10, String(d.querySelectorAll(".admin-card").length));
// IDs are derived from the name now, so the panel must not expose them at all.
check("no ID field is shown", ![...d.querySelectorAll(".admin-card__body .field__label")].some((l) => /^ID/.test(l.textContent.trim())));
check("language chips are down to two", d.querySelector(".admin-panel .filters")?.querySelectorAll(".chip").length === 2, String(d.querySelector(".admin-panel .filters")?.querySelectorAll(".chip").length));

byLabel("Cilësimet").click();
await wait(200);
check("section reorder rows render", d.querySelectorAll(".admin-row").length === 7, String(d.querySelectorAll(".admin-row").length));

byLabel("Siguria").click();
await wait(200);
check("security panel renders", !!d.querySelector(".admin-panel .admin-warning"));
check("placeholder auth is flagged as temporary", /autentikim i p/i.test(d.querySelector(".admin-warning")?.textContent ?? ""));
check("warning names the fixed password", /admin/.test(d.querySelector(".admin-warning")?.textContent ?? ""));
check("no password rotation form is offered", !d.querySelector("#old") && !d.querySelector("#new"));

const auth = await imp("assets/js/admin/auth.js");
check("the dev password is a single known constant", auth.DEV_PASSWORD === "admin");
check("no hashing API is exposed by the gate", auth.changePassword === undefined && auth.isConfigured === undefined);

byLabel("Të dhënat").click();
await wait(200);
check("data panel renders", !!d.querySelector('input[type="file"]'));

await store.save();
check("save clears the dirty flag", store.dirty === false);
check("export carries the edit", JSON.parse(store.export()).profile.name === "Nevila S. Akulli");
check("export carries no password hash", !store.export().includes("pbkdf2"));
check("no credential is written into content.json", !/passwordHash|password/i.test(JSON.stringify(JSON.parse(store.export()).admin ?? {})));

console.log(NL + report.join(NL));
console.log(errors.length ? NL + errors.length + " ERRORS:" + NL + errors.join(NL) : NL + "No runtime errors.");
process.exit(errors.length ? 1 : 0);
