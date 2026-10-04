// Admin entry point: gate, sidebar, schema-driven panels, save/export/import.

import { $, el, on, toast } from "../core/dom.js";
import { store } from "../core/store.js";
import { detect, setLang } from "../core/i18n.js";
import { initA11y, mountA11yDock } from "../core/a11y.js";
import { icon } from "../core/icons.js";
import { build } from "./fields.js";
import { PANELS } from "./schema.js";
import { DEV_PASSWORD, currentSession, endSession, gate, keepAlive } from "./auth.js";

const root = $("#app");
let active = PANELS[0].id;
let dirtyLabel = null;

const markDirty = (saved = false) => { if (dirtyLabel) dirtyLabel.textContent = saved ? "Gjithçka e ruajtur" : "Ndryshime të paruajtura"; };

const panelById = (id) => PANELS.find((p) => p.id === id) ?? PANELS[0];

function renderPanel() {
  const panel = panelById(active);
  return el("section.admin-panel", { "aria-labelledby": "panel-title" },
    el("header.admin-panel__head", {},
      el("h2", { id: "panel-title", text: panel.label }),
      el("p.tiny", { text: `Ndryshimet ruhen kur shtypni «Ruaj».` })),
    el("div.stack", {}, build(panel.schema, panel.prefix)));
}

function renderSidebar(onPick) {
  return el("nav.admin-nav", { "aria-label": "Seksionet" },
    el("ul", { role: "list" },
      PANELS.map((p) =>
        el("li", {},
          el("button.admin-nav__item", {
            type: "button",
            "aria-current": String(p.id === active),
            html: `${icon(p.icon, { size: 18 })}<span>${p.label}</span>`,
            onclick: () => { active = p.id; onPick(); },
          })))),
    el("hr", { style: "border:0;border-top:1px solid var(--line);margin-block:var(--s-4)" }),
    el("ul", { role: "list" },
      el("li", {}, el("button.admin-nav__item", { type: "button", html: `${icon("lock", { size: 18 })}<span>Siguria</span>`, "aria-current": String(active === "security"), onclick: () => { active = "security"; onPick(); } })),
      el("li", {}, el("button.admin-nav__item", { type: "button", html: `${icon("download", { size: 18 })}<span>Të dhënat</span>`, "aria-current": String(active === "data"), onclick: () => { active = "data"; onPick(); } }))));
}

function securityPanel() {
  const checklist = [
    "Shërbeni faqen vetëm përmes HTTPS (HSTS i aktivizuar).",
    "Vendosni headers-at e sigurisë nga skedari _headers ose .htaccess.",
    "Mbroni /admin.html me autentikim serveri (Basic Auth ose IP allow-list) derisa të lidhet baza e të dhënave.",
    "Zëvendësoni fjalëkalimin e përkohshëm me autentikim serveri para publikimit.",
    "Bëni eksport të rregullt nga paneli «Të dhënat» si kopje rezervë.",
  ];

  return el("section.admin-panel", {},
    el("header.admin-panel__head", {}, el("h2", { text: "Siguria" })),
    // Says plainly what the gate is, so nobody mistakes it for a real control.
    el("div.admin-warning", { role: "note" },
      el("p", {}, el("strong", { text: "Autentikim i përkohshëm." })),
      el("p.tiny", { text: `Fjalëkalimi është i fiksuar në «${DEV_PASSWORD}» dhe kontrollohet vetëm në shfletues. Kushdo që hap kodin e lexon. Kjo do zëvendësohet me verifikim nga baza e të dhënave.` }),
      el("p.tiny", { text: "Deri atëherë, mbroni /admin.html me autentikim serveri." })),
    el("h3", { style: "margin-block:var(--s-6) var(--s-3)", text: "Lista e kontrollit para publikimit" }),
    el("ul.stack", { role: "list" }, checklist.map((x) => el("li.row", {}, el("span", { html: icon("check", { size: 16 }), style: "color:var(--ok)" }), el("span.tiny", { text: x })))));
}

function dataPanel(rerender) {
  const file = el("input", { type: "file", accept: "application/json", class: "input" });

  on(file, "change", async () => {
    const picked = file.files?.[0];
    if (!picked) return;
    try { await store.import(await picked.text()); await store.save(); toast("Përmbajtja u importua.", "ok"); rerender(); }
    catch (err) { toast(`Importimi dështoi: ${err.message}`, "error"); }
  });

  const download = () => {
    const url = URL.createObjectURL(new Blob([store.export()], { type: "application/json" }));
    const link = el("a", { href: url, download: `content-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(link);
    link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 0);
  };

  return el("section.admin-panel", {},
    el("header.admin-panel__head", {}, el("h2", { text: "Të dhënat" }), el("p.tiny", { text: `Ruajtur së fundi: ${store.get("meta.updatedAt", "–")}` })),
    el("div.stack", {},
      el("p.muted", { text: "Deri sa të lidhet baza e të dhënave, përmbajtja ruhet në këtë shfletues. Eksportoni rregullisht dhe zëvendësoni assets/data/content.json në server për ta bërë publike." }),
      el("div.row", {},
        el("button.btn.btn--primary", { type: "button", html: `${icon("download", { size: 16 })}<span>Eksporto JSON</span>`, onclick: download }),
        el("button.btn.btn--danger.btn--sm", { type: "button", html: `${icon("reset", { size: 16 })}<span>Rikthe përmbajtjen fillestare</span>`, onclick: async () => { if (confirm("Të fshihen të gjitha ndryshimet lokale?")) { await store.resetToSeed(); rerender(); toast("U rikthye.", "ok"); } } })),
      el("div.field", {}, el("p.field__label", { text: "Importo një skedar JSON" }), file)));
}

function renderShell() {
  dirtyLabel = el("span.tiny", { id: "save-state", role: "status", "aria-live": "polite", text: store.dirty ? "Ndryshime të paruajtura" : "Gjithçka e ruajtur" });

  const save = el("button.btn.btn--primary", { type: "button", html: `${icon("save", { size: 16 })}<span>Ruaj</span>`, onclick: async () => { await store.save(); markDirty(true); toast("U ruajt.", "ok"); } });

  const body = active === "security" ? securityPanel() : active === "data" ? dataPanel(renderShell) : renderPanel();

  root.replaceChildren(
    el("header.admin-bar", {},
      el("div.row", {},
        el("strong", { text: "Paneli i përmbajtjes" }),
        el("span.tiny.admin-bar__who", { text: store.get("profile.name", "") })),
      el("div.row.push", {},
        dirtyLabel,
        el("a.btn.btn--ghost.btn--sm.admin-bar__view", { href: "index.html", target: "_blank", rel: "noopener", title: "Shiko faqen", html: `${icon("eye", { size: 16 })}<span>Shiko faqen</span>` }),
        save,
        el("button.btn.btn--ghost.btn--sm.admin-bar__out", { type: "button", text: "Dil", onclick: endSession }))),
    el("div.admin-layout", {}, renderSidebar(renderShell), el("main", { id: "main", tabindex: "-1" }, body)));
}

(async () => {
  initA11y();
  const data = await store.init();
  await setLang(detect(data.settings.defaultLang));

  const minutes = store.get("admin.sessionMinutes", 60);
  if (!currentSession()) await gate(root, minutes);
  keepAlive(minutes);

  renderShell();
  mountA11yDock();
  store.on("change", () => markDirty(false));
  window.addEventListener("beforeunload", (e) => { if (store.dirty) { e.preventDefault(); e.returnValue = ""; } });
})().catch((err) => { console.error(err); root.append(el("p.empty", { text: "Paneli nuk u ngarkua dot." })); });
