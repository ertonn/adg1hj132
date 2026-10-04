// Minimal DOM toolkit — every other module builds on these five helpers.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Delegated or direct listener; returns its own off() so callers never leak.
export function on(target, type, selOrFn, maybeFn) {
  const delegated = typeof selOrFn === "string";
  const handler = delegated
    ? (e) => { const m = e.target.closest(selOrFn); if (m && target.contains(m)) maybeFn(e, m); }
    : selOrFn;
  target.addEventListener(type, handler, delegated ? undefined : maybeFn);
  return () => target.removeEventListener(type, handler);
}

// el("button.btn", { onclick, "aria-label": "x" }, children)
export function el(spec, props = {}, ...children) {
  const [tag, ...classes] = spec.split(".");
  const node = document.createElement(tag || "div");
  if (classes.length) node.className = classes.join(" ");
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className += ` ${v}`;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export const frag = (nodes) => { const f = document.createDocumentFragment(); f.append(...nodes.filter(Boolean)); return f; };

// Replace children in one paint instead of clearing then appending.
export const fill = (node, ...children) => { node.replaceChildren(...children.flat().filter(Boolean)); return node; };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const throttle = (fn, ms = 100) => { let last = 0; return (...a) => { const n = Date.now(); if (n - last >= ms) { last = n; fn(...a); } }; };

export const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

// Trap tab focus inside a dialog and restore it on close.
export function trapFocus(container, onEscape) {
  const prev = document.activeElement;
  const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const cycle = (e) => {
    if (e.key === "Escape") return onEscape?.();
    if (e.key !== "Tab") return;
    const items = $$(sel, container).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const [first, last] = [items[0], items.at(-1)];
    const target = e.shiftKey ? first : last;
    if (document.activeElement === target) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  };
  container.addEventListener("keydown", cycle);
  ($(sel, container) || container).focus?.();
  return () => { container.removeEventListener("keydown", cycle); prev?.focus?.(); };
}

export const lockScroll = (locked) => document.body.classList.toggle("is-locked", locked);

// Focus-trapped dialog with a footer of actions; returns { close }.
export function openModal({ title, content, actions = [], wide = false, onClose, host = document.body }) {
  const overlay = el("div.overlay", { role: "presentation" });
  const panel = el(`div.panel${wide ? ".panel--wide" : ""}`, { role: "dialog", "aria-modal": "true", "aria-label": title });
  const close = (reason = "dismiss") => { release(); lockScroll(false); overlay.remove(); onClose?.(reason); };

  const footer = el("div.modal__actions", {}, actions.map((a) =>
    el(`button.btn${a.variant ? `.btn--${a.variant}` : ""}`, {
      type: "button",
      text: a.label,
      onclick: () => { if (a.onClick?.(close) !== false && a.closes !== false) close(a.reason ?? "action"); },
    })));

  panel.append(
    el("div.panel__head", {},
      el("h2", { style: "font-size:var(--fs-lg)", text: title }),
      el("button.icon-btn", { type: "button", "aria-label": "Mbyll", onclick: () => close("dismiss"), html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>' })),
    el("div.modal__body", {}, content),
    actions.length ? footer : null);

  on(overlay, "click", (e) => { if (e.target === overlay) close("dismiss"); });
  overlay.append(panel);
  host.append(overlay);
  lockScroll(true);
  const release = trapFocus(panel, () => close("dismiss"));
  return { close, panel };
}

// Single toast host, created lazily.
export function toast(message, kind = "info", ms = 3600) {
  const host = $(".toaster") || document.body.appendChild(el("div.toaster", { "aria-live": "polite", role: "status" }));
  const node = el("div.toast", { dataset: { kind }, text: message });
  host.append(node);
  setTimeout(() => { node.style.opacity = "0"; setTimeout(() => node.remove(), 300); }, ms);
}

export const prefersReducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";

// Stamps the stagger index CSS reads; capped so long lists never crawl in.
export function stagger(container, selector = ":scope > *") {
  if (!container) return;
  const max = Number(getComputedStyle(document.documentElement).getPropertyValue("--stagger-max")) || 8;
  $$(selector, container).forEach((node, i) => node.style.setProperty("--i", String(Math.min(i, max))));
  container.classList.add("stagger");
}

// Reveal-on-scroll; observes once per node and unobserves on entry, so no scroll handler runs.
export function observeReveal(root = document) {
  $$(".stagger", root).forEach((n) => stagger(n));
  if (prefersReducedMotion()) {
    return $$(".reveal", root).forEach((n) => n.classList.add("is-in"));
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  $$(".reveal:not(.is-in)", root).forEach((n) => io.observe(n));
  return io;
}

// Wraps a DOM swap in a native cross-fade where supported; runs it plainly otherwise.
export function transition(update) {
  if (prefersReducedMotion() || !document.startViewTransition) return void update();
  document.startViewTransition(update);
}
