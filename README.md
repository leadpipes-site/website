# leadpipes-site

The public website for **leadpipes.com.au**: the main page, a "check availability" application page, five enquiry landing pages, and lead tracking that feeds LeadDrive (the LeadPipes CRM).

Built from the first LeadPipes page (same copy, navy, teal and gold look), rebuilt so every enquiry is captured, attributed to its source and sent into LeadDrive.

## What is in here

| Path | What it is |
|---|---|
| `index.html`, `apply.html`, `privacy.html`, `thanks.html`, `404.html` | Main pages (generated, committed) |
| `lp/<slug>/index.html` | Enquiry landing pages, one per category (generated, committed; indexable unless `indexable` is false in the data) |
| `src/`, `data/landing-pages.json`, `build.js` | Source: layout, partials, page content and the landing page list |
| `assets/styles.css` | All styling |
| `assets/track.js` | First-party attribution: reads UTM tags and ad click ids, fills the hidden form fields. No cookies, no third-party scripts. |
| `netlify/functions/submission-created.js` | Runs after each form submission and sends the enquiry to LeadDrive |
| `netlify.toml` | Build, security headers (strict CSP), redirects |
| `test/` | Function tests and static site checks |
| `docs/tracking-guide.md` | How to tag links, which page to use, how credit is assigned |

## How an enquiry flows

1. Visitor clicks a tagged link, for example a LinkedIn ad pointing at `/lp/commercial-solar/?utm_source=linkedin&utm_medium=paid&utm_campaign=solar-wa-oct26`.
2. `track.js` records the tags and the landing page, then fills the form's hidden fields.
3. Visitor submits the form. Netlify stores the submission (Netlify dashboard > Forms) and emails you if notifications are on.
4. `submission-created.js` posts it to LeadDrive's `/api/hooks/enquiry`. LeadDrive creates the account, contact (consent basis "inbound enquiry", source = the page) and lead, and stores the attribution.
5. **Reports > Lead sources** in LeadDrive shows leads, qualified leads and wins by channel, campaign and landing page.

If LeadDrive is down or not yet hosted, nothing is lost: the submission is still in Netlify Forms, and the function logs a failure with no personal details.

## Put it on GitHub and Netlify

1. Create an empty **private** GitHub repo (suggested name `leadpipes-site`) and add these files to it.
2. In Netlify: **Add new site > Import an existing project > GitHub**, choose the repo. Build command `node build.js`, publish directory `.` (already set in `netlify.toml`).
3. **Domain**: in Netlify, **Domain management > Add a domain** and enter `leadpipes.com.au`. Netlify shows the exact DNS records to set at your registrar (or the nameservers if you use Netlify DNS). Follow what Netlify shows rather than any record copied from elsewhere. HTTPS is automatic once DNS resolves.
4. **Forms**: in Netlify **Forms**, confirm two forms are detected (`apply` and `lp-enquiry`). Under **Forms > Form notifications**, add an email notification to the inbox you want enquiries in.
5. **LeadDrive connection** (when LeadDrive is hosted): in Netlify **Site configuration > Environment variables**, add
   - `LEADDRIVE_URL` = the LeadDrive address, for example `https://crm.leadpipes.com.au`
   - `LEADDRIVE_API_KEY` = a LeadDrive API key with scope **write**, created in LeadDrive under Integrations and API. Never put this key in the repo.
6. Submit a test enquiry from `/lp/exclusive-leads/?utm_source=test&utm_medium=manual&utm_campaign=launch-check` and confirm the lead appears in LeadDrive with its source. Delete the test lead afterwards.

## Develop

```
npm run build   # regenerate the HTML from src/ and data/
npm run check   # build + static checks (links, forms, CSP rules, domain)
npm test        # function tests
```
Edit `src/` and `data/`, never the generated HTML. Node 20 or newer; no dependencies.

## Before you publish: checklist for Darren

- [ ] Mailbox `enquiries@leadpipes.com.au` exists and is monitored (it is shown in the footer and privacy page).
- [ ] Fill in `data/site.json` (entity name, ABN, retention period, optional postal address). `node build.js` lists what is still missing.
- [ ] Privacy policy reviewed by a lawyer (it has NOT been reviewed yet; see CHANGES.md for the items to ask about). Spam Act wording on the consent tick box confirmed.
- [ ] You are comfortable with every claim: "We do not guarantee sales", "Territory protected", "Human quality control", "Every 10 weeks" review, the Darren bio line.
- [ ] No client names, results or testimonials are used anywhere without written permission (none are in the site now).
- [ ] Form notifications switched on in Netlify, test enquiry sent.
