// Contact section: validated, rate-limited, honeypot-guarded, mailto fallback.

import { el, on, toast } from "../core/dom.js";
import { t, tr } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { clean, csrfToken, isEmail, looksLikeBot, RateLimiter, safeURL } from "../core/security.js";

const limiter = new RateLimiter("contact", { max: 4, windowMs: 10 * 60_000 });

// One field factory keeps labels, hints, errors and aria wiring identical everywhere.
function field(name, control, { label, required, hint } = {}) {
  const errorId = `${name}-error`;
  control.id = name;
  control.name = name;
  control.setAttribute("aria-describedby", errorId);
  if (required) control.required = true;
  return el("div.field", {},
    el("label.field__label", { for: name }, el("span", { text: label }), required ? el("span.req", { text: " *", "aria-hidden": "true" }) : null),
    control,
    hint ? el("p.field__hint", { text: hint }) : null,
    el("p.field__error", { id: errorId, role: "alert" }));
}

const setError = (form, name, message) => {
  const control = form.elements[name];
  const slot = form.querySelector(`#${name}-error`);
  if (slot) slot.textContent = message ?? "";
  control?.setAttribute("aria-invalid", message ? "true" : "false");
  return !message;
};

export function renderContact(data) {
  const { contact, profile, socials } = data;
  const openedAt = Date.now();

  const form = el("form.contact-form", { novalidate: true, "aria-describedby": "contact-status" });
  const status = el("p.field__error", { id: "contact-status", role: "status", "aria-live": "polite" });

  const subjects = data.services.items.map((s) => tr(s.title));
  const select = (options, placeholder) =>
    el("select.select", {}, el("option", { value: "", text: placeholder }), options.map((o) => el("option", { value: o, text: o })));

  form.append(
    el("input", { type: "hidden", name: "csrf", value: csrfToken() }),
    el("div", { class: "hp", "aria-hidden": "true" }, el("label", { for: "company", text: "Company" }), el("input", { id: "company", name: "company", tabindex: "-1", autocomplete: "off" })),
    el("div.grid", { style: "grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))" },
      field("name", el("input.input", { type: "text", autocomplete: "name", maxlength: "120" }), { label: t("contact.name"), required: true }),
      field("email", el("input.input", { type: "email", autocomplete: "email", maxlength: "180" }), { label: t("contact.email"), required: true })),
    el("div.grid", { style: "grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))" },
      field("subject", select(subjects, t("contact.selectSubject")), { label: t("contact.subject") }),
      field("budget", select(contact.budgets, t("contact.selectBudget")), { label: t("contact.budget") })),
    field("message", el("textarea.textarea", { maxlength: "4000" }), { label: t("contact.message"), required: true }),
    el("label.checkbox", { style: "margin-block:var(--s-2) var(--s-5)" }, el("input", { type: "checkbox", name: "consent" }), el("span", { text: t("contact.consent") })),
    el("div.row", {},
      el("button.btn.btn--primary", { type: "submit" }, el("span", { text: t("contact.send") }), el("span", { html: icon("arrow", { size: 16 }), "aria-hidden": "true" })),
      status));

  on(form, "submit", async (e) => {
    e.preventDefault();
    const f = form.elements;
    const values = { name: clean(f.name.value, 120), email: clean(f.email.value, 180), subject: f.subject.value, budget: f.budget.value, message: clean(f.message.value, 4000) };

    const ok = [
      setError(form, "name", values.name ? "" : t("contact.required")),
      setError(form, "email", !values.email ? t("contact.required") : isEmail(values.email) ? "" : t("contact.invalidEmail")),
      setError(form, "message", values.message.length >= 20 ? "" : t("contact.tooShort")),
    ].every(Boolean);

    if (!f.consent.checked) { status.textContent = t("contact.consentRequired"); return; }
    if (!ok) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
    if (limiter.blockedFor > 0 || looksLikeBot({ elapsedMs: Date.now() - openedAt, honeypot: f.company.value })) {
      status.textContent = t("contact.spam");
      return;
    }

    const button = form.querySelector('button[type="submit"] span');
    button.textContent = t("contact.sending");
    form.querySelector('button[type="submit"]').disabled = true;

    try {
      if (contact.endpoint) {
        const res = await fetch(safeURL(contact.endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": f.csrf.value },
          body: JSON.stringify(values),
        });
        if (!res.ok) throw new Error(String(res.status));
      } else {
        // No backend yet: hand the message to the visitor's mail client.
        const body = `${values.message}\n\n${values.name} · ${values.email}\n${values.subject} · ${values.budget}`;
        location.href = `mailto:${profile.email}?subject=${encodeURIComponent(`[web] ${values.subject || values.name}`)}&body=${encodeURIComponent(body)}`;
      }
      limiter.reset();
      form.reset();
      status.textContent = t("contact.success");
      toast(t("contact.success"), "ok");
    } catch {
      limiter.fail();
      status.textContent = t("contact.error");
      toast(t("contact.error"), "error");
    } finally {
      button.textContent = t("contact.send");
      form.querySelector('button[type="submit"]').disabled = false;
    }
  });

  const line = (iconName, label, value, href) =>
    el("p.contact-line", {},
      el("span", { html: icon(iconName, { size: 18 }) }),
      el("span", {},
        el("span.sr-only", { text: label ? `${label}: ` : "" }),
        href ? el("a", { href, text: value }) : el("span", { text: value })));

  const aside = el("div.contact-aside", {},
    profile.availability
      ? el("p.pill", {}, el("span.pill__dot", { "aria-hidden": "true" }), el("span", { text: tr(profile.availability) }))
      : null,
    el("div", {},
      el("p.footer__title", { text: t("contact.direct") }),
      line("mail", t("common.email"), profile.email, `mailto:${profile.email}`),
      line("phone", t("common.phone"), profile.phone, `tel:${profile.phone.replace(/\s/g, "")}`),
      line("pin", t("contact.location"), tr(profile.location))),
    el("div", {},
      el("p.footer__title", { text: t("footer.social") }),
      el("div.contact-socials", {},
        socials.map((s) => el("a.icon-btn", { href: safeURL(s.url), target: "_blank", rel: "noopener noreferrer me", "aria-label": s.label, title: s.label, html: icon(s.icon, { size: 18 }) })))),
    el("p.tiny", { text: t("contact.privacyNote") }));

  return el("section.section.reveal", { id: "contact", "aria-labelledby": "contact-title" },
    el("div.container", {},
      el("div.section-head", {},
        el("p.eyebrow", { text: t("nav.contact") }),
        el("div", {},
          el("h2.section-title", { id: "contact-title", text: tr(contact.title) }),
          el("p.section-intro", { text: tr(contact.intro) }))),
      el("div.grid.grid--contact", {}, form, aside)));
}
