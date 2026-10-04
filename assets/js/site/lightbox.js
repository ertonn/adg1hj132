// Project overlay with keyboard-navigable gallery; one instance is reused.

import { el, on, lockScroll, trapFocus } from "../core/dom.js";
import { t, tr } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { safeURL, sanitizeHTML } from "../core/security.js";

let release = null;

export function openProject(work, categories = [], clientLabel = work.client) {
  const images = work.images?.length ? work.images : [work.cover];
  let index = 0;

  const overlay = el("div.overlay", { role: "presentation" });
  const panel = el("div.panel.panel--wide", { role: "dialog", "aria-modal": "true", "aria-labelledby": "lb-title" });
  const stage = el("div.lightbox__stage");
  const figure = el("figure.lightbox__figure", {}, stage);
  const counter = el("p.lightbox__count", { "aria-live": "polite" });
  let imgEl = null;

  const close = () => { release?.(); release = null; lockScroll(false); overlay.remove(); document.removeEventListener("keydown", keys); };
  const step = (delta) => { index = (index + delta + images.length) % images.length; paint(); };

  // Arrows sit on the image itself; built once so only the picture swaps.
  const arrow = (dir) => el("button.lightbox__nav", {
    class: `lightbox__nav--${dir}`,
    type: "button",
    "aria-label": t(dir === "prev" ? "common.prev" : "common.next"),
    onclick: () => step(dir === "prev" ? -1 : 1),
    html: icon("arrow", { size: 20 }),
  });

  if (images.length > 1) stage.append(arrow("prev"), arrow("next"));

  function paint() {
    const next = el("img", { src: safeURL(images[index], ""), alt: `${tr(work.title)}, ${t("common.image")} ${index + 1}`, decoding: "async" });
    if (imgEl) imgEl.replaceWith(next); else stage.prepend(next);
    imgEl = next;
    // The digits are decorative; the hidden text is what a screen reader announces.
    counter.replaceChildren(...(images.length > 1
      ? [el("span", { "aria-hidden": "true", text: `${index + 1} / ${images.length}` }),
         el("span.sr-only", { text: `${t("common.image")} ${index + 1} ${t("common.of")} ${images.length}` })]
      : []));
  }

  const keys = (e) => {
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  };

  panel.append(
    el("div.panel__head", {},
      el("div", {},
        el("p.eyebrow", { text: tr(categories.find((c) => c.id === work.category)?.label ?? work.category) }),
        el("h2", { id: "lb-title", text: tr(work.title) })),
      el("button.icon-btn", { type: "button", "aria-label": t("common.close"), onclick: close, html: icon("close", { size: 20 }) })),
    figure,
    counter,
    el("div.grid.grid--split", { style: "margin-block-start:1.5rem" },
      el("div.prose", { html: sanitizeHTML(`<p>${tr(work.body)}</p>`) }),
      el("dl.stack", { style: "font-size:var(--fs-sm)" },
        el("div", {}, el("dt.footer__title", { text: t("work.client") }), el("dd", { text: clientLabel })),
        el("div", {}, el("dt.footer__title", { text: t("work.year") }), el("dd", { text: work.year })))));

  on(overlay, "click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", keys);

  paint();
  overlay.append(panel);
  document.body.append(overlay);
  lockScroll(true);
  release = trapFocus(panel, close);
  return overlay;
}
