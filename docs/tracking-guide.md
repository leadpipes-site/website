# Lead tracking guide (leadpipes.com.au)

Every enquiry that comes through a LeadPipes form lands in LeadDrive as a lead, with where it came from stored on the lead and shown in **Reports > Lead sources**. For that to work, links that send people to the site must carry tags.

## How a link is tagged

Add three tags to the end of any link to the site:

`?utm_source=<where>&utm_medium=<type>&utm_campaign=<name>`

| Tag | Meaning | Examples |
|---|---|---|
| utm_source | The platform or list | `linkedin`, `google`, `facebook`, `instagram`, `leaddrive`, `referral-name` |
| utm_medium | The type of traffic | `paid`, `cpc`, `email`, `social`, `organic`, `dm` |
| utm_campaign | The campaign name. Lower case, no spaces. | `solar-vic-oct26`, `fitout-wa-q4` |
| utm_content (optional) | Which ad or message variant | `video-a`, `headline-2` |

Use lower case and hyphens, and always the same spelling. `LinkedIn` and `linkedin` are reported as different channels.

## Example links

- LinkedIn ad to the solar page: `https://leadpipes.com.au/lp/commercial-solar/?utm_source=linkedin&utm_medium=paid&utm_campaign=solar-wa-oct26`
- Google search ad: `https://leadpipes.com.au/lp/kitchens-bathrooms-renovations/?utm_source=google&utm_medium=cpc&utm_campaign=reno-perth`
- Facebook post: `https://leadpipes.com.au/?utm_source=facebook&utm_medium=social&utm_campaign=organic-oct26`
- Instagram bio link: `https://leadpipes.com.au/?utm_source=instagram&utm_medium=social&utm_campaign=bio`
- Link inside a LeadDrive email sequence: `https://leadpipes.com.au/lp/b2b-services/?utm_source=leaddrive&utm_medium=email&utm_campaign=<campaign-name>`

Google and Meta ads also add their own click ids (gclid, fbclid). The site records them automatically. If an ad has no UTM tags, LeadDrive still labels the channel `google / cpc` or `facebook / paid` from the click id.

## Which touch gets the credit

1. Tags on the visit that produced the enquiry, else
2. tags from the same browsing session, else
3. the visitor's first recorded visit (stored on their device), so a person who clicked an ad on Monday and came back direct on Friday is still credited to the ad.

The lead also records the page the form was on (`landing_page`), the website that referred the visitor, and the time of the first visit.

## Landing pages

| Page | Use it for |
|---|---|
| `/` | The main site and organic traffic |
| `/apply.html` | Direct "apply for a territory" requests |
| `/lp/exclusive-leads/` | General paid traffic, category unknown |
| `/lp/commercial-solar/` | Solar and energy installers |
| `/lp/kitchens-bathrooms-renovations/` | Renovation businesses |
| `/lp/commercial-fitout-construction/` | Fit-out, construction, trades |
| `/lp/b2b-services/` | B2B and professional services |

The solar, fit-out and B2B pages are indexable and in the sitemap. `/lp/exclusive-leads/` and `/lp/kitchens-bathrooms-renovations/` are noindex and left out of the sitemap (the kitchens page is held back until legal review, so do not run outbound or paid traffic to it yet). robots.txt does not block any page, so noindex is respected.

## Adding a new landing page

1. Add an entry to `data/landing-pages.json` (copy an existing one). Set `indexable` to false to keep it out of search and the sitemap.
2. Run `npm run build`.
3. Commit the changes. Netlify publishes it.

## Reading the results

In LeadDrive: **Reports > Lead sources** shows leads, sales-ready leads, qualified leads, wins and won value by channel, campaign and landing page. Each lead's drawer shows a "Where it came from" line.

## What this does not do

- It does not count visits. Enquiry tracking starts when someone submits a form. For visit counts and conversion rate, add privacy-friendly analytics (for example Plausible) or Netlify Analytics later. Both are a decision for Darren.
- It does not load Meta or Google tracking pixels. If you add them later, the privacy policy must be updated first and you should take legal advice on consent.
