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
  description: 'Exclusive lead partnerships for a handful of serious Australian businesses. One partner per category per state.',
  email: EMAIL, areaServed: { '@type': 'Country', name: 'Australia' },
  founder: { '@type': 'Person', name: 'Darren Harry' },
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: EMAIL, areaServed: 'AU', availableLanguage: 'en-AU' },
};
if (site.entityName) orgLd.legalName = site.entityName;
const siteLd = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: 'LeadPipes', inLanguage: 'en-AU', publisher: { '@id': SITE + '/#organization' } };
page({
  file: 'index.html', title: 'LeadPipes | Exclusive Lead Partnerships, Australia',
  description: 'A handful of partners. One category, one state, one partner. Researched, qualified opportunities led by Darren Harry OAM, Olympic medallist and World Champion.',
  canonicalPath: '/', content: fill(read('src', 'pages', 'index.html'), { categoryCards }), ld: [orgLd, siteLd],
});

// ---- how it works, FAQ ----
page({
  file: 'how-it-works.html', title: 'How LeadPipes Chooses Partners and Hands Over | LeadPipes',
  description: 'How LeadPipes chooses its partners, what you receive with every lead, an illustrative sample lead pack, and the performance targets we measure ourselves against.',
  canonicalPath: '/how-it-works.html', content: read('src', 'pages', 'how-it-works.html'),
  ld: [crumbLd([['Home', '/'], ['How it works', '/how-it-works.html']])],
});
const faqItems = faq.map((f) => `      <details class="qa"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>\n`).join('');
const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
page({
  file: 'faq.html', title: 'Frequently Asked Questions | LeadPipes',
  description: 'Plain answers on how partners are chosen, exclusivity, what qualified means, replacements, price, the Spam Act, what LeadPipes does not do, and how to apply.',
  canonicalPath: '/faq.html', content: fill(read('src', 'pages', 'faq.html'), { faqItems }),
  ld: [faqLd, crumbLd([['Home', '/'], ['FAQ', '/faq.html']])],
});

// ---- apply ----
const applyExtra = `          <label>What is a customer worth to you over time? (AUD)\n            <select name="customer_value">\n              <option value="">Choose one</option>\n              <option>Under $20,000</option><option>$20,000 to $50,000</option><option>$50,000 to $150,000</option><option>Over $150,000</option>\n            </select>\n          </label>\n          <label>Who closes your sales, and how quickly does your team respond to a new enquiry?<textarea name="response_time" maxlength="400"></textarea></label>\n          <label>What would a great next twelve months look like, in numbers?<textarea name="twelve_months" maxlength="400"></textarea></label>\n          <label>What would you expect from me, and what are you willing to commit?<textarea name="commitment" maxlength="400"></textarea></label>\n          <div class="f2">
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
          <label>Best time for a conversation
            <select name="call_window">
              <option value="">No preference</option>
              <option>Morning (Perth time)</option><option>Afternoon (Perth time)</option><option>Evening (Perth time)</option>
            </select>
          </label>
`;
const CTA_APPLY = 'Submit my application';
const applyForm = form({
  formName: 'apply', buttonLabel: CTA_APPLY, extraFields: applyExtra,
  row3: `      <div class="f2">\n        <label>Business category\n          <select name="category" required data-error="Choose the category that best describes your business.">\n            <option value="">Choose one</option>\n            ${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}\n          </select>\n        </label>\n        ${STATE_FIELD}\n      </div>`,
});
page({
  file: 'apply.html', title: 'Apply to Work with Darren | LeadPipes',
  description: 'Tell Darren what you sell, who buys it and what a good customer is worth. He reads every application and replies personally within 3 business days.', canonicalPath: '/apply.html',
  content: `<section class="dark">\n  <div class="wrap lp-hero">\n    <div>\n      <p class="eyebrow">Apply to work with Darren</p>\n      <h1>Not everyone qualifies. <span class="accent">That is the point.</span></h1>\n      <p class="lead">This is a two-way assessment. I work with a handful of partners and I decide who, so the work is worth doing for both of us. I read every application myself. If your business looks like a fit and your category and state are open, I will reply with a link to book a thirty minute conversation. If it is not, I will tell you plainly, and where I can, point you somewhere better. You will hear from me within 3 business days either way.</p>\n      <div class="assure"><span>One category</span><span>One state</span><span>One partner</span></div>\n    </div>\n    <div class="form-card">\n      <h2 class="form-title">Tell me about your business.</h2>\n      <p class="sub">Seven short questions are required. The rest are optional, and they help me say yes.</p>\n      ${applyForm}\n    </div>\n  </div>\n</section>`,
  ld: [crumbLd([['Home', '/'], ['Apply to work with Darren', '/apply.html']])],
});

page({ file: 'thanks.html', title: 'Thanks | LeadPipes', description: 'Enquiry received.', canonicalPath: '/thanks.html', robots: 'noindex,nofollow', content: fill(read('src', 'pages', 'thanks.html'), { }) });
page({
  file: 'book.html', title: 'Your Conversation with Darren | LeadPipes',
  description: 'Conversations with Darren Harry are by invitation, once an application has been reviewed.', canonicalPath: '/book.html', robots: 'noindex,follow',
  content: read('src', 'pages', 'book.html'),
  ld: [crumbLd([['Home', '/'], ['Your conversation with Darren', '/book.html']])],
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
      <div class="cta-row"><a class="btn" href="#enquire">Apply to work with Darren</a></div>
      <div class="assure"><span>One category</span><span>One state</span><span>One partner</span></div>
    </div>
    <div class="form-card" id="enquire">
      <h2 class="form-title">Tell me about your business.</h2>
      <p class="sub">Seven short questions. I read every application myself, and reply within 3 business days.</p>
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
    <p>I work with a handful of serious operators: businesses where one good sale matters, with a team that responds fast and can close. <b>We do not guarantee sales.</b> We commit to researched, qualified, exclusive opportunities.</p>
    <a class="btn" href="#enquire">Apply to work with Darren</a>
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
