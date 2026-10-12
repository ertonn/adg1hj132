// Live preview: the real site in a same-origin frame, fed unsaved edits as they are typed.

import { debounce, el, on } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { store } from "../core/store.js";
import { getEditLang } from "./fields.js";

const KEY = "nsa:admin:preview";
const SRC = "./?preview=1";
// Below this the pane has no room beside the editor and opens as a full-screen sheet instead.
const WIDE = "(width >= 80rem)";

const DEVICES = [
  { id: "phone", label: "Telefon", width: 390 },
  { id: "tablet", label: "Tablet", width: 820 },
  { id: "desktop", label: "Desktop", width: 1280 },
];

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };

export function createPreview(onToggle) {
  const saved = read();
  // A sheet covering the editor on load would be a surprise, so narrow screens always start closed.
  let open = saved.open !== false && matchMedia(WIDE).matches;
  let device = DEVICES.find((d) => d.id === saved.device) ?? DEVICES[0];
  let focus = null;
  let frame = null;

  const persist = () => write({ open, device: device.id });
  // Nothing is posted until the site inside the frame has announced itself.
  let ready = false;
  const post = (message) => { if (ready) frame.contentWindow.postMessage({ type: "nsa:preview", ...message }, location.origin); };
  const sync = () => post({ content: store.export(), focus, lang: getEditLang() });
  const push = debounce(() => { if (open) sync(); }, 150);

  const stage = el("div.preview__stage");

  // The frame is laid out at the device's real width, then scaled down to fit the pane.
  const fit = () => {
    if (!frame || !stage.clientWidth) return;
    const scale = Math.min(1, stage.clientWidth / device.width);
    Object.assign(frame.style, {
      inlineSize: `${device.width}px`,
      blockSize: `${stage.clientHeight / scale}px`,
      transform: `scale(${scale})`,
      marginInlineStart: `${Math.max(0, (stage.clientWidth - device.width * scale) / 2)}px`,
    });
  };

  // Created on first open, so a phone that never previews never loads the site twice.
  const mount = () => {
    if (frame) return;
    frame = el("iframe.preview__frame", { title: "Pamja paraprake e faqes", src: SRC });
    stage.append(frame);
    fit();
  };

  const devices = el("div.preview__devices", { role: "group", "aria-label": "Gjerësia e pamjes" },
    DEVICES.map((d) =>
      el("button.chip", {
        type: "button", dataset: { device: d.id }, "aria-pressed": String(d === device),
        text: d.label,
        title: `${d.width}px`,
        onclick: () => {
          device = d;
          persist();
          devices.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.device === d.id)));
          fit();
        },
      })));

  const toggle = (next = !open) => {
    open = next;
    node.hidden = !open;
    persist();
    if (open) { mount(); sync(); }
    onToggle?.(open);
  };

  const node = el("aside.preview", { "aria-label": "Pamja paraprake", hidden: !open },
    el("div.preview__bar", {},
      el("div", {},
        el("strong", { text: "Pamja paraprake" }),
        el("p.tiny", { text: "Përfshin ndryshimet e paruajtura." })),
      devices,
      el("button.icon-btn.push", { type: "button", "aria-label": "Mbyll pamjen paraprake", html: icon("close", { size: 16 }), onclick: () => toggle(false) })),
    stage);

  // The frame announces itself once the site has booted (and again after any navigation inside it).
  on(window, "message", (e) => {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin || e.data?.type !== "nsa:preview-ready") return;
    ready = true;
    sync();
  });

  // Drafts are scratch space and never render on the site, so they are not worth a repaint.
  const changed = (e) => { if (!String(e.detail?.path).startsWith("__drafts")) push(); };
  store.on("change", changed);
  store.on("input", changed);
  // The preview speaks whichever language is being edited.
  on(document, "editlang", () => { if (open) post({ lang: getEditLang() }); });

  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(stage);
  if (open) mount();

  return {
    node,
    toggle,
    get open() { return open; },
    // Scrolls the preview to the section the active panel edits.
    setFocus(section) {
      focus = section ?? null;
      if (open) post({ focus });
    },
  };
}
