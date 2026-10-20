'use strict';
// Checks on the built site: indexing, sitemap, structured data, CTAs, forms, privacy, contrast.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'src', 'netlify', 'test', 'docs', 'data'].includes(e.name)) continue; const f = path.join(d, e.name); if (e.isDirectory()) walk(f, out); else if (f.endsWith('.html')) out.push(path.relative(ROOT, f)); } return out; };
const pages = walk(ROOT);
const robotsOf = (h) => (/<meta name="robots" content="([^"]+)"/.exec(h) || [])[1];
const canonOf = (h) => (/<link rel="canonical" href="([^"]+)"/.exec(h) || [])[1];
const sitemapUrls = [...rd('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const SITE = 'https://leadpipes.com.au';

test('robots.txt has no Disallow, and sitemap equals the set of indexable pages', () => {
  assert.doesNotMatch(rd('robots.txt'), /Disallow:\s*\S/);
  assert.match(rd('robots.txt'), /Sitemap: https:\/\/leadpipes\.com\.au\/sitemap\.xml/);
  const indexable = pages.filter((f) => /^index/.test(robotsOf(rd(f)))).map((f) => canonOf(rd(f)));
  assert.deepEqual([...indexable].sort(), [...sitemapUrls].sort());
  for (const f of pages) { const h = rd(f); if (/^noindex/.test(robotsOf(h))) assert.ok(!sitemapUrls.includes(canonOf(h)), `${f} is noindex but in sitemap`); }
});

test('sitemap lastmod is a fixed constant, not the build date', () => {
  const site = JSON.parse(rd('data/site.json'));
  for (const m of rd('sitemap.xml').matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) assert.equal(m[1], site.lastmod);
  assert.match(site.lastmod, /^\d{4}-\d{2}-\d{2}$/);
});

test('kitchens page is noindex, out of the sitemap and not linked from home or footer; the four B2B pages are indexable and linked', () => {
  const k = rd('lp/kitchens-bathrooms-renovations/index.html');
  assert.match(robotsOf(k), /^noindex/);
  assert.ok(!sitemapUrls.some((u) => u.includes('kitchens')));
  for (const f of pages) assert.ok(!(f !== 'lp/kitchens-bathrooms-renovations/index.html' && rd(f).includes('/lp/kitchens-bathrooms-renovations/')), `${f} links the consumer-risk page`);
  assert.doesNotMatch(k, /homeowners and developers|research and qualify homeowners/i);
  assert.match(k, /do not cold-contact homeowners/i);
  const home = rd('index.html');
  for (const slug of ['commercial-solar', 'commercial-fitout-construction', 'b2b-services']) {
    const h = rd(`lp/${slug}/index.html`);
    assert.match(robotsOf(h), /^index/); assert.ok(sitemapUrls.includes(`${SITE}/lp/${slug}/`));
    assert.ok(home.includes(`/lp/${slug}/`), `home links ${slug}`);
    assert.ok(rd('privacy.html').includes(`/lp/${slug}/`), `footer links ${slug}`);
  }
  const titles = pages.map((f) => /<title>([^<]+)/.exec(rd(f))[1]); assert.equal(new Set(titles).size, titles.length, 'titles are unique');
  const descs = pages.map((f) => /name="description" content="([^"]+)"/.exec(rd(f))[1]); assert.equal(new Set(descs).size, descs.length, 'descriptions are unique');
});

test('solar page makes no sitewide exclusivity claim', () => {
  const h = rd('lp/commercial-solar/index.html');
  assert.doesNotMatch(h, /One installer per state|Your competitors do not get the same lead|Protected state/);
  assert.match(h, /per category, state and partner/);
});

test('JSON-LD is valid; FAQPage matches the visible FAQ; Organization and WebSite on home', () => {
  const blocks = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const types = (h) => blocks(h).map((b) => b['@type']);
  assert.deepEqual(types(rd('index.html')).sort(), ['Organization', 'WebSite']);
  const faq = rd('faq.html'); const f = blocks(faq).find((b) => b['@type'] === 'FAQPage');
  assert.ok(f.mainEntity.length >= 8 && f.mainEntity.length <= 16);
  const visible = faq.replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  for (const q of f.mainEntity) { assert.ok(visible.includes(q.name.replace(/\s+/g, ' ')), `question visible: ${q.name}`); assert.ok(visible.includes(q.acceptedAnswer.text.slice(0, 60)), `answer visible: ${q.name}`); }
  for (const p of pages.filter((x) => !['index.html', 'faq.html', '404.html', 'thanks.html'].includes(x))) assert.ok(types(rd(p)).includes('BreadcrumbList'), `${p} has breadcrumbs`);
  for (const p of pages) { assert.ok(!blocks(rd(p)).some((b) => b['@type'] === 'FAQPage') || p === 'faq.html'); assert.match(rd(p), /<meta property="og:image" content="https:\/\/leadpipes\.com\.au\/assets\/og-image\.png">/); assert.match(rd(p), /twitter:card/); }
  assert.ok(fs.existsSync(path.join(ROOT, 'assets/og-image.png')));
});

test('one primary CTA label sitewide; /apply is the CTA in header and hero; booking is by invitation only', () => {
  const banned = /Check availability|Check my state|Talk to Darren|Apply for exclusivity|Request category availability|Request availability|Book a discovery call|Apply for a territory|take the territory/i;
  for (const f of pages) {
    const h = rd(f); assert.doesNotMatch(h, banned, f);
    for (const m of h.matchAll(/<a class="(?:btn(?: ghost| ghost-dark)?|pill)"[^>]*>([^<]+)/g)) {
      const label = m[1].trim();
      assert.ok(['Apply to work with Darren', 'Apply', 'How selection works', 'Back to LeadPipes', 'Read the FAQ', 'Go to the home page'].includes(label), `${f}: unexpected CTA label "${label}"`);
    }
  }
  const home = rd('index.html');
  assert.match(home, /class="pill" href="\/apply\.html">Apply/);
  assert.match(/<section class="hero">[\s\S]*?<\/section>/.exec(home)[0], /class="btn" href="\/apply\.html">Apply to work with Darren/);
});

test('forms: short essentials, optional extras, collection notice, hidden attribution and time-trap fields', () => {
  for (const f of pages.filter((p) => p.startsWith('lp/'))) {
    const form = /<form[\s\S]*?<\/form>/.exec(rd(f))[0];
    const above = form.split('<details')[0];
    for (const n of ['name', 'business', 'website', 'email', 'state', 'goal', 'phone']) assert.match(above, new RegExp(`name="${n}"`), `${f} ${n} above the fold`);
    assert.doesNotMatch(above, /name="(role|team_size|years_trading|marketing_spend|leads_wanted|sources|call_window)"/);
    assert.match(above, /name="phone"(?![^>]*required)/); // phone is optional
    assert.match(form, /Tell us more \(optional\)/); assert.match(form, /name="avg_sale"/);
    assert.match(form, /name="consent"[^>]*required/); assert.match(form, /Collection notice/); assert.match(form, /href="\/privacy\.html"/);
    assert.doesNotMatch(form, /do not sell or share your details/i);
    assert.match(form, /name="form_ts"/); assert.match(form, /name="bot-field"/);
    assert.match(form, /action="\/thanks\.html"/); assert.match(form, /data-error=/);
  }
  const ap = /<form[\s\S]*?<\/form>/.exec(rd('apply.html'))[0];
  assert.match(ap, /<form name="apply"/);
  // the commercial qualification: every one of these must be asked, and all but phone and close rate are required
  for (const n of ['name', 'role', 'business', 'website', 'email', 'goal', 'target_market', 'category', 'states', 'avg_sale', 'gross_margin', 'customer_value', 'sales_cycle', 'salespeople', 'conversion', 'response_speed', 'growth_goal', 'constraint', 'qualified_opportunity', 'why_you', 'monthly_budget', 'exclusive_ok', 'consent']) assert.match(ap, new RegExp(`name="${n}"`), `apply asks ${n}`);
  for (const n of ['avg_sale', 'gross_margin', 'customer_value', 'sales_cycle', 'monthly_budget', 'exclusive_ok', 'qualified_opportunity', 'why_you', 'target_market']) assert.match(ap, new RegExp(`name="${n}"[^>]*required`), `apply requires ${n}`);
  assert.match(ap, /name="phone"(?![^>]*required)/); assert.match(ap, /data-require-one/);
  assert.match(ap, /name="form_ts"/); assert.match(ap, /name="bot-field"/); assert.match(ap, /Collection notice/); assert.match(ap, /name="consent"[^>]*required/);
  assert.match(rd('apply.html'), /Selective by design\.[\s\S]*Exclusive by design\.[\s\S]*High-performance lead generation\./);
  assert.match(rd('lp/b2b-services/index.html'), /<form name="lp-enquiry"/);
});

test('track.js fills form_ts; the public site does not expose the Calendly link (booking is by invitation)', () => {
  assert.match(rd('assets/track.js'), /form_ts/); assert.match(rd('assets/track.js'), /form_elapsed/);
  for (const f of pages) assert.ok(!rd(f).includes('calendly.com/darrenharry2'), `${f} exposes the booking link`);
  assert.match(robotsOf(rd('book.html')), /^noindex/);
});

test('privacy policy: honest about sharing, named providers, fixed date, no draft/lawyer claim, placeholders only where unavoidable', () => {
  const h = rd('privacy.html'); const text = h.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /do not sell or share|draft|lawyer|reviewed/i);
  assert.match(text, /We do share lead and contact details with the client/);
  for (const n of ['Netlify', 'Google Workspace', 'Calendly', 'Railway', 'United States', 'Spam Act 2003', 'oaic.gov.au', 'enquiries@leadpipes.com.au']) assert.ok(text.includes(n), n);
  assert.match(text, /Last updated 16\/10\/2026/);
  assert.match(rd('src/pages/privacy.html'), /has not yet been reviewed by a lawyer/);
  assert.doesNotMatch(h, /has not yet been reviewed/);
  const site = JSON.parse(rd('data/site.json'));
  for (const f of pages) { if (f !== 'privacy.html') assert.doesNotMatch(rd(f), /class="ph"/, `${f} shows a placeholder`); }
  if (!site.retentionPeriod) assert.match(h, /\[retention period to be confirmed\]/);
});

test('build prints a warning listing outstanding placeholders and still succeeds', () => {
  const site = JSON.parse(rd('data/site.json'));
  const out = execFileSync('node', [path.join(ROOT, 'build.js')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /Built \d+ pages/);
  const r = require('node:child_process').spawnSync('node', [path.join(ROOT, 'build.js')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0);
  if (!site.abn || !site.entityName || !site.retentionPeriod) assert.match(r.stderr, /placeholder\(s\) outstanding/);
});

test('contrast: small text tokens reach 4.5:1 on their backgrounds', () => {
  const css = rd('assets/styles.css'); const v = (n) => new RegExp(`--${n}:(#[0-9a-f]{6})`, 'i').exec(css)[1];
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [['#9fb6c6', v('navy')], ['#9fb6c6', v('navy2')], ['#c3d0da', v('navy')], [v('muted'), '#ffffff'], [v('muted'), v('bg')], [v('teal-d'), v('bg')], [v('teal-d'), '#ffffff'], [v('teal'), v('navy')], ['#9fb6c6', '#04111c'], ['#8fa7b8', '#04111c'], ['#8fa7b8', v('navy')], [v('dim'), v('navy')], [v('gold'), v('navy')]];
  for (const [fg, bg] of pairs) assert.ok(ratio(fg, bg) >= 4.5, `${fg} on ${bg} is ${ratio(fg, bg).toFixed(2)}`);
  assert.match(css, /\.dark \.small-print[^{]*\{[^}]*color:#9fb6c6/);
});
