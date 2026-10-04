// One renderer for every legal page; the page declares which document via data-doc.

import { $, el, observeReveal } from "../core/dom.js";
import { store } from "../core/store.js";
import { apply, detect, fmtDate, setLang, t, tr } from "../core/i18n.js";
import { initA11y, mountA11yDock } from "../core/a11y.js";
import { mountConsent } from "../core/consent.js";
import { mountFooter, mountHeader } from "./chrome.js";
import { sanitizeHTML } from "../core/security.js";

const root = $("#page");
const key = document.documentElement.dataset.doc;

function render(data) {
  const doc = data.legal[key];
  const main = el("main", { id: "main", tabindex: "-1" },
    el("article.section", {},
      el("div.container.prose", {},
        el("p.eyebrow", { text: t("footer.legal") }),
        el("h1.section-title", { text: tr(doc.title) }),
        el("p.tiny", { style: "margin-block:var(--s-3) var(--s-6)", text: `${t("legal.updated")} ${fmtDate(doc.updated, { year: "numeric", month: "long", day: "numeric" })}` }),
        el("div.stack", { html: sanitizeHTML(tr(doc.body)) }),
        el("p", { style: "margin-block-start:var(--s-7)" }, el("a.btn.btn--ghost", { href: "../index.html", text: t("legal.back") })))));

  root.replaceChildren(main);
  mountHeader(root, data, { base: "../" });
  mountFooter(root, data, { base: "../" });
  document.title = `${tr(doc.title)} · ${data.profile.name}`;
  apply(document);
  observeReveal(main);
}

(async () => {
  initA11y();
  const data = await store.init();
  await setLang(detect(data.settings.defaultLang));
  render(data);
  mountA11yDock();
  mountConsent(document.body, { privacyHref: "privacy.html", cookieHref: "cookies.html" });
  document.addEventListener("langchange", () => render(store.data));
})().catch((err) => { console.error(err); root.append(el("p.empty", { text: "Content could not be loaded." })); });
