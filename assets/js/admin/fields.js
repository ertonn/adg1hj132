// Schema-driven field renderers. Every editor in the panel is built from these.

import { el, on, openModal, toast, uid } from "../core/dom.js";
import { LANGS, tr } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { clean, sanitizeHTML } from "../core/security.js";
import { store } from "../core/store.js";

const MAX_IMAGE_BYTES = 600_000;

// Wrapper shared by every control so labels, hints and spacing never diverge.
const wrap = (label, control, hint) =>
  el("div.field", {},
    label ? el("label.field__label", { for: control.id ?? undefined, text: label }) : null,
    control,
    hint ? el("p.field__hint", { text: hint }) : null);

const bind = (control, path, transform = (v) => v) => {
  control.value = store.get(path, "") ?? "";
  on(control, "input", () => store.set(path, transform(control.value), { silent: true }));
  on(control, "change", () => store.set(path, transform(control.value)));
  return control;
};

const text = (f, path) => wrap(f.label, bind(el("input.input", { id: uid("f"), type: f.inputType ?? "text", maxlength: f.max ?? 240, placeholder: f.placeholder ?? "" }), path, (v) => clean(v, f.max ?? 240)), f.hint);

const textarea = (f, path) => wrap(f.label, bind(el("textarea.textarea", { id: uid("f"), rows: f.rows ?? 5, maxlength: f.max ?? 6000 }), path), f.hint);

const richtext = (f, path) => {
  const control = bind(el("textarea.textarea", { id: uid("f"), rows: f.rows ?? 12, maxlength: f.max ?? 20000, spellcheck: "true" }), path, (v) => sanitizeHTML(v));
  return wrap(f.label, control, f.hint ?? "HTML i lejuar: p, h3, ul, li, strong, em, a. Gjithçka tjetër hiqet.");
};

// One tabbed control edits the same field in every supported language.
function i18nField(f, path, kind = "text") {
  const id = uid("i18n");
  const tabs = el("div.filters", { role: "tablist", "aria-label": f.label });
  const slot = el("div");
  let active = LANGS[0].code;

  const paint = () => {
    const sub = `${path}.${active}`;
    const control = kind === "richtext"
      ? el("textarea.textarea", { id, rows: f.rows ?? 12, maxlength: 20000 })
      : kind === "textarea"
        ? el("textarea.textarea", { id, rows: f.rows ?? 4, maxlength: f.max ?? 4000 })
        : el("input.input", { id, type: "text", maxlength: f.max ?? 240 });
    bind(control, sub, kind === "richtext" ? sanitizeHTML : (v) => clean(v, f.max ?? 20000));
    slot.replaceChildren(control);
    tabs.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.lang === active)));
  };

  tabs.replaceChildren(...LANGS.map((l) =>
    el("button.chip", {
      type: "button", dataset: { lang: l.code }, "aria-pressed": String(l.code === active),
      text: l.code.toUpperCase(),
      title: l.label,
      onclick: () => { active = l.code; paint(); },
    })));

  paint();
  return el("div.field", {},
    el("label.field__label", { for: id, text: f.label }),
    tabs, slot,
    el("p.field__hint", { text: f.hint ?? "Fushat bosh bien automatikisht te anglishtja." }));
}

// `options` may be a function so a select can be built from live store data.
const select = (f, path) => {
  const options = typeof f.options === "function" ? f.options(store) : f.options;
  const control = el("select.select", { id: uid("f") }, options.map((o) => el("option", { value: o.value, text: o.label })));
  return wrap(f.label, bind(control, path), f.hint);
};

const toggle = (f, path) => {
  const input = el("input", { type: "checkbox", id: uid("f") });
  input.checked = Boolean(store.get(path, false));
  on(input, "change", () => store.set(path, input.checked));
  return el("label.checkbox", { style: "margin-block:var(--s-3)" }, input, el("span", { text: f.label }));
};

const color = (f, path) => {
  const input = el("input", { type: "color", id: uid("f"), style: "inline-size:4rem;block-size:2.75rem;padding:2px;border:1px solid var(--line);border-radius:var(--radius)" });
  input.value = store.get(path, "#b4462f");
  on(input, "input", () => { store.set(path, input.value); document.documentElement.style.setProperty("--accent", input.value); });
  return wrap(f.label, input, f.hint);
};

// Reads a picked file into the store as a data URI; no upload endpoint needed yet.
function readInto(file, path, done) {
  if (file.size > MAX_IMAGE_BYTES) return toast(`Imazhi është mbi ${Math.round(MAX_IMAGE_BYTES / 1000)} KB. Optimizojeni së pari.`, "error");
  const reader = new FileReader();
  reader.onload = () => { store.set(path, reader.result); done(reader.result); };
  reader.readAsDataURL(file);
}

// Accepts a URL or a small local file.
function image(f, path) {
  const preview = el("img.admin-thumb", { alt: "" });
  const url = bind(el("input.input", { id: uid("f"), type: "text", placeholder: "assets/img/… ose https://…" }), path);
  const file = el("input", { type: "file", accept: "image/*", class: "input" });

  const refresh = () => { preview.src = store.get(path, "") || ""; preview.hidden = !preview.src; };
  on(url, "input", refresh);
  on(file, "change", () => { const picked = file.files?.[0]; if (picked) readInto(picked, path, (v) => { url.value = v; refresh(); }); });

  refresh();
  return el("div.field", {},
    el("label.field__label", { for: url.id, text: f.label }),
    url, file, preview,
    el("p.field__hint", { text: f.hint ?? "Preferoni SVG/WebP nën 200 KB. Skedarët lokalë ruhen si data URI." }));
}

// Array of image paths: multi-upload, reorder, delete — the per-project gallery.
function gallery(f, path) {
  const host = el("div.gallery-grid");
  const picker = el("input", { type: "file", accept: "image/*", multiple: true, class: "input" });

  const paint = () => {
    const items = store.get(path, []) ?? [];
    host.replaceChildren(
      ...items.map((src, i) =>
        el("figure.gallery-item", {},
          el("img.admin-thumb", { src: src || "", alt: `${f.label} ${i + 1}` }),
          el("div.gallery-item__bar", {},
            el("button.icon-btn", { type: "button", "aria-label": "Zhvendos majtas", html: icon("up", { size: 14 }), onclick: () => { store.move(path, i, i - 1); paint(); } }),
            el("button.icon-btn", { type: "button", "aria-label": "Zhvendos djathtas", html: icon("down", { size: 14 }), onclick: () => { store.move(path, i, i + 1); paint(); } }),
            el("button.icon-btn", { type: "button", "aria-label": "Fshi imazhin", html: icon("trash", { size: 14 }), onclick: () => { store.removeAt(path, i); paint(); } })))),
      items.length ? null : el("p.tiny", { text: "Ende pa imazhe." }));
  };

  on(picker, "change", () => {
    const picked = [...(picker.files ?? [])];
    let pending = picked.length;
    picked.forEach((file) => {
      const index = (store.get(path, []) ?? []).length;
      store.push(path, "");
      readInto(file, `${path}.${index}`, () => { if (--pending === 0) paint(); });
    });
    picker.value = "";
  });

  paint();
  return el("div.field", {},
    el("p.field__label", { text: f.label }),
    host, picker,
    el("p.field__hint", { text: f.hint ?? "Imazhi i parë përdoret si kopertinë e galerisë së klientit." }));
}

const tags = (f, path) => {
  const control = el("input.input", { id: uid("f"), type: "text" });
  control.value = (store.get(path, []) ?? []).join(", ");
  const commit = () => store.set(path, control.value.split(",").map((s) => clean(s, 40)).filter(Boolean));
  on(control, "change", commit);
  return wrap(f.label, control, f.hint ?? "Ndani me presje.");
};

// Repeater: add, delete and reorder items that each render a nested schema.
function list(f, path, render) {
  const host = el("div.stack");

  const paint = () => {
    const items = store.get(path, []) ?? [];
    host.replaceChildren(
      // Add sits above the list: with twenty projects, hunting for it at the bottom is a chore.
      el("div.list-add", {},
        el("button.btn.btn--ghost.btn--sm", { type: "button", html: `${icon("plus", { size: 16 })}<span>${f.addLabel ?? "Shto"}</span>`, onclick: () => openDraft(f, path, render, paint) }),
        items.length ? el("span.tiny", { text: `${items.length}` }) : null),
      ...items.map((item, i) =>
        el("details.admin-card", { open: items.length <= 2 },
          el("summary", {},
            el("span", { text: f.itemTitle?.(item, i) ?? `#${i + 1}` }),
            el("span.row", {},
              el("button.icon-btn", { type: "button", "aria-label": "Lart", html: icon("up", { size: 16 }), onclick: (e) => { e.preventDefault(); store.move(path, i, i - 1); paint(); } }),
              el("button.icon-btn", { type: "button", "aria-label": "Poshtë", html: icon("down", { size: 16 }), onclick: (e) => { e.preventDefault(); store.move(path, i, i + 1); paint(); } }),
              el("button.icon-btn", { type: "button", "aria-label": "Fshi", html: icon("trash", { size: 16 }), onclick: (e) => { e.preventDefault(); if (confirm("Ta fshij këtë element?")) { store.removeAt(path, i); paint(); } } }))),
          el("div.admin-card__body", {}, render(`${path}.${i}`, item)))));
  };

  paint();
  return el("div.field", {}, el("p.field__label", { text: f.label }), host);
}

// A value counts as filled if it is non-empty text, or an i18n object with any language set.
const filled = (v) => (v && typeof v === "object" ? Object.values(v).some((x) => String(x ?? "").trim()) : String(v ?? "").trim() !== "");

// IDs key cross-references between lists, so they are derived, never typed.
const slug = (v) => String(tr(v) || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);

// New entries are composed in a dialog and only join the list once valid and confirmed.
function openDraft(f, path, render, done) {
  const key = path.replace(/[^\w]/g, "_");
  const draftPath = store.beginDraft(key, f.blank);
  const error = el("p.field__error", { role: "alert" });

  const missing = () => (f.requires ?? []).filter(([p]) => !filled(store.get(`${draftPath}.${p}`))).map(([, label]) => label);

  openModal({
    title: f.addLabel ?? "Shto",
    wide: true,
    content: [el("div", {}, render(draftPath, store.get(draftPath))), error],
    onClose: (reason) => { if (reason !== "commit") store.cancelDraft(key); },
    actions: [
      { label: "Anulo", variant: "ghost", reason: "cancel" },
      {
        label: f.addLabel ?? "Shto",
        variant: "primary",
        onClick: (close) => {
          const gaps = missing();
          // Returning false keeps the dialog open with the work intact.
          if (gaps.length) { error.textContent = `Plotësoni: ${gaps.join(", ")}.`; return false; }
          if ("id" in (f.blank ?? {})) {
            const taken = new Set((store.get(path) ?? []).map((x) => x?.id));
            const base = slug(store.get(`${draftPath}.${f.idFrom ?? "label"}`)) || "item";
            let id = base;
            for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
            store.set(`${draftPath}.id`, id, { silent: true });
          }
          store.commitDraft(key, path);
          close("commit");
          done();
          toast("U shtua.", "ok");
        },
      },
    ],
  });
}

// Section order and visibility, edited as a single reorderable list.
function sections(f, path) {
  const host = el("div.stack");
  const paint = () => {
    const items = store.get(path, []) ?? [];
    host.replaceChildren(...items.map((s, i) =>
      el("div.admin-row", {},
        el("strong", { text: s.id }),
        el("label.checkbox", {},
          el("input", { type: "checkbox", checked: s.enabled, onchange: (e) => store.set(`${path}.${i}.enabled`, e.target.checked) }),
          el("span", { text: "E dukshme" })),
        el("span.row.push", {},
          el("button.icon-btn", { type: "button", "aria-label": "Lart", html: icon("up", { size: 16 }), onclick: () => { store.move(path, i, i - 1); paint(); } }),
          el("button.icon-btn", { type: "button", "aria-label": "Poshtë", html: icon("down", { size: 16 }), onclick: () => { store.move(path, i, i + 1); paint(); } })))));
  };
  paint();
  return el("div.field", {}, el("p.field__label", { text: f.label }), host);
}

// Field type → builder. Adding a type needs no change anywhere else.
export const FIELDS = {
  text, textarea, richtext, select, toggle, color, image, gallery, tags, list, sections,
  i18n: (f, p) => i18nField(f, p, "text"),
  i18nArea: (f, p) => i18nField(f, p, "textarea"),
  i18nRich: (f, p) => i18nField(f, p, "richtext"),
  static: (f) => el("p.muted", { text: f.label }),
};

// Turn a schema array into DOM, resolving each field's dotted store path.
export function build(schema, prefix = "") {
  return schema.map((f) => {
    const path = f.path ? (prefix ? `${prefix}.${f.path}` : f.path) : prefix;
    const make = FIELDS[f.type];
    if (!make) return null;
    // A list renders its nested schema once per item, under that item's path.
    return f.type === "list" ? make(f, path, (sub) => build(f.item(sub), sub)) : make(f, path);
  }).filter(Boolean);
}
