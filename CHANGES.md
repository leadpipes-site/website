# Website changes: 16/10/2026

Source of the work: independent website review (review-6) and the Australian compliance review (review-3). Local only: nothing has been pushed, deployed or submitted.

## What changed

1. **Privacy policy rewritten** (`src/pages/privacy.html`). Covers who we are, what is collected (forms, Calendly bookings, no cookies, first-party attribution, form timing), business contact details collected for outreach, purposes, honest disclosure of lead and contact details to the client who engages LeadPipes, named service providers (Netlify, Google Workspace, Calendly, Railway), overseas disclosure, security, retention, access/correction/removal/unsubscribe, complaints (OAIC, ACMA). The false "we do not sell or share your details" line is gone (policy and forms). The date is fixed at 16/10/2026 in `data/site.json`, not regenerated per build. A collection notice linking to the policy is on every form. Privacy contact is `enquiries@leadpipes.com.au`, used in the footer too.
2. **Consumer-outreach risk.** Kitchens/bathrooms/renovations page rewritten as clearly B2B ("we do not cold-contact homeowners"; opportunities described only as inbound/opt-in or published business details). It is noindex, out of the sitemap, and not linked from the home page or footer until legal review.
3. **Solar page.** "One installer per state" and "Protected state" removed. Exclusivity is stated as agreed per category, state and client.
4. **Apply form shortened.** Above the fold: name, business, work email, website, category, state, what you want, optional phone. Role, team size, years trading, marketing spend, leads wanted, sources, call window and average sale moved into a "Tell us more (optional)" disclosure. All field names kept. Plain, specific error messages via `assets/form.js` (`data-error` attributes). Landing-page forms use the same short form.
5. **Navigation and CTAs.** Header and hero primary CTA is "Book a discovery call" (`/book.html`); secondary is "Apply for a territory". Old labels removed everywhere (enforced by a test). Header also links How it works and FAQ. Tags are carried onto `/book` links as well as `/apply`.
6. **Proof without fabrication.** New `/how-it-works.html`: illustrative sample lead pack (clearly labelled fake, six handover items) and "How we measure" (targets: acceptance 80%+, first-response SLA 90%+, replacement under 10%, each with how it is measured, stated as targets not results). New `/faq.html` with 10 questions (`data/faq.json`). No testimonials, logos, prices or results.
7. **SEO.** robots.txt has no Disallow lines. Solar, fit-out/construction and B2B pages are indexable with unique titles and descriptions, linked from the home page and footer. JSON-LD: Organization and WebSite (home), FAQPage (FAQ only, generated from the same data as the visible text), BreadcrumbList (all inner pages). Canonicals, Open Graph and Twitter tags, a 1200x630 OG image (`assets/og-image.png`), sitemap `lastmod` from a fixed constant in `data/site.json`. The site has no content images, so there is no alt text to add (the OG image has `og:image:alt`).
8. **Trust and contrast.** Small print on dark sections now `#9fb6c6` (8.3:1); teal-on-light small text darkened (`--teal-d` `#0a756b`); dimmed heading colour lightened. A contrast test guards the pairs. Footer: contact email, privacy link, category links and an outcomes disclaimer ("we do not guarantee sales"; performance figures are targets). Entity name and ABN appear in the footer automatically once set in `data/site.json`.
9. **Spam protection.** Honeypot kept. `submission-created.js` now also: rejects a filled honeypot; time-traps (`form_elapsed` from the browser, or `form_ts` vs Netlify `created_at`; under 2 seconds is rejected; negative gaps from a wrong device clock are ignored); rejects tampered timestamps; stricter email validation; ignores submissions with 2+ URLs in name, business or goal. Only reason codes are logged, never personal data. Rejected submissions are still kept in Netlify Forms; they are just not forwarded to LeadDrive. `track.js` fills `form_ts`, fills `form_elapsed` at submit, and now restores the Sending... button after 15 seconds or on back/forward navigation.
10. **Role mapping.** `role` is sent to LeadDrive as a top-level field with `phone`, `website`, `state`, `vertical` (all also still in the message text). Bearer `LEADDRIVE_API_KEY` unchanged; no new secrets.
11. **Analytics.** No third-party script added. First-party attribution fields are unchanged. See the recommendation below.

Also: new `data/site.json` (single place for real business facts), build prints a warning listing outstanding placeholders, HTML comments are stripped from built output, README and tracking guide updated, 15 new tests (function, SEO, forms, privacy, contrast).

## Placeholders needing real facts (set in `data/site.json`, then `node build.js`)

| Key | Where it shows now |
|---|---|
| `entityName` (registered business name) | Privacy policy: visible `[registered business name to be supplied]`. Footer: shown automatically once set (nothing visible until then; HTML comment in `src/partials/footer.html`). |
| `abn` | Same as above: `[ABN to be supplied]` in the privacy policy. |
| `retentionPeriod` | Privacy policy: `[retention period to be confirmed]`. |
| `postalAddress` (optional) | Not shown until set; then appears in the privacy policy and footer. |

These placeholders appear only on `/privacy.html`; no other indexable page shows one (tested). The Spam Act sender-identification point from the reviews means the footer should show entity name and ABN as soon as they are known.

## Needs a lawyer

- The whole privacy policy: it has **not** been reviewed by a lawyer (HTML comment in `src/pages/privacy.html`; not stated on the public page).
- Whether handing over lead and contact details to the client is lawful on the current basis. Review-3 (C-1) recommends an explicit "introduction consent" step before handover. The policy describes sharing on qualification; it does not claim an introduction-consent step exists. Align policy and process once decided.
- Overseas disclosure wording ("including the United States and other countries" is a hedge, countries are not verified) and the APP 8 position for Netlify, Railway, Google, Calendly.
- Whether the small-business exemption applies given the lead-sharing model.
- The policy commitments "we record that and tell the client" when someone asks not to be contacted, and "no later than the law allows" for unsubscribe.
- The consent tick box wording (required, scoped to this enquiry and the discovery call, covers phone/SMS), the FAQ's Spam Act answer, and the B2B-only outreach wording.
- The kitchens/bathrooms/renovations page before it is indexed or linked, and whether that vertical should exist at all (review-3 C-3).
- ACL review of claims: "reviewed before handover", "exclusive", the 10-week review, replacement wording.

## Needs Darren's decision

- Confirm these are operationally true: "Reviewed before handover" (replaced "Human quality control"), "Every 10 weeks" review, "agreed in writing" criteria and exclusivity, replacement of non-qualifying leads (FAQ), "first contact within the response time we agree with you".
- I softened "No recycled contacts" (removed) and "Territory protected" (now "Exclusive per category and state") because review-3 M-4 says they cannot yet be guaranteed. Restore only if provable.
- Website is a required field on the form (type "none" if no site). Make it optional if conversion matters more than the data.
- Mailbox `enquiries@leadpipes.com.au` must exist and be monitored (the old site used `hello@`; every reference now says `enquiries@`).
- Whether to keep `/lp/exclusive-leads/` noindex (it is the generic paid page and duplicates the home page).
- Pricing: the site says it is agreed on the discovery call. No price is published.
- URL form: canonicals and links still use `.html` (`/apply.html`). Netlify may also serve `/apply`. Confirm the preferred form in Netlify and, if you want clean URLs, change canonicals, sitemap and links together.

## Deliberately not done

- No push, deploy, Netlify/GoDaddy/Railway/account access, form submission or email.
- No testimonials, client names, logos, statistics, awards, prices, ABN, address or legal claims invented. The sample lead pack is labelled as invented.
- No "lawyer-reviewed" claim anywhere.
- No third-party analytics, fonts, scripts or styles (strict CSP unchanged; the only new inline content is non-executable JSON-LD data blocks, which the CSP permits).
- ROI (3x) gate from the product description is not shown; only the three gates you specified.
- The `/lp` 302 redirect and HSTS `includeSubDomains` left as they are (low priority; the redirect target is noindex).
- The review's "Calendly opens in a new tab loses attribution" is not fixed: embedding Calendly needs a CSP change. Tags are carried onto `/book` links instead.
- Netlify cannot delete spam via this function; rejected submissions need clearing in the Netlify Forms dashboard.
- No visual check in a browser was possible in this environment; the layout and CSS additions are untested visually. Please eyeball the home page, `/how-it-works.html`, `/apply.html` on desktop and phone before deploying.

## Recommendation: privacy-friendly analytics (no account created)

The review rightly says you cannot optimise conversion blind. Options, none installed:

1. **Netlify Analytics** (server-side, from CDN logs): no script, no CSP change, no cookies; paid add-on; page views and sources only, no CTA or form-step events. Lowest risk; privacy line is one sentence.
2. **Cookieless hosted tool (e.g. Plausible, Fathom)**: custom events for CTA clicks and form submits, simple dashboards. Needs `script-src` (and `connect-src`) CSP additions for the vendor or a proxied first-party path, a privacy policy update (a third-party processor, likely overseas), and a monthly fee.
3. **Self-hosted cookieless (e.g. Umami, Plausible CE)**: full control and first-party; you run another service (Railway), keep it patched and update the policy. More effort.
4. **First-party only (current)**: UTM and click ids already land in LeadDrive Lead sources, so you can measure enquiry sources. Add a tiny own-domain beacon endpoint later if you want CTA clicks without a vendor.

Suggested path: start with option 1 or 4 now; move to option 2 once paid traffic runs and you need CTA and form-abandonment events. Whatever you choose, update the privacy policy in the same change.
