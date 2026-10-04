// Home page entry point: load content, render enabled sections, wire chrome.

import { $, el, observeReveal } from "../core/dom.js";
import { store } from "../core/store.js";
import { apply, detect, setLang, t } from "../core/i18n.js";
import { initA11y, mountA11yDock } from "../core/a11y.js";
import { mountConsent } from "../core/consent.js";
import { mountFooter, mountHeader, trackActiveNav } from "./chrome.js";
import { renderAbout, renderClients, renderHero, renderServices, renderTestimonials, renderWork } from "./sections.js";
import { renderContact } from "./contact.js";
import { openProject } from "./lightbox.js";
import { clientName, openClientGallery } from "./gallery.js";

const root = $("#page");

// Section id → renderer, so settings.sections drives both order and visibility.
const RENDERERS = {
  hero: (d) => renderHero(d),
  work: (d) => renderWork(d, (w) => openProject(w, d.categories, clientName(d, w))),
  services: renderServices,
  clients: (d) => renderClients(d, (c) => openClientGallery(c, d)),
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

async function boot() {
  initA11y();
  const data = await store.init();
  await setLang(detect(data.settings.defaultLang));

  render(data);
  mountA11yDock();
  mountConsent();

  document.addEventListener("langchange", () => render(store.data));
  store.on("change", () => render(store.data));
  window.addEventListener("storage", (e) => { if (e.key === "nsa:content") store.init().then(render); });
}

boot().catch((err) => {
  console.error(err);
  root.append(el("p.empty", { text: "Content could not be loaded. Please refresh." }));
});
