// Per-client gallery overlay: that client's projects, each opening the project view.

import { el, on, lockScroll, trapFocus } from "../core/dom.js";
import { plural, t, tr } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { safeURL } from "../core/security.js";
import { openProject } from "./lightbox.js";

export const worksOf = (data, clientId) => data.works.filter((w) => w.clientId === clientId);

// The linked client is the source of truth; the free-text field is the fallback.
export const clientName = (data, work) =>
  data.clients.items.find((c) => c.id === work.clientId)?.name ?? work.client ?? "";

// Initials for clients with no logo file — keeps every card visually complete.
export const monogram = (name) =>
  String(name ?? "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

export function openClientGallery(client, data) {
  const works = worksOf(data, client.id);
  const overlay = el("div.overlay", { role: "presentation" });
  const panel = el("div.panel.panel--wide", { role: "dialog", "aria-modal": "true", "aria-labelledby": "cg-title" });
  const close = () => { release(); lockScroll(false); overlay.remove(); };

  const tile = (w) =>
    el("button.work", { type: "button", "aria-label": `${t("work.openLabel")}: ${tr(w.title)}`, onclick: () => { close(); openProject(w, data.categories, client.name); } },
      el("div.work__media", {},
        el("img", { src: safeURL(w.cover, ""), alt: "", loading: "lazy", decoding: "async", width: "600", height: "450" }),
        w.images?.length > 1 ? el("span.work__badge", { text: `${w.images.length} ${t("common.images")}` }) : null),
      el("div", {},
        el("h3.work__title", { style: "font-size:var(--fs-base)", text: tr(w.title) }),
        el("p.work__meta", {}, el("span", { text: w.year }))));

  panel.append(
    el("div.panel__head", {},
      el("div.cgallery__head", {},
        el("p.eyebrow", { text: tr(client.sector) || t("nav.clients") }),
        el("h2", { id: "cg-title", text: client.name }),
        client.blurb ? el("p.muted", { style: "max-width:38rem", text: tr(client.blurb) }) : null,
        el("p.tiny", { text: plural("clients.projectCount", works.length) })),
      el("button.icon-btn", { type: "button", "aria-label": t("common.close"), onclick: close, html: icon("close", { size: 20 }) })),
    works.length
      ? el("div.cgallery__grid", {}, works.map((w, i) => { const n = tile(w); n.style.setProperty("--i", String(i)); return n; }))
      : el("p.empty", { text: t("clients.noWork") }),
    client.url
      ? el("p", { style: "margin-block-start:var(--s-6)" },
          el("a.btn.btn--ghost.btn--sm", { href: safeURL(client.url), target: "_blank", rel: "noopener noreferrer", html: `<span>${client.name}</span>${icon("arrow", { size: 16 })}` }))
      : null);

  on(overlay, "click", (e) => { if (e.target === overlay) close(); });
  overlay.append(panel);
  document.body.append(overlay);
  lockScroll(true);
  const release = trapFocus(panel, close);
  return overlay;
}
