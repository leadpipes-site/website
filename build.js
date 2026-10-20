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
const applyFormFull = `<form name="apply" method="POST" action="/thanks.html" data-netlify="true" netlify-honeypot="bot-field" data-lead-form class="apply-form">\n${fill(hidden, { formName: 'apply' })}      <fieldset class="sec"><legend><b>01</b>You and your business</legend>
        <p class="sec-intro">Who I would be speaking to.</p>
        <div class="f2"><label>Your name<input name="name" required autocomplete="name" data-error="Enter your name so we know who to speak to."></label>
        <label>Your role<select name="role" required data-error="Choose your role."><option value="">Choose one</option><option>Owner or director</option><option>Sales or business development</option><option>General manager</option><option>Marketing</option><option>Other</option></select></label></div>
        <div class="f2"><label>Business name<input name="business" required autocomplete="organization" data-error="Enter the name of your business."></label>
        <label>Website<input type="text" inputmode="url" name="website" required placeholder="yourbusiness.com.au" autocomplete="url" data-error="Enter your website address."></label></div>
        <div class="f2"><label>Work email<input type="email" name="email" required autocomplete="email" data-error="Enter an email address we can reply to, for example name@yourbusiness.com.au."></label>
        <label>Phone (optional)<input type="tel" name="phone" autocomplete="tel"></label></div>
      </fieldset>
      <fieldset class="sec"><legend><b>02</b>Your offer and your market</legend>
        <p class="sec-intro">What you sell, who buys it, and where.</p>
        <label>Core product or service<textarea name="goal" maxlength="600" required data-error="Tell us what you sell." placeholder="What you sell, in plain words."></textarea></label>
        <label>Primary target market<textarea name="target_market" maxlength="600" required data-error="Tell us who your best customers are." placeholder="Who buys, what size, what industry, who decides."></textarea></label>
        <div class="f2"><label>Business category<select name="category" required data-error="Choose the category that best describes your business."><option value="">Choose one</option>${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label></div>
        <fieldset class="checks" data-require-one="states" data-error="Choose at least one state or territory, or National."><legend>States and territories you want to win in <span class="req">(tick all that apply)</span></legend>
          <div class="check-grid"><label class="check"><input type="checkbox" name="states" value="WA"><span>WA</span></label><label class="check"><input type="checkbox" name="states" value="NSW"><span>NSW</span></label><label class="check"><input type="checkbox" name="states" value="VIC"><span>VIC</span></label><label class="check"><input type="checkbox" name="states" value="QLD"><span>QLD</span></label><label class="check"><input type="checkbox" name="states" value="SA"><span>SA</span></label><label class="check"><input type="checkbox" name="states" value="TAS"><span>TAS</span></label><label class="check"><input type="checkbox" name="states" value="NT"><span>NT</span></label><label class="check"><input type="checkbox" name="states" value="ACT"><span>ACT</span></label><label class="check"><input type="checkbox" name="states" value="National"><span>National</span></label></div>
        </fieldset>
      </fieldset>
      <fieldset class="sec"><legend><b>03</b>The commercial numbers</legend>
        <p class="sec-intro">This is how I judge whether the economics can support a real partnership. Approximate is fine.</p>
        <div class="f2"><label>Typical sale value (AUD)<select name="avg_sale" required data-error="Choose the typical value of a sale."><option value="">Choose one</option><option>Under \$5,000</option><option>\$5,000 to \$10,000</option><option>\$10,000 to \$30,000</option><option>\$30,000 to \$100,000</option><option>\$100,000 to \$500,000</option><option>Over \$500,000</option></select></label><label>Approximate gross margin<select name="gross_margin" required data-error="Choose your approximate gross margin."><option value="">Choose one</option><option>Under 20%</option><option>20% to 30%</option><option>30% to 40%</option><option>40% to 60%</option><option>Over 60%</option></select></label></div>
        <div class="f2"><label>Estimated customer lifetime value (AUD)<select name="customer_value" required data-error="Choose the estimated lifetime value of a customer."><option value="">Choose one</option><option>Under \$10,000</option><option>\$10,000 to \$30,000</option><option>\$30,000 to \$100,000</option><option>\$100,000 to \$500,000</option><option>Over \$500,000</option></select></label><label>Typical sales cycle<select name="sales_cycle" required data-error="Choose your typical sales cycle."><option value="">Choose one</option><option>Under 2 weeks</option><option>2 to 4 weeks</option><option>1 to 3 months</option><option>3 to 6 months</option><option>Over 6 months</option></select></label></div>
      </fieldset>
      <fieldset class="sec"><legend><b>04</b>Your sales engine and growth</legend>
        <p class="sec-intro">How you convert, and where you are heading.</p>
        <div class="f2"><label>Salespeople today<select name="salespeople" required data-error="Choose how many people sell."><option value="">Choose one</option><option>Only the owner sells</option><option>1</option><option>2 to 3</option><option>4 to 10</option><option>More than 10</option></select></label><label>Quote to close rate, if known<select name="conversion" required data-error="Choose your close rate, or Not sure yet."><option value="">Choose one</option><option>Not sure yet</option><option>Under 10%</option><option>10% to 20%</option><option>20% to 30%</option><option>30% to 50%</option><option>Over 50%</option></select></label></div>
        <label>How fast does your team respond to a new enquiry?<select name="response_speed" required data-error="Choose how fast you respond."><option value="">Choose one</option><option>Within 5 minutes</option><option>Within an hour</option><option>Same business day</option><option>Next business day or later</option></select></label>
        <label>Annual growth objective<textarea name="growth_goal" maxlength="400" required data-error="Tell us your growth objective." placeholder="For example: grow revenue from \$2.5m to \$4m in 12 months."></textarea></label>
        <label>Biggest constraint to growth today<textarea name="constraint" maxlength="400" required data-error="Tell us your biggest constraint." placeholder="What is actually holding you back?"></textarea></label>
      </fieldset>
      <fieldset class="sec"><legend><b>05</b>Fit and commitment</legend>
        <p class="sec-intro">What a good opportunity looks like to you, and what you are prepared to invest.</p>
        <label>What is a qualified opportunity to you?<textarea name="qualified_opportunity" maxlength="600" required data-error="Tell us what a qualified opportunity is to you." placeholder="Who they are, what they need, what they must have before you will spend time on them."></textarea></label>
        <label>Why do you believe your value proposition wins?<textarea name="why_you" maxlength="600" required data-error="Tell us why customers choose you." placeholder="Why do customers choose you over the alternatives?"></textarea></label>
        <div class="f2"><label>Monthly amount you are prepared to invest in creating new business (AUD)<select name="monthly_budget" required data-error="Choose an approximate monthly investment."><option value="">Choose one</option><option>Under \$2,000</option><option>\$2,000 to \$4,000</option><option>\$4,000 to \$7,500</option><option>\$7,500 to \$15,000</option><option>Over \$15,000</option></select></label><label>Exclusive 6 to 12 month partnership, if the economics make sense?<select name="exclusive_ok" required data-error="Choose one."><option value="">Choose one</option><option>Yes, if the economics make sense</option><option>Possibly, I need to understand more first</option><option>No, I want something shorter or non-exclusive</option></select></label></div>
      </fieldset>
      <label class="check"><input type="checkbox" name="consent" required data-error="Please tick the box so we can contact you about this application."><span>I agree that LeadPipes may contact me by email, phone or SMS about this application and a possible conversation. I can opt out at any time. See the <a href="/privacy.html">privacy policy</a>.</span></label>\n      <button class="btn" type="submit">${esc(CTA_APPLY)}</button>\n      <p class="small-print">Collection notice: LeadPipes collects these details to assess whether we can work together and to respond to you. We do not sell them or pass them to other clients. We use service providers to host and store them, and some may process data outside Australia. How we handle personal information, and how to ask for access, correction or removal: <a href="/privacy.html">privacy policy</a>.</p>\n    </form>`;
page({
  file: 'apply.html', title: 'Apply to Work with Darren | LeadPipes',
  description: 'Fewer partners. Better opportunities. Deeper partnerships. Tell Darren about your market, margins and what a customer is worth. He reads every application and replies personally within 3 business days.', canonicalPath: '/apply.html',
  content: `<section class="dark apply-hero">\n  <div class="wrap">\n    <p class="eyebrow">Apply to work with Darren</p>\n    <h1>Not everyone qualifies. <span class="accent">That is the point.</span></h1>\n    <p class="model-line">Fewer partners.<br>Better opportunities.<br><span class="accent">Deeper partnerships.</span></p>\n    <p class="lead">This is a two-way assessment. I work with a handful of partners and I decide who, so the work is worth doing for both of us. I read every application myself. If your business looks like a fit and your category and state are open, I will reply with a private link to book a thirty minute conversation. If it is not, I will tell you plainly. You will hear from me within 3 business days either way.</p>\n    <blockquote class="sport-line">High performance does not come from doing more. It comes from doing the right things exceptionally well, repeatedly.</blockquote>\n    <div class="assure"><span>One category</span><span>One state</span><span>One partner</span></div>\n  </div>\n</section>\n<section class="on-light apply-body">\n  <div class="wrap">\n    <div class="form-card wide-form">\n      <h2 class="form-title">Tell me about your business.</h2>\n      <p class="sub">About six minutes. Sixteen questions, in five short parts.</p>\n      <p class="why-box"><b>Why so many commercial questions?</b> Because I can only create real value for a business that knows its market, its margins and what a customer is worth. Approximate answers are fine. If these are hard to answer today, we are probably not ready to work together yet, and that is useful to know on both sides.</p>\n      ${applyFormFull}\n    </div>\n  </div>\n</section>`,
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
