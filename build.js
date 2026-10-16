#!/usr/bin/env node
'use strict';
/*
 * Tiny static site builder. No dependencies.
 *   node build.js
 * Reads src/ and data/, writes the finished HTML into the repo root and /lp/.
 * The generated files are committed, so Netlify can also serve the repo with no build at all.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const SITE = 'https://leadpipes.com.au';
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const write = (rel, content) => { const f = path.join(ROOT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const layout = read('src', 'layout.html');
const header = read('src', 'partials', 'header.html');
const footerTpl = read('src', 'partials', 'footer.html');
const hidden = read('src', 'partials', 'form-hidden.html');
const fields = read('src', 'partials', 'form-fields.html');

// Real business facts live in data/site.json. Anything left empty shows a bracketed placeholder where unavoidable
// (privacy policy) and is listed in a build warning. Nothing here is ever invented.
const site = JSON.parse(read('data', 'site.json'));
const BOOKING_URL = site.bookingUrl;
const EMAIL = site.email;
const OG_IMAGE = SITE + '/assets/og-image.png';
const outstanding = new Map();
const ph = (key, text) => {
  if (site[key]) return esc(site[key]);
  outstanding.set(key, text);
  return `<mark class="ph">[${esc(text)}]</mark>`;
};

const CATEGORIES = ['Commercial solar and energy', 'Kitchens, bathrooms and renovations', 'Commercial fit-out and construction', 'B2B and professional services', 'Other'];
const landing = JSON.parse(read('data', 'landing-pages.json'));
const faq = JSON.parse(read('data', 'faq.json'));
const plain = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&rsquo;/g, "'").replace(/&amp;/g, '&');

// Categories linked from the home page and footer: indexable landing pages only (never the consumer-risk page).
const linked = landing.filter((l) => l.indexable);

const footerCategories = linked.map((l) => `        <p><a href="/lp/${l.slug}/">${esc(l.crumb)}</a></p>\n`).join('');
const entityLines = (() => {
  let out = '';
  if (site.entityName) out += `        <p>Operated by ${esc(site.entityName)}</p>\n`;
  else outstanding.set('entityName', 'registered business name to be supplied');
  if (site.abn) out += `        <p>ABN ${esc(site.abn)}</p>\n`;
  else outstanding.set('abn', 'ABN to be supplied');
  if (site.postalAddress) out += `        <p>${esc(site.postalAddress)}</p>\n`;
  return out;
})();
const footer = fill(footerTpl, { entityLines, footerCategories, email: esc(EMAIL) }).replace(/<!--[\s\S]*?-->\n?/g, '');

const ldScript = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>\n`;
const crumbLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + p })),
});

const sitemap = [];
function page({ file, title, description, canonicalPath, robots = 'index,follow', content, ld = [] }) {
  const clean = content.replace(/<!--[\s\S]*?-->\n?/g, '');
  const html = fill(layout, { title: esc(title), description: esc(description), robots, canonical: SITE + canonicalPath, ogimage: OG_IMAGE, jsonld: ld.map(ldScript).join(''), header, footer, content: clean });
  write(file, html);
  if (robots.startsWith('index')) sitemap.push(canonicalPath);
}

function form({ formName, row3, buttonLabel, extraFields = '' }) {
  const body = fill(fields, { row3, buttonLabel: esc(buttonLabel), extraFields });
  return `<form name="${formName}" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field" data-lead-form>\n${fill(hidden, { formName })}${body}    </form>`;
}

const STATE_FIELD = `<label>State
          <select name="state" required data-error="Choose the state you operate in, or National.">
            <option value="">Choose one</option>
            <option>WA</option><option>NSW</option><option>VIC</option><option>QLD</option><option>SA</option><option>TAS</option><option>NT</option><option>ACT</option><option>National</option>
          </select>
        </label>`;

// ---- home ----
const categoryCards = linked.map((l) => `      <a class="pillar pillar-link" href="/lp/${l.slug}/"><small>Category</small><b>${esc(l.crumb)}</b><span class="more">${esc(plain(l.lead).split('. ')[0].replace(/\.$/, ''))}.</span></a>\n`).join('');
const orgLd = {
  '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE + '/#organization', name: 'LeadPipes', url: SITE + '/',
  description: 'Exclusive, researched and qualified lead generation for Australian businesses. One client per category per state.',
  email: EMAIL, areaServed: { '@type': 'Country', name: 'Australia' },
  founder: { '@type': 'Person', name: 'Darren Harry' },
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: EMAIL, areaServed: 'AU', availableLanguage: 'en-AU' },
};
if (site.entityName) orgLd.legalName = site.entityName;
const siteLd = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'LeadPipes', inLanguage: 'en-AU', publisher: { '@id': SITE + '/#organization' } };
page({
  file: 'index.html', title: 'LeadPipes | Exclusive Lead Generation for Australian Businesses',
  description: 'Exclusive, researched and qualified leads for Australian businesses that know how to close. One category, one state, one client. Built by champions. Engineered to win.',
  canonicalPath: '/', content: fill(read('src', 'pages', 'index.html'), { categoryCards }), ld: [orgLd, siteLd],
});

// ---- how it works, FAQ ----
page({
  file: 'how-it-works.html', title: 'How a LeadPipes Handover Works | LeadPipes',
  description: 'See what you receive with every lead, an illustrative sample lead pack, and the performance targets LeadPipes measures itself against.',
  canonicalPath: '/how-it-works.html', content: read('src', 'pages', 'how-it-works.html'),
  ld: [crumbLd([['Home', '/'], ['How it works', '/how-it-works.html']])],
});
const faqItems = faq.map((f) => `      <details class="qa"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>\n`).join('');
const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
page({
  file: 'faq.html', title: 'Frequently Asked Questions | LeadPipes',
  description: 'Plain answers on exclusivity, what qualified means, replacements, how leads are sourced, the Spam Act, what LeadPipes does not do, and how to start.',
  canonicalPath: '/faq.html', content: fill(read('src', 'pages', 'faq.html'), { faqItems }),
  ld: [faqLd, crumbLd([['Home', '/'], ['FAQ', '/faq.html']])],
});

// ---- apply ----
const applyExtra = `          <div class="f2">
            <label>Your role
              <select name="role">
                <option value="">Choose one</option>
                <option>Owner or director</option><option>Sales or business development</option><option>Marketing</option><option>General manager</option><option>Other</option>
              </select>
            </label>
            <label>Team size
              <select name="team_size">
                <option value="">Choose one</option>
                <option>Just me</option><option>2 to 5</option><option>6 to 20</option><option>21 to 50</option><option>Over 50</option>
              </select>
            </label>
          </div>
          <div class="f2">
            <label>Years trading
              <select name="years_trading">
                <option value="">Choose one</option>
                <option>Under 2</option><option>2 to 5</option><option>6 to 10</option><option>Over 10</option>
              </select>
            </label>
            <label>Monthly marketing spend (AUD)
              <select name="marketing_spend">
                <option value="">Choose one</option>
                <option>Nothing yet</option><option>Under $2,000</option><option>$2,000 to $5,000</option><option>$5,000 to $15,000</option><option>Over $15,000</option>
              </select>
            </label>
          </div>
          <label>Opportunities you want per month
            <select name="leads_wanted">
              <option value="">Choose one</option>
              <option>1 to 5</option><option>6 to 15</option><option>16 to 30</option><option>More than 30</option>
            </select>
          </label>
          <fieldset class="checks">
            <legend>Where your leads come from today (tick any)</legend>
            <label class="check"><input type="checkbox" name="sources" value="Referrals"><span>Referrals</span></label>
            <label class="check"><input type="checkbox" name="sources" value="Google or SEO"><span>Google or SEO</span></label>
            <label class="check"><input type="checkbox" name="sources" value="Paid ads"><span>Paid ads</span></label>
            <label class="check"><input type="checkbox" name="sources" value="Lead marketplaces"><span>Lead marketplaces</span></label>
            <label class="check"><input type="checkbox" name="sources" value="Outbound"><span>Outbound</span></label>
            <label class="check"><input type="checkbox" name="sources" value="Not much at the moment"><span>Not much at the moment</span></label>
          </fieldset>
          <label>Best time for a discovery call
            <select name="call_window">
              <option value="">No preference</option>
              <option>Morning (Perth time)</option><option>Afternoon (Perth time)</option><option>Evening (Perth time)</option>
            </select>
          </label>
`;
const CTA_APPLY = 'Apply for a territory';
const applyForm = form({
  formName: 'apply', buttonLabel: CTA_APPLY, extraFields: applyExtra,
  row3: `      <div class="f2">\n        <label>Business category\n          <select name="category" required data-error="Choose the category that best describes your business.">\n            <option value="">Choose one</option>\n            ${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}\n          </select>\n        </label>\n        ${STATE_FIELD}\n      </div>`,
});
page({
  file: 'apply.html', title: 'Apply for a Territory | LeadPipes',
  description: 'Tell us what you sell, where, and what you want from LeadPipes. If your category and state are open and the fit is strong, Darren replies personally.', canonicalPath: '/apply.html',
  content: `<section class="dark">\n  <div class="wrap lp-hero">\n    <div>\n      <p class="eyebrow">Apply for a territory</p>\n      <h1>Take the <span class="accent">territory.</span></h1>\n      <p class="lead">We take a limited number of clients so each one gets proper attention. If your category and state are open and the commercial fit is strong, Darren replies personally.</p>\n      <div class="assure"><span>One category</span><span>One state</span><span>One client</span></div>\n      <p class="side-link"><a class="textlink" href="/book.html">Prefer to talk first? Book a discovery call</a></p>\n    </div>\n    <div class="form-card">\n      <h2 class="form-title">Apply for a territory</h2>\n      <p class="sub">Seven short questions. Everything else is optional.</p>\n      ${applyForm}\n    </div>\n  </div>\n</section>`,
  ld: [crumbLd([['Home', '/'], ['Apply for a territory', '/apply.html']])],
});

page({ file: 'thanks.html', title: 'Thanks | LeadPipes', description: 'Enquiry received.', canonicalPath: '/thanks.html', robots: 'noindex,nofollow', content: fill(read('src', 'pages', 'thanks.html'), { booking: BOOKING_URL }) });
page({
  file: 'book.html', title: 'Book a Discovery Call | LeadPipes',
  description: 'Book a 30 minute discovery call with Darren Harry to see whether your category and state are open.', canonicalPath: '/book.html',
  content: fill(read('src', 'pages', 'book.html'), { booking: BOOKING_URL }),
  ld: [crumbLd([['Home', '/'], ['Book a discovery call', '/book.html']])],
});
page({ file: '404.html', title: 'Page not found | LeadPipes', description: 'Page not found.', canonicalPath: '/404.html', robots: 'noindex,nofollow', content: read('src', 'pages', '404.html') });
page({
  file: 'privacy.html', title: 'Privacy Policy | LeadPipes',
  description: 'How LeadPipes collects, uses, shares and protects personal information, including lead details shared with clients.', canonicalPath: '/privacy.html',
  content: fill(read('src', 'pages', 'privacy.html'), {
    updated: esc(site.policyUpdated), email: esc(EMAIL),
    entity: ph('entityName', 'registered business name to be supplied'), abn: ph('abn', 'ABN to be supplied'),
    retention: ph('retentionPeriod', 'retention period to be confirmed'),
    postal: site.postalAddress ? ` Postal address: ${esc(site.postalAddress)}.` : '',
  }),
  ld: [crumbLd([['Home', '/'], ['Privacy policy', '/privacy.html']])],
});

// ---- enquiry landing pages (one per category) ----
// Indexable pages carry "index,follow" and are listed in the sitemap. A page marked indexable:false is noindex and
// is left out of the sitemap and out of the home page and footer links. robots.txt never blocks them, so noindex is seen.
for (const lp of landing) {
  const f = form({
    formName: 'lp-enquiry', buttonLabel: CTA_APPLY,
    row3: `      <div class="f2">\n        ${STATE_FIELD}\n        <input type="hidden" name="category" value="${esc(lp.category)}">\n      </div>`,
  });
  const points = lp.points.map(([t, d]) => `<div class="pillar"><small>${esc(t)}</small><p>${esc(d)}</p></div>`).join('');
  const intro = lp.intro && lp.intro.length ? `<section class="white">
  <div class="wrap two">
    <div>
      <p class="eyebrow">${esc(lp.crumb)}</p>
      <h2>How it works for you.</h2>
      ${lp.intro.map((p) => `<p>${esc(p)}</p>`).join('\n      ')}
    </div>
    <div class="box-list">
      ${lp.lookFor ? `<h3>${esc(lp.lookFor.title)}</h3>\n      <ul class="ticks">${lp.lookFor.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${lp.disclosure ? `<p class="define">${esc(lp.disclosure)}</p>` : ''}
    </div>
  </div>
</section>` : '';
  const content = `<section class="dark">
  <div class="wrap lp-hero">
    <div>
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span>${esc(lp.crumb)}</span></nav>
      <p class="eyebrow">${esc(lp.eyebrow)}</p>
      <h1>${lp.h1}</h1>
      <p class="lead">${esc(lp.lead)}</p>
      <div class="cta-row"><a class="btn" href="/book.html">Book a discovery call</a><a class="btn ghost" href="#enquire">${CTA_APPLY}</a></div>
      <div class="assure"><span>One category</span><span>One state</span><span>One client</span></div>
    </div>
    <div class="form-card" id="enquire">
      <h2 class="form-title">${CTA_APPLY}</h2>
      <p class="sub">Seven short questions. If your category and state are open, Darren replies personally.</p>
      ${f}
    </div>
  </div>
</section>
<section class="on-light">
  <div class="wrap">
    <p class="eyebrow">What you get</p>
    <h2>Fewer leads.<br>Better conversations.</h2>
    <div class="pillars">${points}</div>
    <p class="define">See exactly what is in a handover on <a href="/how-it-works.html">How it works</a>, and read the <a href="/faq.html">FAQ</a>.</p>
  </div>
</section>
${intro}
<section class="white">
  <div class="wrap founder">
    <p>We want serious operators: businesses where one good sale matters, with a team that responds fast and can close. <b>We do not guarantee sales.</b> We commit to researched, qualified, exclusive opportunities.</p>
    <a class="btn" href="/book.html">Book a discovery call</a>
  </div>
</section>`;
  const robots = lp.indexable ? 'index,follow' : 'noindex,follow';
  page({
    file: `lp/${lp.slug}/index.html`, title: lp.title, description: lp.description, canonicalPath: `/lp/${lp.slug}/`, robots, content,
    ld: [crumbLd([['Home', '/'], [lp.crumb, `/lp/${lp.slug}/`]])],
  });
}

// ---- robots and sitemap ----
// No Disallow lines: pages that should stay out of search carry a noindex tag, which crawlers can only see if they may fetch the page.
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${site.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${8 + landing.length} pages (${landing.length} landing pages, ${sitemap.length} in the sitemap).`);
if (outstanding.size) console.warn(`WARNING: ${outstanding.size} placeholder(s) outstanding, supply the real facts in data/site.json: ${[...outstanding].map(([k, t]) => `${k} [${t}]`).join('; ')}`);
