import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const errors = [];

const dom = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"), {
  url: "https://local.test/", pretendToBeVisual: true, runScripts: "outside-only",
});
const { window } = dom;

// Bridge the browser globals the modules expect.
for (const k of ["window","document","navigator","location","localStorage","sessionStorage","CustomEvent","Event","EventTarget","DOMParser","Node","HTMLElement","FileReader","Blob","URL","IntersectionObserver","matchMedia","getComputedStyle","AbortController","AbortSignal"]) {
  if (window[k] === undefined) continue;
  try { globalThis[k] = window[k]; } catch { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); }
}
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true, writable: true });
Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
globalThis.structuredClone ??= (v) => JSON.parse(JSON.stringify(v));
const mm = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.matchMedia = mm;
Object.defineProperty(globalThis, "matchMedia", { value: mm, configurable: true, writable: true });
// Fires on observe, as a real observer does for elements already in the viewport.
class IO {
  constructor(cb) { this.cb = cb; }
  observe(target) { this.cb([{ target, isIntersecting: true, intersectionRatio: 1 }], this); }
  unobserve(){} disconnect(){}
}
window.IntersectionObserver = IO;
Object.defineProperty(globalThis, "IntersectionObserver", { value: IO, configurable: true, writable: true });
window.confirm = () => true;
Object.defineProperty(globalThis, "confirm", { value: () => true, configurable: true, writable: true });
Object.defineProperty(globalThis, "innerWidth", { value: 1280, configurable: true, writable: true });

// Serve fetch() from disk so store.js and i18n.js load the real files.
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
const seed = JSON.parse(fs.readFileSync(path.join(root, "assets/data/content.json"), "utf8"));

// --- Home page ---
await imp("assets/js/site/main.js");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
const report = [];
const check = (label, cond, extra = "") => report.push(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`) || (cond || errors.push("check failed: " + label));

check("header rendered", !!d.querySelector(".site-header"));
check("logo svg present", !!d.querySelector(".logo__mark .logo__stem"));
check("logo renders her real mark", d.querySelector(".logo__mark").querySelectorAll("path").length === 4, String(d.querySelector(".logo__mark").querySelectorAll("path").length));
check("both swooshes present", d.querySelector(".logo__mark").querySelectorAll(".logo__sweep").length === 2);
check("mark carries no stale monogram", !d.querySelector(".logo__mark .glyph, .logo__mark .ring"));
check("nav has 5 links", d.querySelectorAll(".nav__link").length === 5, `${d.querySelectorAll(".nav__link").length}`);
check("hero title filled", /komunikon|communicates/.test(d.querySelector(".hero__title")?.textContent ?? ""));
check("work cards rendered", d.querySelectorAll(".work").length === seed.works.length, `${d.querySelectorAll(".work").length} of ${seed.works.length}`);
check("category chips rendered", d.querySelectorAll(".filters .chip").length === seed.categories.length + 1, `${d.querySelectorAll(".filters .chip").length}`);
check("services rendered", d.querySelectorAll(".service").length === 6, `${d.querySelectorAll(".service").length}`);
check("process section is gone", !d.querySelector("#process"));
check("clients rendered", d.querySelectorAll(".client").length === 10, `${d.querySelectorAll(".client").length}`);
check("client logos render instead of monograms", d.querySelectorAll(".client__mark img").length === 10, `${d.querySelectorAll(".client__mark img").length}`);
check("logo tiles get the light plate", d.querySelectorAll(".client__mark--logo").length === 10, `${d.querySelectorAll(".client__mark--logo").length}`);
check("plate is only for real logos", [...d.querySelectorAll(".client__mark--logo")].every((m) => m.querySelector("img")));
check("portrait is rendered in About", !!d.querySelector("#about .portrait img"));
check("at-work photo is rendered in About", !!d.querySelector("#about .at-work img"));
check("at-work photo is captioned", (d.querySelector("#about .at-work figcaption")?.textContent ?? "").length > 5);
check("both About photos are optimised webp", [...d.querySelectorAll("#about figure img")].every((i) => i.getAttribute("src").endsWith(".webp")));
// Social platforms do not rasterise SVG, so an SVG og:image silently shows nothing.
check("og:image is a raster format", /.(png|jpe?g)$/.test(fs.readFileSync(path.join(root,"index.html"),"utf8").match(/og:image" content="([^"]+)"/)?.[1] ?? ""));
check("og:image file exists", fs.existsSync(path.join(root,"assets/img/og.png")));
check("portrait has a real alt", (d.querySelector("#about .portrait img")?.getAttribute("alt") ?? "").length > 3);
check("every category has work", seed.categories.every((c) => seed.works.some((w) => w.category === c.id)));
check("every client has work", seed.clients.items.every((c) => seed.works.some((w) => w.clientId === c.id)));
check("every work image file exists", [...new Set(JSON.stringify(seed).match(/assets\/img\/[a-z0-9.-]+/g))].every((p) => fs.existsSync(path.join(root, p))));
check("work grid is populated", d.querySelectorAll("#work-grid .work").length >= 12, `${d.querySelectorAll("#work-grid .work").length}`);
check("clients with work are buttons", d.querySelectorAll("button.client").length === 10, `${d.querySelectorAll("button.client").length}`);
check("no client card is left inert", d.querySelectorAll("div.client").length === 0, `${d.querySelectorAll("div.client").length}`);
check("every client card shows a mark", d.querySelectorAll(".client__mark").length === 10);
check("project counts rendered", [...d.querySelectorAll(".client__count")].every((n) => /[0-9]/.test(n.textContent)));

// Client gallery
d.querySelector("button.client").click();
const cg = d.querySelector(".overlay .cgallery__grid");
check("client gallery opens", !!cg);
check("gallery shows only that client work", cg && cg.querySelectorAll(".work").length >= 1, cg ? String(cg.querySelectorAll(".work").length) : "-");
check("gallery is a labelled dialog", !!d.querySelector('.overlay [role="dialog"][aria-labelledby="cg-title"]'));
cg && d.querySelector(".overlay .panel__head .icon-btn").click();
check("client gallery closes", !d.querySelector(".overlay"));

// Testimonials + contact chrome
check("quote avatars rendered", d.querySelectorAll(".quote__avatar").length === 5, `${d.querySelectorAll(".quote__avatar").length}`);
check("quote author and role split", d.querySelectorAll(".quote__author").length === 5 && d.querySelectorAll(".quote__role").length === 5);
check("contact form is carded", !!d.querySelector("form.contact-form"));
check("availability pill rendered", !!d.querySelector("#contact .pill"));
check("contact lines rendered", d.querySelectorAll(".contact-line").length === 3);
check("contact socials rendered", d.querySelectorAll(".contact-socials a").length === seed.socials.length, `${d.querySelectorAll(".contact-socials a").length} of ${seed.socials.length}`);
check("footer socials match contact", d.querySelectorAll(".site-footer .icon-btn").length === seed.socials.length, `${d.querySelectorAll(".site-footer .icon-btn").length}`);
check("dropped socials appear nowhere", !/behance|instagram|facebook/i.test(d.body.innerHTML));
check("about rendered", !!d.querySelector("#about"));
// Jump links under the bio must point at sections that actually exist on the page.
const aboutLinks = [...d.querySelectorAll("#about .about__links a")];
check("about has three jump buttons", aboutLinks.length === 3, String(aboutLinks.length));
check("jump links target services, clients, contact", aboutLinks.map((a) => a.getAttribute("href")).join(",") === "#services,#clients,#contact", aboutLinks.map((a) => a.getAttribute("href")).join(","));
check("every jump target exists", aboutLinks.every((a) => d.querySelector(a.getAttribute("href"))));
check("jump links are labelled from nav keys", aboutLinks.every((a) => a.textContent.trim().length > 2));
check("jump links sit under the bio", d.querySelector("#about .stack > p")?.nextElementSibling?.classList.contains("about__links"));
// Page order comes from settings.sections; the nav must mirror it or links jump around.
const domOrder = [...d.querySelectorAll("#page main > section[id]")].map((n) => n.id);
check("sections were found", domOrder.length > 0, domOrder.join(" > "));
check("about sits directly after work", domOrder.indexOf("about") === domOrder.indexOf("work") + 1, domOrder.join(" > "));
check("rendered order matches settings.sections", domOrder.join(",") === seed.settings.sections.filter((x) => x.enabled).map((x) => x.id).join(","), domOrder.join(","));
const navOrder = [...d.querySelectorAll(".site-header [data-nav]")].map((a) => a.dataset.nav);
check("nav order follows the page", navOrder.join(",") === domOrder.filter((id) => navOrder.includes(id)).join(","), navOrder.join(","));
check("footer nav matches header nav", [...d.querySelectorAll(".site-footer .footer__list")][0].children.length === navOrder.length);
check("contact form rendered", !!d.querySelector("#contact form"));
check("footer rendered", !!d.querySelector(".site-footer"));
check("legal links in footer", d.querySelectorAll('.footer__list a[href*="legal/"]').length === 4);
check("a11y dock mounted", !!d.querySelector(".a11y-dock__toggle"));
check("consent bar mounted", !!d.querySelector(".cookie-bar"));
check("skip link present", !!d.querySelector(".skip-link"));
check("every section has a label", [...d.querySelectorAll("section[aria-labelledby]")].every((s) => d.getElementById(s.getAttribute("aria-labelledby"))));
check("all images have alt", [...d.querySelectorAll("img")].every((i) => i.hasAttribute("alt")));
// The rendered src matters, not just the file on disk: safeURL once blanked every relative path.
const domImgs = [...d.querySelectorAll("img")];
check("images are actually rendered", domImgs.length >= 30, String(domImgs.length));
check("no image has an empty src", domImgs.every((i) => (i.getAttribute("src") ?? "").trim() !== ""), String(domImgs.filter((i) => !(i.getAttribute("src") ?? "").trim()).length) + " empty");
check("every rendered src resolves to a file", domImgs.every((i) => fs.existsSync(path.join(root, i.getAttribute("src")))));
check("no empty hrefs", ![...d.querySelectorAll("a")].some((a) => a.getAttribute("href") === ""));

// Filtering
d.querySelectorAll(".filters .chip")[1].click();
const firstCat = seed.categories[0].id;
const expected = seed.works.filter((w) => w.category === firstCat).length;
check("filter narrows the grid", d.querySelectorAll(".work").length === expected, `${d.querySelectorAll(".work").length} of ${expected}`);
check("a filtered category is not empty", expected >= 2, String(expected));
d.querySelectorAll(".filters .chip")[0].click();
check("filter resets", d.querySelectorAll(".work").length === seed.works.length);

// Lightbox
d.querySelector(".work").click();
check("lightbox opens", !!d.querySelector('.overlay [role="dialog"]'));
check("arrows sit on the image", d.querySelectorAll(".lightbox__stage .lightbox__nav").length === 2, String(d.querySelectorAll(".lightbox__stage .lightbox__nav").length));
check("arrows are labelled", [...d.querySelectorAll(".lightbox__nav")].every((b) => (b.getAttribute("aria-label") ?? "").length > 2));
check("counter shows digits only", /^[0-9]+ \/ [0-9]+$/.test(d.querySelector(".lightbox__count span[aria-hidden]")?.textContent ?? ""), d.querySelector(".lightbox__count span[aria-hidden]")?.textContent);
check("counter keeps a screen-reader sentence", (d.querySelector(".lightbox__count .sr-only")?.textContent ?? "").length > 6);
check("no prev/next word buttons remain", ![...d.querySelectorAll(".overlay .btn")].some((b) => /Para|Tjetër|Previous|Next/i.test(b.textContent)));
check("tools list removed from lightbox", !/Mjetet|Tools/i.test(d.querySelector(".overlay dl")?.textContent ?? ""));
const firstSrc = d.querySelector(".lightbox__stage img").getAttribute("src");
d.querySelector(".lightbox__nav--next").click();
check("next arrow advances the image", d.querySelector(".lightbox__stage img").getAttribute("src") !== firstSrc);
check("arrows survive the swap", d.querySelectorAll(".lightbox__stage .lightbox__nav").length === 2);
d.querySelector(".overlay .icon-btn").click();
check("lightbox closes", !d.querySelector(".overlay"));

// Language switch
const i18n = await imp("assets/js/core/i18n.js");
await i18n.setLang("en");
await new Promise((r) => setTimeout(r, 250));
check("english nav", d.querySelector(".nav__link")?.textContent === "Work", d.querySelector(".nav__link")?.textContent);
check("english hero", (d.querySelector(".hero__title")?.textContent ?? "").includes("communicates"));
check("html lang updated", d.documentElement.lang === "en", d.documentElement.lang);
await i18n.setLang("de");
await new Promise((r) => setTimeout(r, 250));
// Only sq and en are offered now, so an unsupported code must fall back, not blank the page.
check("unsupported language falls back", d.querySelector(".nav__link")?.textContent === "Punë", d.querySelector(".nav__link")?.textContent);
check("fallback still renders work titles", !!d.querySelector(".work__title")?.textContent);
check("only two languages are offered", i18n.LANGS.length === 2, i18n.LANGS.map((l) => l.code).join(","));

// Mobile drawer
const navEl = d.querySelector("#site-nav");
const burger = d.querySelector(".nav-toggle");
check("hamburger exists and is wired to the nav", burger?.getAttribute("aria-controls") === "site-nav");
check("drawer starts closed", navEl.dataset.open !== "true" && burger.getAttribute("aria-expanded") === "false");
burger.click();
check("hamburger opens the drawer", navEl.dataset.open === "true" && burger.getAttribute("aria-expanded") === "true");
check("open label changes", burger.getAttribute("aria-label") !== null && burger.getAttribute("aria-label").length > 2);
burger.click();
check("hamburger closes the drawer", navEl.dataset.open === "false" && burger.getAttribute("aria-expanded") === "false");
check("closing unlocks the body", !d.body.classList.contains("is-locked"));
burger.click();
d.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
check("Escape closes the drawer", navEl.dataset.open === "false", navEl.dataset.open);
burger.click();
navEl.querySelector("a").click();
check("following a link closes the drawer", navEl.dataset.open === "false");
check("body is not left locked", !d.body.classList.contains("is-locked"));

// Theme
const themeBtn = [...d.querySelectorAll(".header-tools .icon-btn")][0];
check("header exposes a theme toggle", !!themeBtn);
check("theme resolves to an explicit attribute", ["light","dark"].includes(d.documentElement.getAttribute("data-theme")), d.documentElement.getAttribute("data-theme"));
check("light is the default theme", d.documentElement.getAttribute("data-theme") === "light");
check("nothing is stored until the visitor chooses", localStorage.getItem("nsa:a11y") === null || !JSON.parse(localStorage.getItem("nsa:a11y")).theme);
check("toggle is labelled for its action", /dark|errët|scuro|dunkl|sombre|oscuro/i.test(themeBtn.getAttribute("aria-label") || ""), themeBtn.getAttribute("aria-label"));
themeBtn.click();
check("toggle switches to dark", d.documentElement.getAttribute("data-theme") === "dark", d.documentElement.getAttribute("data-theme"));
check("toggle relabels after switching", /light|çelët|chiaro|hell|clair|claro/i.test(themeBtn.getAttribute("aria-label") || ""), themeBtn.getAttribute("aria-label"));
check("theme-color meta follows the theme", d.querySelector('meta[name="theme-color"]')?.getAttribute("content") === "#100e0d");
check("choice persists to storage", JSON.parse(localStorage.getItem("nsa:a11y")).theme === "dark");
themeBtn.click();
check("toggle switches back to light", d.documentElement.getAttribute("data-theme") === "light");
check("theme-color meta follows back", d.querySelector('meta[name="theme-color"]')?.getAttribute("content") === "#faf9f7");

// Motion
check("scroll progress rail present", !!d.querySelector(".scroll-progress"));
check("progress rail is decorative", d.querySelector(".scroll-progress")?.getAttribute("aria-hidden") === "true");
const grids = [...d.querySelectorAll(".stagger")];
check("grids opt into stagger", grids.length >= 4, String(grids.length));
check("stagger indices stamped", grids.every((g) => !g.children.length || g.children[0].style.getPropertyValue("--i") !== ""));
const idx = [...d.querySelectorAll("#work-grid > *")].map((n) => Number(n.style.getPropertyValue("--i")));
check("indices ascend from zero", idx[0] === 0 && idx.every((v, i) => i === 0 || v >= idx[i - 1]), idx.join(","));
check("stagger index is capped", idx.every((v) => v <= 8));
check("sections reveal on intersect", d.querySelectorAll(".reveal.is-in").length > 0);
check("theme toggle carries its motion hook", !!d.querySelector(".theme-toggle"));

// Security helpers
const sec = await imp("assets/js/core/security.js");
check("sanitize strips script", sec.sanitizeHTML('<p>ok</p><script>alert(1)</script>') === "<p>ok</p>", sec.sanitizeHTML('<p>ok</p><script>alert(1)</script>'));
check("sanitize drops iframe", sec.sanitizeHTML('<iframe src=x></iframe><p>y</p>') === "<p>y</p>", sec.sanitizeHTML('<iframe src=x></iframe><p>y</p>'));
check("sanitize keeps allowed markup", sec.sanitizeHTML('<h3>T</h3><ul><li><strong>a</strong></li></ul>') === "<h3>T</h3><ul><li><strong>a</strong></li></ul>");
check("sanitize strips onclick", !sec.sanitizeHTML('<a href="/x" onclick="evil()">a</a>').includes("onclick"));
check("sanitize blocks javascript: href", !sec.sanitizeHTML('<a href="javascript:evil()">a</a>').includes("javascript"));
check("safeURL blocks javascript:", sec.safeURL("javascript:alert(1)") === "#");
check("safeURL allows relative paths", sec.safeURL("assets/img/work-01.svg") === "assets/img/work-01.svg");
check("safeURL allows root-relative and fragments", sec.safeURL("/a/b.svg") === "/a/b.svg" && sec.safeURL("#work") === "#work");
check("safeURL allows admin data URIs", sec.safeURL("data:image/png;base64,iVBORw0KGgo=").startsWith("data:image/png"));
check("safeURL blocks obfuscated javascript:", sec.safeURL("java	script:alert(1)") === "#" && sec.safeURL("  JaVaScRiPt:alert(1)") === "#");
check("safeURL blocks data:text/html", sec.safeURL("data:text/html,<script>") === "#");
check("safeURL blocks protocol-relative", sec.safeURL("//evil.com/x.png") === "#");
check("sanitize keeps relative href", sec.sanitizeHTML(String.fromCharCode(60) + "a href=\"legal/privacy.html\">x</a>").includes("legal/privacy.html"));
check("clean strips control chars", sec.clean("a\u0000\u0007b") === "a b", JSON.stringify(sec.clean("a\u0000\u0007b")));
const h = await sec.hashPassword("correct horse battery", "salt", 1000);
check("password verifies", await sec.verifyPassword("correct horse battery", h));
check("wrong password rejected", !(await sec.verifyPassword("nope", h)));

// a11y prefs
const a11y = await imp("assets/js/core/a11y.js");
a11y.setPref("contrast", "high");
check("contrast attribute set", d.documentElement.getAttribute("data-contrast") === "high");
a11y.resetPrefs();
check("reset clears attribute", !d.documentElement.hasAttribute("data-contrast"));
check("reset returns theme to light", d.documentElement.getAttribute("data-theme") === "light");
check("resolvedTheme is never auto", a11y.resolvedTheme() !== "auto");
check("Light is offered first in the dock", a11y.PREFS.theme.values[0] === "light");
check("Auto is still offered", a11y.PREFS.theme.values.includes("auto"));

// A dark operating system must not override the light default.
const darkOS = (q) => ({ matches: /dark/.test(q), addEventListener() {}, removeEventListener() {} });
const realMM = globalThis.matchMedia;
Object.defineProperty(globalThis, "matchMedia", { value: darkOS, configurable: true, writable: true });
a11y.resetPrefs();
check("dark OS does not override the default", d.documentElement.getAttribute("data-theme") === "light", d.documentElement.getAttribute("data-theme"));
a11y.setPref("theme", "auto");
check("opting into auto still follows a dark OS", d.documentElement.getAttribute("data-theme") === "dark", d.documentElement.getAttribute("data-theme"));
Object.defineProperty(globalThis, "matchMedia", { value: realMM, configurable: true, writable: true });
a11y.resetPrefs();

// Store round-trip
const { store } = await imp("assets/js/core/store.js");
store.set("profile.name", "Test Name");
check("store deep-set works", store.get("profile.name") === "Test Name");
const nWorks = store.get("works").length;
store.push("works", { id: "x", title: { en: "X" }, images: [] });
check("store push works", store.get("works").length === nWorks + 1);
store.removeAt("works", nWorks);
check("store remove works", store.get("works").length === nWorks);
store.move("works", 0, 1);
check("store move works", store.get("works")[1].id === "w-gazeta");
check("export is valid JSON", (() => { try { JSON.parse(store.export()); return true; } catch { return false; } })());

console.log("\n" + report.join("\n"));
console.log(errors.length ? `\n${errors.length} ERRORS:\n` + errors.join("\n") : "\nNo runtime errors.");

process.exit(errors.length ? 1 : 0);
