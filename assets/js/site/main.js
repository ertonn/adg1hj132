// Home page entry point: load content, render enabled sections, wire chrome.

import { $, $$, el, observeReveal } from "../core/dom.js";
import { store } from "../core/store.js";
import { apply, detect, getLang, setLang, t } from "../core/i18n.js";
import { initA11y, mountA11yDock } from "../core/a11y.js";
import { mountConsent } from "../core/consent.js";
import { mountFooter, mountHeader, trackActiveNav } from "./chrome.js";
import { renderAbout, renderCategories, renderHero, renderServices, renderTestimonials, renderWork } from "./sections.js";
import { renderContact } from "./contact.js";
import { openProject } from "./lightbox.js";
import { openCategory, openService } from "./gallery.js";

const root = $("#page");

// Section id → renderer, so settings.sections drives both order and visibility.
const RENDERERS = {
  hero: (d) => renderHero(d),
  work: (d) => renderWork(d, (w) => openProject(w, d.categories)),
  services: (d) => renderServices(d, openService),
  categories: (d) => renderCategories(d, openCategory),
  about: renderAbout,
  testimonials: renderTestimonials,
  contact: renderContact,
};

function paintMeta(data) {
  document.title = t("site.title");
  $('meta[name="description"]')?.setAttribute("content", t("site.description"));
  $('meta[property="og:title"]')?.setAttribute("content", t("site.title"));
  $('meta[property="og:description"]')?.setAttribute("content", t("site.description"));
  document.documentElement.style.setProperty("--accent", data.settings.accent);
}

// Full rebuild of header + main + footer; cheap enough to run on every change.
function render(data) {
  const main = el("main", { id: "main", tabindex: "-1" },
    data.settings.sections
      .filter((s) => s.enabled && RENDERERS[s.id])
      .map((s) => RENDERERS[s.id](data))
      .filter(Boolean));

  root.replaceChildren(main);
  const header = mountHeader(root, data);
  mountFooter(root, data);
  trackActiveNav(header);
  apply(document);
  paintMeta(data);
  observeReveal(main);
}

// True only inside the admin panel's preview frame, which feeds this page unsaved content.
const PREVIEW = window.parent !== window && new URLSearchParams(location.search).has("preview");

// Preview repaints happen per keystroke: no entrance motion, and the reader stays where they were.
function repaint(data) {
  document.documentElement.dataset.motion = "reduced";
  const anchor = $$("main > section").find((s) => s.getBoundingClientRect().bottom > 0);
  const top = anchor?.getBoundingClientRect().top;
  render(data);
  const again = anchor?.id && document.getElementById(anchor.id);
  if (again) scrollBy({ top: again.getBoundingClientRect().top - top, behavior: "instant" });
}

// Not scrollIntoView: from inside a frame it would scroll the editor's own page as well.
// Sections above are content-visibility:auto, so they take their real height only once
// scrolled near, a frame late, and the target drifts. Re-aim over a fixed run of frames:
// stopping at the first on-target frame would stop just before the drift arrives.
function settleOn(target, frames = 12) {
  if (!target.isConnected) return;
  const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const off = target.getBoundingClientRect().top - pad;
  if (Math.abs(off) >= 2) scrollBy({ top: off, behavior: "instant" });
  if (frames > 0) requestAnimationFrame(() => settleOn(target, frames - 1));
}

// Takes content and a section to show from the editor; only the same-origin parent is heard.
function followEditor() {
  let focus = null;
  window.addEventListener("message", async (e) => {
    if (e.source !== window.parent || e.origin !== location.origin || e.data?.type !== "nsa:preview") return;
    if (e.data.lang && e.data.lang !== getLang()) await setLang(e.data.lang, { persist: false });
    if (e.data.content) await store.import(e.data.content);
    if ("focus" in e.data && e.data.focus !== focus) {
      focus = e.data.focus;
      const target = focus === "footer" ? $("footer.site-footer") : focus && document.getElementById(focus);
      if (target) settleOn(target);
    }
  });
  window.parent.postMessage({ type: "nsa:preview-ready" }, location.origin);
}

async function boot() {
  initA11y();
  const data = await store.init();
  await setLang(detect(data.settings.defaultLang));

  const paint = PREVIEW ? repaint : render;
  paint(data);
  // The dock and the cookie banner belong to the editor's own window, not the miniature.
  if (!PREVIEW) { mountA11yDock(); mountConsent(); }

  document.addEventListener("langchange", () => paint(store.data));
  store.on("change", () => paint(store.data));
  window.addEventListener("storage", (e) => { if (e.key === "nsa:content") store.init().then(paint); });
  if (PREVIEW) followEditor();
}

boot().catch((err) => {
  console.error(err);
  root.append(el("p.empty", { text: "Content could not be loaded. Please refresh." }));
});
