# Nevila Samarxhi Akulli — portfolio & studio site a

Static portfolio and enquiry hub for a graphic designer and lecturer in Tirana.
Plain HTML, CSS and ES modules — no framework, no build step, no runtime dependency.

```
npm install     # jsdom, for the tests only
npm start       # serve on http://localhost:5173
npm test        # contrast + motion lints, then 161 site and 64 admin checks, headless
npm run art     # regenerate the placeholder artwork in assets/img
```

Open `index.html` for the site and `admin.html` for the content panel.
The site must be served over HTTP — ES modules and `fetch` do not work from `file://`.

## Layout

```
index.html            public site (all sections render from JSON)
admin.html            content panel
404.html
legal/                privacy · terms · cookies · accessibility (one renderer, four stubs)
assets/
  css/                tokens → base → layout → components → motion (+ admin)
  data/content.json   every word and image path on the site
  i18n/               sq · en · it · de · fr · es UI strings
  img/                generated placeholder artwork (SVG), replace with real work
  js/core/            dom · store · i18n · a11y · consent · security · icons
  js/site/            chrome · sections · contact · lightbox · gallery · legal · main
  js/admin/           auth · fields · schema · main
tools/demo-art.mjs    placeholder artwork generator (work tiles + client logos)
tools/pdf-logo.mjs    traces the real logo PDF into SVG; owns favicon/og/logo-full
tools/photos.mjs      optimises source photographs into WebP
tools/brand/          source logo PDF, not served
tests/                headless jsdom suites
_headers / .htaccess  security headers for Netlify/Cloudflare and Apache
```

## How the content model works

`assets/data/content.json` is the single source of truth. Nothing is hard-coded in the
HTML — sections, their order, and their visibility all come from `settings.sections`.

Text comes in two flavours:

- **UI chrome** (`Work`, `Send message`, cookie banner) lives in `assets/i18n/*.json`, read with `t("nav.work")`.
- **Her content** (project titles, bio, legal text) lives inline as `{ "sq": "…", "en": "…" }`, read with `tr(value)`.

`tr()` falls back to English, then to the first non-empty language, so a half-translated
field never renders blank. Only Albanian and English are filled in for project bodies;
the other four fall back until she translates them in the panel.

## Clients and their galleries

Each project carries a `clientId`; each client carries an `id`, `name`, `sector` and `blurb`.
A client card shows a logo (or a generated monogram), sector and project count, and opens an
overlay gallery of **only that client's work** — from which any project opens in the full view.
Clients with no linked work render as plain credits rather than dead buttons.

She controls all of it from the panel: **Klientët** edits the client records, and each project
in **Punët** has a *Klienti* dropdown built live from that list, plus a *Galeria e projektit*
uploader (multi-select, reorder, delete). The first image in a gallery is its cover.

Referential integrity between works, clients and categories is asserted in the audit.

## Demo content

The site ships populated so every layout can be judged at realistic density: **20 projects**
across all five categories, **10 clients each with a logo and linked work**, 5 testimonials,
43 gallery images, and a portrait in About.

`npm run art` regenerates `assets/img` from `tools/demo-art.mjs`. It draws ten templates —
newspaper front page, magazine cover, book jacket, editorial spread, identity sheet,
exhibition panel, official gazette, website mock, poster, menu — over six palettes drawn
from the site's own tokens. Everything is vector and text-free of real photography, so the
whole set is **69 KB for 33 files** and stays sharp at any size.

This is scaffolding, not her work. Replacing it is the first launch step: swap the files in
`assets/img`, or upload real images per project through **Punët → Galeria e projektit**.
The copy is grounded in her actual CV, so it reads correctly until she edits it.

## Admin panel

Every editor is generated from `assets/js/admin/schema.js` — a list of field descriptors.
`fields.js` turns each descriptor into a control (`text`, `i18n`, `i18nRich`, `image`,
`gallery`, `list`, `tags`, `color`, `select`, `sections`, …). **To add a new editable field, add one line to the
schema.** No markup, no event wiring, no new CSS.

The `list` type is a repeater: add, delete, reorder, and a nested schema per item — that
is how Works, Services, Clients, Testimonials and Socials are all edited
by the same 20 lines of code. Its **Add** control sits above the list with the current item
count beside it, so it stays reachable when a list runs to twenty entries.

The panel is usable on a phone: the toolbar compacts (identity and the preview label drop
first, Save never does), the sidebar becomes one horizontally scrolling snap rail rather than
two stacked ones, long card titles truncate instead of shoving the reorder buttons off the
row, and the gallery grid drops to a 7rem minimum. The rail is deliberately **not** sticky
below the sidebar breakpoint, because the toolbar wraps to two rows on narrow phones and any
fixed offset would slide underneath it.

Rich-text fields are passed through `sanitizeHTML()` on every save: anything outside the
tag allow-list is unwrapped, and `<script>`, `<iframe>`, `<style>` and friends are deleted
with their contents. `javascript:` URLs are stripped.

## Persistence — read this before going live

There is no database yet, so `store.js` writes to `localStorage` through an adapter:

```js
export const store = new Store(LocalAdapter);   // assets/js/core/store.js
```

That means **edits live in one browser on one machine and are not public.** The workflow
today is: edit → Save → **Data → Export JSON** → replace `assets/data/content.json` on the
server. The panel says this too.

When the backend exists, swap one line:

```js
export const store = new Store(new RestAdapter("/api/content"));
```

`RestAdapter` is already written — `GET`/`PUT`/`DELETE` as JSON with the CSRF header and
`same-origin` credentials. Nothing else in the codebase changes.

The seed file is deep-merged over saved data, so adding a field to `content.json` later
appears for her without wiping her edits.

## Security — what is real and what is not

**The admin password is a placeholder.** It is the fixed string `admin`, compared in the
browser, defined as `DEV_PASSWORD` in `assets/js/admin/auth.js`. It exists only so the panel
is usable before the database lands. Delete that constant and the check beside it when the
backend issues real sessions. The Security panel says this on screen, in red.

Real:

- CSP on every page (`script-src self`, no inline script — that is why `boot.js` is a file).
- Full header set in `_headers` and `.htaccess`: HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy.
- HTML sanitising on all stored rich text; URL scheme allow-list on every href and image path from data.
- Contact form: honeypot, minimum fill time, length caps, control-character stripping, client-side rate limit.
- Session expiry with idle keep-alive, and login backoff after repeated failures.
- No credential of any kind is written into `content.json`. A test asserts this.

Not real, and must not be treated as real:

- **The password gate is a lock on a glass door.** Anyone can read the constant. Until the
  backend exists, put HTTP Basic Auth or an IP allow-list in front of `admin.html` — the
  commented block in `.htaccess` is ready.
- CSRF tokens and rate limits are browser-side only; re-check both on the server.
- `frame-ancestors` cannot be set from a `<meta>` tag — it only works via the real headers.

## Light and dark

Light is the default, unconditionally: a visitor whose operating system is in dark mode still
lands on the light theme. Dark is a full sibling palette, not a filter. Both are
declared exactly once, in `tokens.css`, as `:root, [data-theme="light"]` and
`[data-theme="dark"]`. There is no duplicated media-query copy of either, because
`boot.js` resolves the "auto" preference to an explicit `data-theme` before first paint —
so CSS only ever sees `light` or `dark`, and there is no flash on load.

Three ways to change it, all sharing one state:

- the **sun/moon button in the header** flips between the two;
- the **accessibility dock** offers Light, Dark and **Auto** — Auto is opt-in, and only then does the OS setting apply;
- while the preference is Auto, an OS change repaints the site live.

The no-JS path resolves to light as well, so the default holds even with scripting off.

`<meta name="theme-color">` is rewritten to match, so the browser chrome tracks the page.
Every component derives from role tokens (`--paper`, `--ink-2`, `--line`, `--accent`),
so a new component is themed by construction — including the overlay veil, which is a
token (`--overlay-veil`) rather than a hard-coded opacity.

`tests/contrast.test.mjs` parses the palettes out of the stylesheet and asserts all 14
foreground/background pairings in **both** themes against WCAG AA. It runs first in
`npm test`, so a palette edit that breaks contrast fails the build.

## Motion

All animation lives in `assets/css/motion.css` — components carry their states, the motion
layer carries how those states are reached. One file to read, one kill switch to trust.

The rule is that **only `transform` and `opacity` animate**, so every effect stays on the
compositor and off the main thread. `tests/motion.test.mjs` enforces it: it parses every
stylesheet and fails the build on a transition or keyframe touching a layout-triggering
property (`width`, `height`, `top`, `margin`, `font-size`…), caps infinite animations at
three (each holds a compositor layer alive), and asserts both reduced-motion kill switches
are present. The lint was verified against deliberate violations, not just a green run.

What moves:

- **Entrance** — header and hero choreograph in on load via CSS delays, no JS timers.
- **Scroll reveal** — one `IntersectionObserver` that unobserves each node on entry, so no scroll handler runs. Grid children stagger off an `--i` index stamped once at render and capped at 8, so a long list never crawls in.
- **Scroll-driven** — the reading-progress rail and the hero recede use `animation-timeline`, which runs entirely off the main thread. Behind `@supports`, so older browsers simply see nothing.
- **View transitions** — theme switch, language switch and work-filter changes cross-fade through `document.startViewTransition()`, wrapped in a `transition()` helper that degrades to a plain swap.
- **Micro-interactions** — hover lifts, an `:active` press on every control, the work image scale, the client monogram pop.

There is exactly **one throttled scroll listener** left in the codebase (the header's stuck
border); everything else is observer- or CSS-driven. No `will-change` is declared anywhere —
browsers promote animating layers on their own and a permanent hint just costs memory.

Reduced motion is honoured twice: the OS `prefers-reduced-motion` query and the in-page
`[data-motion="reduced"]` toggle both collapse every duration and restore revealed content.

Offscreen sections carry `content-visibility: auto` with `contain-intrinsic-size: auto`, so
their layout and paint are skipped until scrolled near. The `auto` keyword makes the browser
remember each real height after first render, which keeps the progress rail accurate.

## Responsive

Three deliberate tiers rather than incidental reflow.

**Phone (<480px)** collapses every grid to one column, makes the About jump links full-width
rows, and turns overlays into bottom sheets capped in `dvh` so mobile browser chrome cannot
clip the controls.

**Tablet (768–1024px)** pins Work, Services, Clients **and testimonials** to two columns —
auto-fit alone gave testimonials a single wasteful column at that width — unstacks the
section headers, and switches About to its two-column portrait layout at 768px so iPad
portrait is not left with a stacked page.

**Desktop** opens up to the auto-fill grids.

Under `@media (hover: none)` hover-only affordances become permanent and every icon button,
chip and menu row grows to a 44px touch target; pointer devices keep the compact 40px.

The mobile drawer needs one non-obvious rule: the header carries `backdrop-filter`, which
makes it the **containing block for fixed-position descendants**. A drawer using
`inset-block-end: 0` therefore measures against the 4.5rem header box and collapses to zero
height. Its height is set explicitly with `calc(100dvh - var(--header-h))` instead. For the
same reason `.header-tools` — not `.nav` — carries the auto margin below 56rem, since the
fixed drawer is out of flex flow and cannot push anything.

## Accessibility

Targets WCAG 2.2 AA, verified for colour by `tests/contrast.test.mjs`. Skip link, landmarks, visible focus everywhere, full keyboard paths
(including the lightbox: arrow keys, Escape, focus trap and restore), labelled fields with
`role="alert"` error slots, `aria-live` save state in the panel.

The floating dock adds seven preferences — theme, text size, contrast, motion, typeface
(Atkinson Hyperlegible), spacing, link underlines. Each is one `data-*` attribute on
`<html>` that CSS reads; `boot.js` applies them before first paint so there is no flash.
`prefers-reduced-motion` and `prefers-color-scheme` are honoured independently.

To add a preference: add one entry to `PREFS` in `a11y.js` and one CSS rule in `tokens.css`.

## Legal (Albania)

Privacy, cookie and terms texts are drafted against **Law 9887/2008** on personal data
protection, **GDPR** for EU visitors, and **Law 35/2016** on copyright, and name the IDP
(`idp.al`) as the supervisory authority. Consent is granular (necessary / preferences /
analytics / marketing), versioned, defaults to rejected, and is revocable from the footer.

**These are drafts.** Have a lawyer review them, and fill in `footer.nipt` and the real
address before launch.

## Before launch

1. Replace `assets/img/work-*.svg` with real work. Keep the aspect ratios; prefer WebP/AVIF under 200 KB. The logo, favicon, og card and both About photographs are already real.
2. Set the real domain in `robots.txt`, `sitemap.xml` and the `og:image` URL.
3. Fill in the real social URLs (the seed points at bare `instagram.com` etc.) and the NIPT.
4. Put a real endpoint in Contact → *Endpoint i formularit*. While it is blank the form falls back to opening the visitor's mail client, which is honest but loses people on mobile.
5. Gate `admin.html` at the server.
6. Deploy the `_headers` (Netlify/Cloudflare) or `.htaccess` (Apache) file — not both.
7. `npm test`.
