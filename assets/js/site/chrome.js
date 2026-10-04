// Header, animated logo, language switcher and footer — shared by every page.

import { $$, el, on, throttle, transition } from "../core/dom.js";
import { LANGS, getLang, setLang, t, tr } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { openPreferences } from "../core/consent.js";
import { resolvedTheme, setPref } from "../core/a11y.js";
import { safeURL } from "../core/security.js";
import { MARK, VIEWBOX } from "./logo-paths.js";

const NAV = ["work", "about", "services", "clients", "contact"];

// Chrome is rebuilt on every language change; this drops the previous listeners.
let chrome = new AbortController();
const signal = () => chrome.signal;

// Her own mark, traced from the source PDF by tools/pdf-logo.mjs. Inline so it can be themed.
export function logoMark() {
  return `<svg class="logo__mark" viewBox="${VIEWBOX}" aria-hidden="true" focusable="false">
    <path class="logo__stem" d="${MARK.stem}"/>
    <path class="logo__sweep logo__sweep--a" d="${MARK.upper}"/>
    <path class="logo__sweep logo__sweep--b" d="${MARK.lower}"/>
    <path class="logo__tip" d="${MARK.tip}"/>
  </svg>`;
}

export function renderLogo(profile, href = "#hero") {
  return el("a.logo", { href, "aria-label": profile.name },
    el("span", { html: logoMark() }),
    el("span.logo__word", { text: profile.name.split(" ")[0] },
      el("span", { text: tr(profile.role) })));
}

// Language menu is a listbox of buttons — no framework, full keyboard support.
function langSwitcher(onChange) {
  const wrap = el("div.lang");
  const menu = el("ul.lang__menu", { role: "listbox", "aria-label": t("lang.choose"), hidden: true });
  const button = el("button.icon-btn", { type: "button", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": t("lang.label"), title: t("lang.label"), html: icon("globe", { size: 18 }) });

  const close = () => { menu.hidden = true; button.setAttribute("aria-expanded", "false"); };
  const paint = () => menu.replaceChildren(...LANGS.map((l) =>
    el("li", { role: "none" },
      el("button.lang__item", {
        type: "button", role: "option", lang: l.code,
        "aria-current": String(l.code === getLang()),
        "aria-selected": String(l.code === getLang()),
        onclick: async () => { await setLang(l.code); close(); onChange?.(l.code); },
      }, el("span", { text: l.label }), el("span.lang__code", { text: l.code.toUpperCase() })))));

  on(button, "click", () => { paint(); menu.hidden = !menu.hidden; button.setAttribute("aria-expanded", String(!menu.hidden)); });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); }, { signal: signal() });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }, { signal: signal() });

  wrap.append(button, menu);
  return wrap;
}

// Header toggle flips between the two palettes; the dock keeps the Auto option.
function themeToggle() {
  const button = el("button.icon-btn.theme-toggle", { type: "button" });
  const paint = () => {
    const dark = resolvedTheme() === "dark";
    const label = t(dark ? "a11y.toLight" : "a11y.toDark");
    button.innerHTML = icon(dark ? "sun" : "moon", { size: 18 });
    button.setAttribute("aria-label", label);
    button.title = label;
  };
  on(button, "click", () => transition(() => setPref("theme", resolvedTheme() === "dark" ? "light" : "dark")));
  document.addEventListener("a11ychange", paint, { signal: signal() });
  paint();
  return button;
}

export function mountHeader(host, data, { links = NAV, base = "", onLangChange } = {}) {
  chrome.abort();
  chrome = new AbortController();

  const nav = el("nav.nav", { id: "site-nav", "aria-label": t("nav.menu") },
    el("ul.nav__list", { role: "list" },
      links.map((id) => el("li", {}, el("a.nav__link", { href: `${base}#${id}`, "data-nav": id, text: t(`nav.${id}`) })))));

  const toggle = el("button.nav-toggle.icon-btn", { type: "button", "aria-expanded": "false", "aria-controls": "site-nav", "aria-label": t("nav.menu"), html: icon("menu", { size: 20 }) });

  // One writer for all three pieces of state, so they can never disagree.
  const drawer = matchMedia("(width < 56rem)");
  const setOpen = (open) => {
    nav.dataset.open = String(open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", t(open ? "nav.close" : "nav.menu"));
    toggle.innerHTML = icon(open ? "close" : "menu", { size: 20 });
    document.body.classList.toggle("is-locked", open && drawer.matches);
  };

  on(toggle, "click", () => setOpen(nav.dataset.open !== "true"));
  on(nav, "click", "a", () => setOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.dataset.open === "true") { setOpen(false); toggle.focus(); } }, { signal: signal() });
  // Growing past the breakpoint with the drawer open would otherwise leave the body locked.
  drawer.addEventListener?.("change", (e) => { if (!e.matches) setOpen(false); }, { signal: signal() });

  const header = el("header.site-header", { role: "banner" },
    el("div.container.site-header__inner", {},
      renderLogo(data.profile, `${base}#hero`),
      nav,
      el("div.header-tools", {}, themeToggle(), langSwitcher(onLangChange), toggle)),
    el("div.scroll-progress", { "aria-hidden": "true" }));

  window.addEventListener("scroll", throttle(() => { header.dataset.stuck = String(scrollY > 8); }, 120), { passive: true, signal: signal() });
  host.prepend(header);
  return header;
}

// Highlights the section currently in view; skipped on pages without sections.
export function trackActiveNav(header) {
  const targets = NAV.map((id) => document.getElementById(id)).filter(Boolean);
  if (!targets.length) return;
  const io = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    $$("[data-nav]", header).forEach((a) => a.setAttribute("aria-current", String(a.dataset.nav === visible.target.id)));
  }, { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.2, 0.6] });
  targets.forEach((n) => io.observe(n));
  return io;
}

export function mountFooter(host, data, { base = "" } = {}) {
  const { profile, footer, socials } = data;
  const year = new Date().getFullYear();

  // A null href renders plain text instead of a dead link.
  const list = (items) => el("ul.footer__list", { role: "list" }, items.map(([label, href, attrs = {}]) =>
    el("li", {}, href ? el("a", { href, ...attrs, text: label }) : el("span", { text: label }))));

  const node = el("footer.site-footer", { role: "contentinfo" },
    el("div.container", {},
      el("div.footer__grid", {},
        el("div.footer__brand", {},
          renderLogo(profile, `${base}#hero`),
          el("p.footer__blurb", { text: tr(footer.blurb) })),
        el("div", {},
          el("p.footer__title", { text: t("footer.nav") }),
          list(NAV.map((id) => [t(`nav.${id}`), `${base}#${id}`]))),
        el("div", {},
          el("p.footer__title", { text: t("footer.legal") }),
          list([
            [t("legal.privacy"), `${base}legal/privacy.html`],
            [t("legal.terms"), `${base}legal/terms.html`],
            [t("legal.cookies"), `${base}legal/cookies.html`],
            [t("legal.accessibility"), `${base}legal/accessibility.html`],
          ])),
        el("div", {},
          el("p.footer__title", { text: t("footer.contact") }),
          list([
            [profile.email, `mailto:${profile.email}`],
            [profile.phone, `tel:${profile.phone.replace(/\s/g, "")}`],
            [tr(profile.location), null],
          ]),
          el("div.row", { style: "margin-block-start:var(--s-4)" },
            socials.map((s) => el("a.icon-btn", { href: safeURL(s.url), target: "_blank", rel: "noopener noreferrer me", "aria-label": s.label, title: s.label, html: icon(s.icon, { size: 18 }) }))))),
      el("div.footer__bottom", {},
        el("p", { text: `© ${year} ${footer.legalName}. ${t("footer.rights")}${footer.nipt ? ` NIPT ${footer.nipt}.` : ""}` }),
        el("div.row", {},
          el("button", { type: "button", class: "tiny", style: "text-decoration:underline", text: t("footer.cookiePrefs"), onclick: () => openPreferences() }),
          el("span", { text: t("footer.madeIn") })))));

  host.append(node);
  return node;
}
