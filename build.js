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
const footer = read('src', 'partials', 'footer.html');
const hidden = read('src', 'partials', 'form-hidden.html');
const fields = read('src', 'partials', 'form-fields.html');
const updated = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Australia/Perth' });

const CATEGORIES = ['Commercial solar and energy', 'Kitchens, bathrooms and renovations', 'Commercial fit-out and construction', 'B2B and professional services', 'Other'];

function page({ file, title, description, canonicalPath, robots = 'index,follow', content }) {
  const html = fill(layout, { title: esc(title), description: esc(description), robots, canonical: SITE + canonicalPath, header, footer, content });
  write(file, html);
}

function form({ formName, categoryField, buttonLabel }) {
  const body = fill(fields, { categoryField, buttonLabel: esc(buttonLabel) });
  return `<form name="${formName}" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field" data-lead-form>\n${fill(hidden, { formName })}${body}    </form>`;
}

const sitemap = [];

// ---- plain pages ----
page({ file: 'index.html', title: 'LeadPipes | Exclusive Lead Generation for Serious Operators', description: 'Exclusive, researched and qualified leads for high-value businesses that know how to close. One category. One state. One client. Built by Champions. Engineered to Win.', canonicalPath: '/', content: read('src', 'pages', 'index.html') });
sitemap.push('/');

const applyForm = form({
  formName: 'apply', buttonLabel: 'Request availability',
  categoryField: `<label>Business category\n        <select name="category" required>\n          <option value="">Choose one</option>\n          ${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}\n        </select>\n      </label>`,
});
page({
  file: 'apply.html', title: 'Check Availability | LeadPipes', description: 'Tell us what you sell, where, and what a genuine opportunity is worth. If your category and state are open and the fit is strong, Darren calls you personally.', canonicalPath: '/apply.html',
  content: `<section class="dark">\n  <div class="wrap lp-hero">\n    <div>\n      <p class="eyebrow">Check availability</p>\n      <h1>Take the <span class="accent">territory.</span></h1>\n      <p class="lead">We take a limited number of clients so each one gets proper attention. If your category and state are open and the commercial fit is strong, Darren calls you personally.</p>\n      <div class="assure"><span>One category</span><span>One state</span><span>One client</span></div>\n    </div>\n    <div class="form-card">\n      <h3>Apply for exclusivity</h3>\n      <p class="sub">Takes two minutes.</p>\n      ${applyForm}\n    </div>\n  </div>\n</section>`,
});
sitemap.push('/apply.html');

page({ file: 'thanks.html', title: 'Thanks | LeadPipes', description: 'Enquiry received.', canonicalPath: '/thanks.html', robots: 'noindex,nofollow', content: read('src', 'pages', 'thanks.html') });
page({ file: '404.html', title: 'Page not found | LeadPipes', description: 'Page not found.', canonicalPath: '/404.html', robots: 'noindex,nofollow', content: read('src', 'pages', '404.html') });
page({ file: 'privacy.html', title: 'Privacy policy | LeadPipes', description: 'How LeadPipes collects, uses and protects information.', canonicalPath: '/privacy.html', content: fill(read('src', 'pages', 'privacy.html'), { updated }) });
sitemap.push('/privacy.html');

// ---- enquiry landing pages (one per category; noindex so paid traffic does not compete with the main site in search) ----
const landing = JSON.parse(read('data', 'landing-pages.json'));
for (const lp of landing) {
  const f = form({ formName: 'lp-enquiry', buttonLabel: lp.button, categoryField: `<input type="hidden" name="category" value="${esc(lp.category)}">` });
  const points = lp.points.map(([t, d]) => `<div class="pillar"><small>${esc(t)}</small><p>${esc(d)}</p></div>`).join('');
  const content = `<section class="dark">
  <div class="wrap lp-hero">
    <div>
      <p class="eyebrow">${esc(lp.eyebrow)}</p>
      <h1>${lp.h1}</h1>
      <p class="lead">${esc(lp.lead)}</p>
      <div class="assure"><span>One category</span><span>One state</span><span>One client</span></div>
    </div>
    <div class="form-card" id="enquire">
      <h3>${esc(lp.button)}</h3>
      <p class="sub">If your category and state are open, Darren calls you personally.</p>
      ${f}
    </div>
  </div>
</section>
<section class="on-light">
  <div class="wrap">
    <p class="eyebrow">What you get</p>
    <h2>Fewer leads.<br>Better conversations.</h2>
    <div class="pillars">${points}</div>
  </div>
</section>
<section class="white">
  <div class="wrap founder">
    <p>We want serious operators: businesses where one good sale matters, with a team that responds fast and can close. <b>We do not guarantee sales.</b> We commit to researched, qualified, exclusive opportunities.</p>
    <a class="btn" href="#enquire">${esc(lp.button)}</a>
  </div>
</section>`;
  page({ file: `lp/${lp.slug}/index.html`, title: lp.title, description: lp.description, canonicalPath: `/lp/${lp.slug}/`, robots: 'noindex,follow', content });
}

// ---- robots and sitemap ----
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /lp/\nDisallow: /thanks.html\n\nSitemap: ${SITE}/sitemap.xml\n`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`Built ${5 + landing.length} pages (${landing.length} landing pages).`);
