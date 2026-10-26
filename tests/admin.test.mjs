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
check("no standalone profile panel", ![...d.querySelectorAll(".admin-nav__item")].some((b) => b.textContent.includes("Profili")));
check("first panel renders fields", d.querySelectorAll(".admin-panel .field").length > 5, String(d.querySelectorAll(".admin-panel .field").length));
check("language tabs rendered", d.querySelectorAll(".admin-panel .filters .chip").length >= 6);

const { store } = await imp("assets/js/core/store.js");
const nameInput = d.querySelector(".admin-panel input.input");
nameInput.value = "Nevila S. Akulli";
nameInput.dispatchEvent(new window.Event("change", { bubbles: true }));
check("an edit reaches the store", store.get("profile.name") === "Nevila S. Akulli", String(store.get("profile.name")));
check("dirty flag is raised", d.querySelector("#save-state").textContent.includes("paruajtura"));

const byLabel = (text) => [...d.querySelectorAll(".admin-nav__item")].find((b) => b.textContent.includes(text));

// Live preview: closed on a narrow screen, then fed unsaved edits once the frame reports in.
const pane = d.querySelector(".preview");
check("preview pane starts closed on a narrow screen", !!pane && pane.hidden && !pane.querySelector("iframe"));
d.querySelector(".admin-bar__preview").click();
const frame = pane.querySelector("iframe");
check("toggle opens the preview", !pane.hidden && d.querySelector(".admin-bar__preview").getAttribute("aria-pressed") === "true");
check("preview frames the site in preview mode", /\?preview/.test(frame?.getAttribute("src") ?? ""));
check("layout makes room for the preview", d.querySelector(".admin-layout").classList.contains("admin-layout--preview"));
check("the page may frame only itself", /frame-src 'self'/.test(d.querySelector('meta[http-equiv="Content-Security-Policy"]').content));

const posted = [];
frame.contentWindow.postMessage = (message) => posted.push(message);
nameInput.value = "Before the frame is ready";
nameInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await wait(250);
check("nothing is posted before the frame is ready", posted.length === 0, String(posted.length));
window.dispatchEvent(new window.MessageEvent("message", { data: { type: "nsa:preview-ready" }, origin: "https://elsewhere.test", source: frame.contentWindow }));
check("a foreign origin is ignored", posted.length === 0, String(posted.length));
window.dispatchEvent(new window.MessageEvent("message", { data: { type: "nsa:preview-ready" }, origin: window.location.origin, source: frame.contentWindow }));
check("ready frame receives the content", posted.length === 1 && JSON.parse(posted[0].content).profile.name === "Before the frame is ready");
check("preview is pointed at the panel's section", posted[0]?.focus === "hero", String(posted[0]?.focus));

nameInput.value = "Typed, not saved";
nameInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await wait(250);
check("typing reaches the preview unsaved", JSON.parse(posted.at(-1).content).profile.name === "Typed, not saved");
check("drafts never reach the preview", !JSON.parse(posted.at(-1).content).__drafts);
nameInput.value = "Nevila S. Akulli";
nameInput.dispatchEvent(new window.Event("change", { bubbles: true }));

// The editing language is one shared choice, and the preview speaks it.
const langChips = (lang) => [...d.querySelectorAll(`.admin-panel .filters .chip[data-lang="${lang}"]`)];
langChips("en")[0].click();
check("one language switch moves every field", langChips("en").length > 1 && langChips("en").every((c) => c.getAttribute("aria-pressed") === "true"));
check("preview follows the editing language", posted.at(-1)?.lang === "en", String(posted.at(-1)?.lang));
langChips("sq")[0].click();

byLabel("Punët").click();
await wait(200);
check("switching panels keeps the same frame", d.querySelector(".preview iframe") === frame);
check("preview follows the active panel", posted.at(-1)?.focus === "work", String(posted.at(-1)?.focus));
check("project cards show a cover thumbnail", d.querySelectorAll(".admin-card > summary > img.admin-card__thumb").length > 0, String(d.querySelectorAll(".admin-card__thumb").length));
check("project cards show client and year", /·/.test(d.querySelector(".admin-card__meta")?.textContent ?? ""), d.querySelector(".admin-card__meta")?.textContent);
d.querySelector(".preview .icon-btn").click();
check("preview closes from its own bar", pane.hidden && !d.querySelector(".admin-layout").classList.contains("admin-layout--preview"));
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
check("no stray \"null\" text in the panel", ![...d.querySelectorAll(".admin-panel *")].some((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim() === "null")));
check("the badge toggle says what it does", [...d.querySelectorAll(".admin-card__body .checkbox")].some((c) => /etiketën e kategorisë/.test(c.textContent)) && ![...d.querySelectorAll(".admin-card__body .checkbox")].some((c) => c.textContent.trim() === "Në pah"));
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
[...d.querySelectorAll(".modal__actions .btn")].at(-1).click();
await wait(80);
check("valid draft commits", store.get("works").length === before + 1, String(store.get("works").length));
check("committed values survive", store.get("works").at(-1).title.sq === "Projekt testues");
check("draft cleared after commit", store.get("__drafts.works") === undefined);
check("drafts never reach an export", !JSON.parse(store.export()).__drafts);

// Projects carry a free-text credit; there are no client records to link to.
check("project has no client picker", ![...d.querySelectorAll(".admin-card__body select")].some((s) => [...s.options].some((o) => o.textContent === "pa klient")));
check("category picker offers the eight categories", [...d.querySelectorAll(".admin-card__body select")].some((s) => s.options.length === store.get("categories").length && [...s.options].some((o) => o.value === "books")));
// Per-project gallery editor.
check("gallery editor renders thumbnails", d.querySelectorAll(".gallery-item").length >= 2, String(d.querySelectorAll(".gallery-item").length));
const firstWorkImages = store.get("works.0.images").length;
d.querySelectorAll(".gallery-item__bar .icon-btn")[2].click();
await wait(100);
check("gallery delete works", store.get("works.0.images").length === firstWorkImages - 1, String(store.get("works.0.images").length));

// Categories panel: the word, her line, and the files a visitor opens from the tile.
byLabel("Kategoritë").click();
await wait(200);
check("category cards render", d.querySelectorAll(".admin-card").length === 8, String(d.querySelectorAll(".admin-card").length));
check("the panel lists categories in Albanian whatever the browser language", d.querySelector(".admin-card summary span")?.firstChild.textContent.trim() === "Branding total", d.querySelector(".admin-card summary span")?.firstChild.textContent);
check("no clients panel remains", !byLabel("Klientët"));
check("testimonials have their own panel", !!byLabel("Referencat"));
// IDs are derived from the name now, so the panel must not expose them at all.
check("no ID field is shown", ![...d.querySelectorAll(".admin-card__body .field__label")].some((l) => /^ID/.test(l.textContent.trim())));
check("language chips are down to two", d.querySelector(".admin-panel .filters")?.querySelectorAll(".chip").length === 2, String(d.querySelector(".admin-panel .filters")?.querySelectorAll(".chip").length));
check("each category takes a line and files", ["Fjala", "Rreshti poshtë fjalës", "Skedarët brenda (PDF ose JPG)"].every((x) => [...d.querySelectorAll(".admin-card__body .field__label")].some((l) => l.textContent.trim() === x)));
const iconSelect = [...d.querySelectorAll(".admin-card__body select")].find((s) => [...s.options].some((o) => o.value === "shapes"));
check("each category has an icon picker set to its icon", iconSelect?.value === "shapes", String(iconSelect?.value));
check("file picker accepts PDFs and images", /pdf/.test(d.querySelector('.admin-card__body input[type="file"]')?.getAttribute("accept") ?? "") && /image/.test(d.querySelector('.admin-card__body input[type="file"]')?.getAttribute("accept") ?? ""));
const linkInput = d.querySelector(".admin-card__body .file-link input");
linkInput.value = "assets/docs/Katalog%202024.pdf";
d.querySelector(".admin-card__body .file-link button").click();
check("a pasted path is filed under the category", store.get("categories.0.files").length === 1 && store.get("categories.0.files.0.src") === "assets/docs/Katalog%202024.pdf", JSON.stringify(store.get("categories.0.files")));
check("the file is named from its path", store.get("categories.0.files.0.name") === "Katalog 2024.pdf", store.get("categories.0.files.0.name"));
check("a PDF shows as a labelled plate", d.querySelector(".admin-card__body .file-thumb")?.textContent === "PDF");
d.querySelector(".admin-card__body .gallery-item__bar .icon-btn:last-child").click();
check("a file can be removed", store.get("categories.0.files").length === 0);

// Services: a photo gallery whose captions she writes herself.
byLabel("Shërbimet").click();
await wait(200);
const svcPicker = d.querySelector('.admin-card__body input[type="file"]');
check("services take photos only", svcPicker?.getAttribute("accept") === "image/*", svcPicker?.getAttribute("accept"));
check("a service is just a title and its photos", [...d.querySelectorAll(".admin-card:first-of-type .admin-card__body > .field > .field__label")].map((l) => l.textContent.trim()).join("|") === "Titulli|Galeria (foto)", [...d.querySelectorAll(".admin-card:first-of-type .admin-card__body > .field > .field__label")].map((l) => l.textContent.trim()).join("|"));
const svcLink = d.querySelector(".admin-card__body .file-link input");
svcLink.value = "assets/img/IMG_2041.jpg";
d.querySelector(".admin-card__body .file-link button").click();
check("a service photo starts without a file-name caption", store.get("services.items.0.images.0.name") === "", JSON.stringify(store.get("services.items.0.images")));
const caption = d.querySelector(".admin-card__body .file-caption");
caption.value = "Logo për verë";
caption.dispatchEvent(new window.Event("change", { bubbles: true }));
check("a caption is typed per photo", store.get("services.items.0.images.0.name") === "Logo për verë");
store.removeAt("services.items.0.images", 0);
byLabel("Punët").click();
await wait(200);
check("projects no longer ask for a summary", ![...d.querySelectorAll(".admin-card__body .field__label")].some((l) => /Përmbledhje/.test(l.textContent)));
// A bullet list typed into a multi-line field keeps one bullet per line once saved.
byLabel("Fundi i faqes").click();
await wait(200);
const blurb = d.querySelector(".admin-panel textarea");
blurb.value = "• Studio dizajni grafik\n• Zhvillimi i faqeve web";
blurb.dispatchEvent(new window.Event("change", { bubbles: true }));
check("multi-line fields keep their line breaks", Object.values(store.get("footer.blurb")).includes("• Studio dizajni grafik\n• Zhvillimi i faqeve web"), JSON.stringify(store.get("footer.blurb")));

// Profile fields live where the site shows them.
const labels = () => [...d.querySelectorAll(".admin-panel .field__label")].map((l) => l.textContent.trim());
byLabel("Kontakti").click();
await wait(200);
check("contact panel edits email, phone and location", ["Email", "Telefon", "Vendndodhja"].every((x) => labels().includes(x)), labels().join(", "));
const emailInput = d.querySelector('.admin-panel input[type="email"]');
emailInput.value = "studio@example.test";
emailInput.dispatchEvent(new window.Event("change", { bubbles: true }));
check("moved fields still write to profile", store.get("profile.email") === "studio@example.test", String(store.get("profile.email")));
byLabel("Rreth meje").click();
await wait(200);
check("about panel edits the portrait and CV", ["Portreti", "Lidhja e CV-së (PDF)"].every((x) => labels().includes(x)), labels().join(", "));

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
