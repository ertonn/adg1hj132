// Per-category overlay: the PDFs and images she has filed under one category.

import { el, on, lockScroll, trapFocus } from "../core/dom.js";
import { t, tr } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { safeURL } from "../core/security.js";

const INLINE_PDF = /^data:application\/pdf;base64,[a-z0-9+/=]+$/i;

export const isPDF = (src) => INLINE_PDF.test(String(src ?? "")) || /\.pdf([?#]|$)/i.test(String(src ?? ""));

// A file needs somewhere to open: a safe path, an inline image, or an inline PDF.
const usable = (f) => Boolean(f?.src) && (INLINE_PDF.test(f.src) || safeURL(f.src, "") !== "");
export const filesOf = (category) => (category.files ?? []).filter(usable);

// Browsers refuse to navigate a tab to a data: URL, so uploaded files open as blobs.
function openInline(src) {
  const [head, body] = src.split(",");
  const bytes = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: head.slice(5, head.indexOf(";")) }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openCategory(category) {
  const files = filesOf(category);
  const overlay = el("div.overlay", { role: "presentation" });
  const panel = el("div.panel.panel--wide", { role: "dialog", "aria-modal": "true", "aria-labelledby": "cat-title" });
  const close = () => { release(); lockScroll(false); overlay.remove(); };

  const tile = (f, i) => {
    const pdf = isPDF(f.src);
    const inline = f.src.startsWith("data:");
    const name = f.name || `${pdf ? "PDF" : t("common.image")} ${i + 1}`;
    return el("a.catfile", {
      href: inline ? "#" : safeURL(f.src),
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": `${t("categories.openFile")}: ${name}`,
      onclick: inline ? (e) => { e.preventDefault(); openInline(f.src); } : null,
    },
      pdf
        ? el("span.catfile__doc", { "aria-hidden": "true" }, el("span", { html: icon("book", { size: 28 }) }), el("span", { text: "PDF" }))
        : el("img.catfile__img", { src: safeURL(f.src, ""), alt: "", loading: "lazy", decoding: "async" }),
      el("span.catfile__name", { text: name }));
  };

  panel.append(
    el("div.panel__head", {},
      el("div.stack", {},
        el("p.eyebrow", { text: t("nav.categories") }),
        el("h2", { id: "cat-title", text: tr(category.label) }),
        tr(category.note) ? el("p.muted", { text: tr(category.note) }) : null),
      el("button.icon-btn", { type: "button", "aria-label": t("common.close"), onclick: close, html: icon("close", { size: 20 }) })),
    el("div.catfiles", {}, files.map(tile)));

  on(overlay, "click", (e) => { if (e.target === overlay) close(); });
  overlay.append(panel);
  document.body.append(overlay);
  lockScroll(true);
  const release = trapFocus(panel, close);
  return overlay;
}
