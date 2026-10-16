'use strict';
// Static checks on the built site: links resolve, forms are complete, nothing breaks the strict CSP.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const pages = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'src', 'netlify', 'test', 'docs', 'data'].includes(e.name)) continue; const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.html')) pages.push(f); } };
walk(ROOT);
let problems = 0; const bad = (f, m) => { problems++; console.error(`FAIL ${path.relative(ROOT, f)}: ${m}`); };
const exists = (url) => { const u = url.split('#')[0].split('?')[0]; if (!u) return true; let p = path.join(ROOT, u); if (u.endsWith('/')) p = path.join(p, 'index.html'); return fs.existsSync(p); };
const NEED = ['form-name', 'bot-field', 'form_ts', 'form_elapsed', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'msclkid', 'referrer', 'landing_page', 'first_touch_at', 'name', 'business', 'email', 'phone', 'state', 'category', 'avg_sale', 'consent'];
for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(/(?:href|src)="([^"]+)"/g)) { const u = m[1]; if (/^(https?:|mailto:|tel:|#)/.test(u)) continue; if (u.startsWith('/') && !exists(u)) bad(f, `broken link ${u}`); }
  const ids = new Set([...h.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of h.matchAll(/href="#([^"]+)"/g)) if (!ids.has(m[1])) bad(f, `missing anchor #${m[1]}`);
  if (/\sstyle="/.test(h) || /<style/i.test(h)) bad(f, 'inline style (blocked by CSP)');
  if (/\son[a-z]+="/i.test(h) || /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")/i.test(h)) bad(f, 'inline script or handler (blocked by CSP)');
  if (/src="https?:|href="https?:\/\/[^"]*\.(css|js)"/.test(h)) bad(f, 'third-party script or stylesheet (blocked by CSP)');
  if (!/<title>[^<]{10,}/.test(h) || !/name="description"/.test(h) || !/rel="canonical" href="https:\/\/leadpipes\.com\.au/.test(h)) bad(f, 'missing title, description or leadpipes.com.au canonical');
  if (/cultivated\.agency|leadpipe\.com\.au/.test(h)) bad(f, 'wrong domain or email');
  for (const fm of h.matchAll(/<form[\s\S]*?<\/form>/g)) {
    const form = fm[0];
    if (!/data-netlify="true"/.test(form) || !/data-lead-form/.test(form)) bad(f, 'form missing data-netlify or data-lead-form');
    for (const n of NEED) if (!new RegExp(`name="${n}"`).test(form)) bad(f, `form missing field ${n}`);
    if ((form.match(/required/g) || []).length < 6) bad(f, 'form required fields missing');
  }
}
const lp = pages.filter((f) => f.includes(`${path.sep}lp${path.sep}`));
console.log(`${pages.length} pages checked (${lp.length} landing pages), ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
