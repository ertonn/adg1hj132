// Section renderers. Each takes the store slice it needs and returns a DOM node.

import { el, esc, stagger, transition } from "../core/dom.js";
import { plural, t, tr } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { safeURL, sanitizeHTML } from "../core/security.js";
import { clientName, monogram, worksOf } from "./gallery.js";

// Shared eyebrow/title/intro block so no section repeats its own header markup.
const head = (eyebrow, title, intro) =>
  el("div.section-head", {},
    el("p.eyebrow", { text: eyebrow }),
    el("div", {},
      el("h2.section-title", { text: title }),
      intro ? el("p.section-intro", { text: intro }) : null));

const section = (id, ...children) => el("section.section.reveal", { id, "aria-labelledby": `${id}-title` }, el("div.container", {}, children));

// Sections the About text points on to; ids must exist in settings.sections.
const ABOUT_LINKS = ["services", "clients", "contact"];

// Tag the h2 produced by head() so aria-labelledby resolves.
const titled = (id, node) => { node.querySelector(".section-title").id = `${id}-title`; return node; };

export function renderHero(data) {
  const { hero, profile } = data;
  return el("section.section.hero", { id: "hero" },
    el("div.container", {},
      el("p.eyebrow", {},
        el("span", { text: `${tr(profile.role)} · ${tr(profile.location)}` })),
      el("h1.hero__title", { id: "hero-title", html: sanitizeHTML(tr(hero.headline)) }),
      el("p.hero__lede", { text: tr(hero.lede) }),
      el("div.hero__actions", {},
        el("a.btn.btn--primary", { href: "#contact", text: t("hero.ctaPrimary") }),
        el("a.btn.btn--ghost", { href: "#work", text: t("hero.ctaSecondary") })),
      el("div.hero__meta", {},
        hero.stats.map((s) => el("div.stat", {},
          el("span.stat__value", { text: s.value }),
          el("span.stat__label", { text: tr(s.label) }))))));
}

export function renderWork(data, onOpen) {
  const { work, works, categories } = data;
  const node = titled("work", section("work",
    head(t("nav.work"), tr(work.title), tr(work.intro)),
    el("div.filters", { role: "group", "aria-label": t("work.filterLabel") }),
    el("div.grid.grid--works.stagger", { id: "work-grid" })));

  const filters = node.querySelector(".filters");
  const grid = node.querySelector("#work-grid");
  let active = "all";

  const card = (w) =>
    el("button.work", { type: "button", "aria-label": `${t("work.openLabel")}: ${tr(w.title)}`, onclick: () => onOpen(w) },
      el("div.work__media", {},
        el("img", { src: safeURL(w.cover, ""), alt: "", loading: "lazy", decoding: "async", width: "800", height: "600" }),
        w.featured ? el("span.work__badge", { text: tr(categories.find((c) => c.id === w.category)?.label ?? w.category) }) : null),
      el("div", {},
        el("h3.work__title", { text: tr(w.title) }),
        el("p.muted", { style: "font-size:var(--fs-sm)", text: tr(w.summary) }),
        el("p.work__meta", {}, el("span", { text: clientName(data, w) }), el("span", { text: w.year }))));

  const paint = () => transition(() => {
    const list = works.filter((w) => active === "all" || w.category === active);
    grid.replaceChildren(...(list.length ? list.map(card) : [el("p.empty", { text: t("work.empty") })]));
    stagger(grid);
    grid.classList.add("is-in");
  });

  const chips = [{ id: "all", label: { en: t("common.all") } }, ...categories];
  filters.replaceChildren(...chips.map((c) =>
    el("button.chip", {
      type: "button",
      "aria-pressed": String(c.id === active),
      text: tr(c.label),
      onclick: (e) => {
        active = c.id;
        filters.querySelectorAll(".chip").forEach((n) => n.setAttribute("aria-pressed", String(n === e.currentTarget)));
        paint();
      },
    })));

  paint();
  return node;
}

export function renderServices(data) {
  const { services } = data;
  return titled("services", section("services",
    head(t("nav.services"), tr(services.title), tr(services.intro)),
    el("div.grid.grid--services.stagger", {},
      services.items.map((s) =>
        el("article.service", {},
          el("span", { html: icon(s.icon, { cls: "service__icon" }) }),
          el("h3.service__title", { text: tr(s.title) }),
          el("p.service__desc", { text: tr(s.desc) }),
          s.note ? el("p.service__price", { text: tr(s.note) }) : null)))));
}

export function renderClients(data, onOpen) {
  const { clients } = data;

  const card = (c) => {
    const count = worksOf(data, c.id).length;
    const mark = el("span.client__mark", { class: c.logo ? "client__mark--logo" : "", "aria-hidden": "true" },
      c.logo ? el("img", { src: safeURL(c.logo, ""), alt: "", loading: "lazy", decoding: "async" }) : el("span", { text: monogram(c.name) }));

    const body = [
      mark,
      el("span.client__name", { text: c.name }),
      el("span.client__meta", {},
        c.sector ? el("span", { text: tr(c.sector) }) : null,
        count ? el("span.client__count", { text: plural("clients.projectCount", count) }) : null),
      count ? el("span.client__go", { html: icon("arrow", { size: 18 }) }) : null,
    ];

    // Only clients with work are interactive; the rest stay as credits.
    return count
      ? el("button.client", { type: "button", dataset: { interactive: "true" }, "aria-label": `${c.name}: ${t("clients.viewWork")}`, onclick: () => onOpen(c) }, body)
      : el("div.client", {}, body);
  };

  return titled("clients", section("clients",
    head(t("nav.clients"), tr(clients.title), tr(clients.intro)),
    el("div.grid.grid--clients.stagger", {}, clients.items.map(card))));
}

export function renderAbout(data) {
  const { about, profile } = data;
  return titled("about", section("about",
    head(t("nav.about"), tr(about.title)),
    el("div.grid.grid--about", {},
      profile.portrait
        ? el("figure.portrait", {},
            el("img", { src: safeURL(profile.portrait, ""), alt: profile.name, loading: "lazy", decoding: "async", width: "900", height: "1023" }),
            el("figcaption.portrait__cap", {}, el("strong", { text: profile.name }), el("span", { text: tr(profile.role) })))
        : null,
      el("div.stack", {},
        el("p", { style: "font-size:var(--fs-md)", text: tr(about.body) }),
        // Jump links reuse the nav labels, so they stay translated with no new keys.
        el("div.about__links", {},
          ABOUT_LINKS.map((id) =>
            el("a.btn.btn--ghost", { href: `#${id}` },
              el("span", { text: t(`nav.${id}`) }),
              el("span", { "aria-hidden": "true", html: icon("arrow", { size: 16 }) })))),
        el("div", {},
          el("p.footer__title", { text: t("about.skills") }),
          el("div.row", {}, about.skills.map((s) => el("span.chip", { text: s })))),
        profile.cvUrl ? el("a.btn.btn--ghost", { href: safeURL(profile.cvUrl), download: true, html: `${icon("download", { size: 18 })}<span>${esc(t("about.downloadCv"))}</span>` }) : null)),
    // Her at the lectern: the caption doubles as alt text, so there is one field to edit.
    profile.atWork
      ? el("figure.at-work", {},
          el("img", { src: safeURL(profile.atWork, ""), alt: tr(about.atWorkCaption), loading: "lazy", decoding: "async", width: "960", height: "640" }),
          el("figcaption.portrait__cap", { text: tr(about.atWorkCaption) }))
      : null,
    el("div", { style: "margin-block-start:var(--s-8)" },
      el("p.footer__title", { text: t("about.timeline") }),
      el("ol.timeline.stagger", { role: "list" },
        about.timeline.map((r) =>
          el("li.timeline__row", {},
            el("span.timeline__year", { text: r.year }),
            el("span.timeline__text", { text: tr(r.text) })))))));
}

export function renderTestimonials(data) {
  const { testimonials } = data;
  if (!testimonials.items.length) return null;
  return titled("testimonials", section("testimonials",
    head(t("testimonials.eyebrow"), tr(testimonials.title)),
    el("div.grid.grid--quotes.stagger", {},
      testimonials.items.map((q) =>
        el("figure.quote", {},
          el("blockquote.quote__text", { text: tr(q.quote) }),
          el("figcaption.quote__by", {},
            el("span.quote__avatar", { "aria-hidden": "true", text: monogram(q.author) }),
            el("span", {},
              el("span.quote__author", { text: q.author }),
              el("span.quote__role", { text: tr(q.role) }))))))));
}
