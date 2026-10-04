// Declarative description of every admin panel; fields.js turns it into UI.

import { tr } from "../core/i18n.js";

const i18nBlank = { sq: "", en: "" };

// Built from live store data so adding a client immediately offers it to projects.
const clientOptions = (store) => [{ value: "", label: "pa klient" },
  ...(store.get("clients.items", []) ?? []).map((c) => ({ value: c.id, label: c.name || c.id }))];

const categoryOptions = (store) => (store.get("categories", []) ?? []).map((c) => ({ value: c.id, label: tr(c.label) || c.id }));

export const PANELS = [
  {
    id: "general",
    label: "Profili",
    icon: "spark",
    prefix: "profile",
    schema: [
      { type: "text", path: "name", label: "Emri i plotë", max: 80 },
      { type: "text", path: "initials", label: "Inicialet e logos", max: 3, hint: "Përdoret nga logoja e animuar." },
      { type: "i18n", path: "role", label: "Roli" },
      { type: "i18n", path: "location", label: "Vendndodhja" },
      { type: "text", path: "email", label: "Email", inputType: "email", max: 180 },
      { type: "text", path: "phone", label: "Telefon", max: 40 },
      { type: "text", path: "cvUrl", label: "Lidhja e CV-së (PDF)", max: 400 },
      { type: "image", path: "portrait", label: "Portreti" },
      { type: "image", path: "atWork", label: "Foto në punë (Rreth meje)" },
      { type: "i18n", path: "availability", label: "Disponueshmëria" },
    ],
  },
  {
    id: "hero",
    label: "Kreu",
    icon: "layers",
    prefix: "hero",
    schema: [
      { type: "i18n", path: "headline", label: "Titulli kryesor", hint: "Përdorni <em>…</em> për fjalën me theks." },
      { type: "i18nArea", path: "lede", label: "Paragrafi hyrës", rows: 4 },
      {
        type: "list", path: "stats", label: "Shifrat", addLabel: "Shto shifër",
        requires: [["value", "Vlera"], ["label", "Etiketa"]],
        blank: { value: "", label: { ...i18nBlank } },
        itemTitle: (s) => s.value || "Shifër",
        item: (p) => [
          { type: "text", path: "value", label: "Vlera", max: 12 },
          { type: "i18n", path: "label", label: "Etiketa" },
        ],
      },
    ],
  },
  {
    id: "works",
    label: "Punët",
    icon: "book",
    prefix: "",
    schema: [
      { type: "i18n", path: "work.title", label: "Titulli i seksionit" },
      { type: "i18nArea", path: "work.intro", label: "Hyrja", rows: 3 },
      {
        type: "list", path: "categories", label: "Kategoritë", addLabel: "Shto kategori",
        requires: [["label", "Emri"]],
        idFrom: "label",
        blank: { id: "", label: { ...i18nBlank } },
        itemTitle: (c) => tr(c.label) || c.id,
        item: () => [
          { type: "i18n", path: "label", label: "Emri" },
        ],
      },
      {
        type: "list", path: "works", label: "Projektet", addLabel: "Shto projekt",
        requires: [["title", "Titulli"], ["clientId", "Klienti"]],
        idFrom: "title",
        blank: { id: "", featured: false, category: "editorial", clientId: "", client: "", year: "", cover: "", images: [], title: { ...i18nBlank }, summary: { ...i18nBlank }, body: { ...i18nBlank }, tags: [] },
        itemTitle: (w) => tr(w.title) || "Projekt i ri",
        item: () => [
          { type: "i18n", path: "title", label: "Titulli" },
          { type: "i18nArea", path: "summary", label: "Përmbledhje e shkurtër", rows: 2 },
          { type: "i18nArea", path: "body", label: "Përshkrimi i plotë", rows: 6 },
          { type: "select", path: "clientId", label: "Klienti", options: clientOptions, hint: "Përcakton galerinë ku shfaqet ky projekt." },
          { type: "select", path: "category", label: "Kategoria", options: categoryOptions },
          { type: "text", path: "year", label: "Viti", max: 20 },
          { type: "image", path: "cover", label: "Kopertina" },
          { type: "gallery", path: "images", label: "Galeria e projektit" },
          { type: "tags", path: "tags", label: "Mjetet / etiketat" },
          { type: "toggle", path: "featured", label: "Në pah" },
        ],
      },
    ],
  },
  {
    id: "services",
    label: "Shërbimet",
    icon: "code",
    prefix: "services",
    schema: [
      { type: "i18n", path: "title", label: "Titulli i seksionit" },
      { type: "i18nArea", path: "intro", label: "Hyrja", rows: 3 },
      {
        type: "list", path: "items", label: "Shërbimet", addLabel: "Shto shërbim",
        requires: [["title", "Titulli"]],
        idFrom: "title",
        blank: { id: "", icon: "spark", title: { ...i18nBlank }, desc: { ...i18nBlank }, note: { ...i18nBlank } },
        itemTitle: (s) => tr(s.title) || "Shërbim i ri",
        item: () => [
          { type: "i18n", path: "title", label: "Titulli" },
          { type: "i18nArea", path: "desc", label: "Përshkrimi", rows: 3 },
          { type: "i18n", path: "note", label: "Afati / çmimi" },
          { type: "select", path: "icon", label: "Ikona", options: ["spark", "book", "code", "layers", "play", "users", "mail", "pin"].map((v) => ({ value: v, label: v })) },
        ],
      },
    ],
  },
  {
    id: "clients",
    label: "Klientët",
    icon: "users",
    prefix: "",
    schema: [
      { type: "i18n", path: "clients.title", label: "Titulli i seksionit" },
      { type: "i18nArea", path: "clients.intro", label: "Hyrja", rows: 2 },
      {
        type: "list", path: "clients.items", label: "Klientët", addLabel: "Shto klient",
        requires: [["name", "Emri"]],
        idFrom: "name",
        blank: { id: "", name: "", url: "", logo: "", sector: { ...i18nBlank }, blurb: { ...i18nBlank } },
        itemTitle: (c) => c.name || "Klient i ri",
        item: () => [
          { type: "text", path: "name", label: "Emri", max: 120 },
          { type: "i18n", path: "sector", label: "Sektori" },
          { type: "i18nArea", path: "blurb", label: "Përshkrimi në galeri", rows: 3 },
          { type: "text", path: "url", label: "Faqja (opsionale)", max: 400 },
          { type: "image", path: "logo", label: "Logo (opsionale)" },
        ],
      },
      {
        type: "list", path: "testimonials.items", label: "Referencat", addLabel: "Shto referencë",
        requires: [["quote", "Citimi"], ["author", "Autori"]],
        idFrom: "author",
        blank: { id: "", quote: { ...i18nBlank }, author: "", role: { ...i18nBlank } },
        itemTitle: (q) => q.author || "Referencë e re",
        item: () => [
          { type: "i18nArea", path: "quote", label: "Citimi", rows: 3 },
          { type: "text", path: "author", label: "Autori", max: 120 },
          { type: "i18n", path: "role", label: "Roli" },
        ],
      },
    ],
  },
  {
    id: "about",
    label: "Rreth meje",
    icon: "eye",
    prefix: "about",
    schema: [
      { type: "i18n", path: "title", label: "Titulli i seksionit" },
      { type: "i18nArea", path: "body", label: "Biografia", rows: 8 },
      { type: "i18n", path: "atWorkCaption", label: "Titulli i fotos në punë" },
      { type: "tags", path: "skills", label: "Mjete & aftësi" },
      {
        type: "list", path: "timeline", label: "Përvoja", addLabel: "Shto rresht",
        requires: [["year", "Periudha"], ["text", "Përshkrimi"]],
        blank: { year: "", text: { ...i18nBlank } },
        itemTitle: (r) => r.year || "Rresht i ri",
        item: () => [
          { type: "text", path: "year", label: "Periudha", max: 24 },
          { type: "i18n", path: "text", label: "Përshkrimi" },
        ],
      },
    ],
  },
  {
    id: "contact",
    label: "Kontakti",
    icon: "mail",
    prefix: "",
    schema: [
      { type: "i18n", path: "contact.title", label: "Titulli i seksionit" },
      { type: "i18nArea", path: "contact.intro", label: "Hyrja", rows: 3 },
      { type: "text", path: "contact.endpoint", label: "Endpoint i formularit", max: 400, hint: "Bosh = formulari hap klientin e email-it. Vendosni URL-në e API-t kur të jetë gati." },
      { type: "tags", path: "contact.budgets", label: "Intervalet e buxhetit" },
      {
        type: "list", path: "socials", label: "Rrjetet sociale", addLabel: "Shto rrjet",
        requires: [["label", "Emri"], ["url", "Lidhja"]],
        blank: { id: "", label: "", url: "", icon: "instagram" },
        itemTitle: (s) => s.label || "Rrjet i ri",
        item: () => [
          { type: "text", path: "label", label: "Emri", max: 40 },
          { type: "text", path: "url", label: "URL", max: 400 },
          { type: "select", path: "icon", label: "Ikona", options: ["instagram", "facebook", "linkedin", "behance", "mail", "globe", "x"].map((v) => ({ value: v, label: v })) },
        ],
      },
    ],
  },
  {
    id: "footer",
    label: "Fundi i faqes",
    icon: "layers",
    prefix: "footer",
    schema: [
      { type: "i18nArea", path: "blurb", label: "Përshkrimi i shkurtër", rows: 3 },
      { type: "text", path: "legalName", label: "Emri ligjor", max: 120 },
      { type: "text", path: "nipt", label: "NIPT (opsional)", max: 40, hint: "Shfaqet në rreshtin e të drejtave nëse plotësohet." },
      { type: "i18n", path: "address", label: "Adresa" },
    ],
  },
  {
    id: "legal",
    label: "Ligjore",
    icon: "lock",
    prefix: "legal",
    schema: [
      { type: "static", label: "Tekstet ligjore mbështeten te Ligji 9887/2008, GDPR dhe Ligji 35/2016. Konsultoni një jurist para publikimit." },
      { type: "i18n", path: "privacy.title", label: "Privatësia: titulli" },
      { type: "text", path: "privacy.updated", label: "Privatësia: përditësuar (VVVV-MM-DD)", max: 10 },
      { type: "i18nRich", path: "privacy.body", label: "Privatësia: teksti", rows: 14 },
      { type: "i18n", path: "cookies.title", label: "Cookies: titulli" },
      { type: "text", path: "cookies.updated", label: "Cookies: përditësuar", max: 10 },
      { type: "i18nRich", path: "cookies.body", label: "Cookies: teksti", rows: 12 },
      { type: "i18n", path: "terms.title", label: "Kushtet: titulli" },
      { type: "text", path: "terms.updated", label: "Kushtet: përditësuar", max: 10 },
      { type: "i18nRich", path: "terms.body", label: "Kushtet: teksti", rows: 12 },
      { type: "i18n", path: "accessibility.title", label: "Aksesueshmëria: titulli" },
      { type: "text", path: "accessibility.updated", label: "Aksesueshmëria: përditësuar", max: 10 },
      { type: "i18nRich", path: "accessibility.body", label: "Aksesueshmëria: teksti", rows: 12 },
    ],
  },
  {
    id: "settings",
    label: "Cilësimet",
    icon: "save",
    prefix: "settings",
    schema: [
      { type: "select", path: "defaultLang", label: "Gjuha e parazgjedhur", options: [["sq", "Shqip"], ["en", "English"], ["it", "Italiano"], ["de", "Deutsch"], ["fr", "Français"], ["es", "Español"]].map(([value, label]) => ({ value, label })) },
      { type: "color", path: "accent", label: "Ngjyra e theksit" },
      { type: "sections", path: "sections", label: "Seksionet e faqes: renditja dhe dukshmëria" },
    ],
  },
];
