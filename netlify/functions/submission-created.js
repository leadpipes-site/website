'use strict';
/*
 * Netlify runs this automatically after every verified form submission (the name "submission-created" is the trigger).
 * It forwards the enquiry to LeadDrive so it becomes a lead with its source recorded.
 *
 * Environment variables (set in Netlify, never in this repo):
 *   LEADDRIVE_URL      e.g. https://crm.leadpipes.com.au   (no trailing slash needed)
 *   LEADDRIVE_API_KEY  a LeadDrive API key with scope "write"
 *
 * If either is missing the function does nothing, and the submission is still kept in Netlify Forms.
 * Personal details are never written to the function log.
 */

const FORMS = new Set(['apply', 'lp-enquiry']);
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'msclkid', 'referrer', 'landing_page', 'first_touch_at'];

// Spam checks (no third-party services). A rejected submission is still kept in Netlify Forms; it is only not forwarded to LeadDrive.
const MIN_FILL_MS = 2000; // a person cannot read and complete a form this fast, even with autofill
const URL_RE = /(?:https?:\/\/|www\.)/gi;
const FREE_TEXT = ['success_12m', 'goal', 'name', 'business', 'target_market', 'why_you', 'qualified_opportunity'];

const clean = (v, max = 300) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** True for an address that is plausibly real: one @, a dotted domain with an alphabetic TLD, no spaces or dot abuse. */
function validEmail(raw) {
  const e = clean(raw, 300);
  if (e.length < 6 || e.length > 254 || e !== String(raw).trim()) return false;
  const m = /^([^@\s]+)@([^@\s]+)$/.exec(e);
  if (!m) return false;
  const [, local, domain] = m;
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((l) => !l || l.length > 63 || !/^[a-z0-9-]+$/i.test(l) || l.startsWith('-') || l.endsWith('-'))) return false;
  return /^[a-z]{2,24}$/i.test(labels[labels.length - 1]);
}

/**
 * Returns a short reason code if the submission looks like spam, else ''. Reason codes only: never personal data.
 *  - honeypot: the hidden bot-field was filled in
 *  - too_fast: the form was open for less than MIN_FILL_MS (form_elapsed from the browser, else form_ts against the
 *    server's created_at; negative gaps are ignored so a wrong clock on the visitor's device never blocks a real person)
 *  - bad_ts: a time field is present but is not a number
 *  - many_urls: two or more links in a free-text field
 */
function spamReason(data, createdAt) {
  if (clean(data['bot-field'], 50)) return 'honeypot';
  const elapsedRaw = clean(data.form_elapsed, 20);
  const tsRaw = clean(data.form_ts, 20);
  if (elapsedRaw || tsRaw) {
    if ((elapsedRaw && !/^\d{1,12}$/.test(elapsedRaw)) || (tsRaw && !/^\d{10,14}$/.test(tsRaw))) return 'bad_ts';
    let ms = null;
    if (elapsedRaw) ms = Number(elapsedRaw);
    else {
      const created = Date.parse(createdAt || '') || Date.now();
      ms = created - Number(tsRaw);
    }
    if (ms >= 0 && ms < MIN_FILL_MS) return 'too_fast';
  }
  for (const k of FREE_TEXT) if ((String(data[k] == null ? '' : data[k]).match(URL_RE) || []).length >= 2) return 'many_urls';
  return '';
}

function splitName(full) {
  const parts = clean(full, 200).split(' ').filter(Boolean);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

/** Turn a Netlify form submission into the body LeadDrive's /api/hooks/enquiry expects. */
function buildPayload(data, formName) {
  const { first_name, last_name } = splitName(data.name);
  const attribution = { form: clean(formName, 40) };
  for (const k of ATTRIBUTION_KEYS) { const v = clean(data[k], 200); if (v) attribution[k] = v; }
  const page = attribution.landing_page || '/';
  const message = [
    data.category && `Category: ${clean(data.category, 80)}`,
    data.avg_sale && `Avg sale: ${clean(data.avg_sale, 40)}`,
    data.website && `Website: ${clean(data.website, 100)}`,
    data.role && `Role: ${clean(data.role, 60)}`,
    data.team_size && `Team: ${clean(data.team_size, 40)}`,
    data.years_trading && `Years trading: ${clean(data.years_trading, 40)}`,
    data.marketing_spend && `Marketing spend: ${clean(data.marketing_spend, 40)}`,
    data.leads_wanted && `Wants per month: ${clean(data.leads_wanted, 40)}`,
    data.sources && `Current sources: ${clean(Array.isArray(data.sources) ? data.sources.join(', ') : data.sources, 200)}`,
    data.call_window && `Call window: ${clean(data.call_window, 40)}`,
    data.goal && `Goal: ${clean(data.goal, 600)}`,
    data.target_market && `Target market: ${clean(data.target_market, 600)}`,
    data.states && `States: ${clean(Array.isArray(data.states) ? data.states.join(', ') : data.states, 80)}`,
    data.gross_margin && `Gross margin: ${clean(data.gross_margin, 40)}`,
    data.customer_value && `Customer lifetime value: ${clean(data.customer_value, 40)}`,
    data.sales_cycle && `Sales cycle: ${clean(data.sales_cycle, 40)}`,
    data.salespeople && `Salespeople: ${clean(data.salespeople, 40)}`,
    data.conversion && `Close rate: ${clean(data.conversion, 40)}`,
    data.response_speed && `Response speed: ${clean(data.response_speed, 40)}`,
    data.growth_goal && `Growth objective: ${clean(data.growth_goal, 400)}`,
    data.constraint && `Constraint: ${clean(data.constraint, 400)}`,
    data.qualified_opportunity && `Qualified opportunity: ${clean(data.qualified_opportunity, 600)}`,
    data.why_you && `Why we win: ${clean(data.why_you, 600)}`,
    data.success_12m && `12-month success: ${clean(data.success_12m, 600)}`,
    data.followup_owner && `Follow-up owner: ${clean(data.followup_owner, 120)}`,
    data.monthly_budget && `Monthly budget: ${clean(data.monthly_budget, 40)}`,
    data.exclusive_ok && `Exclusive 6-12 months: ${clean(data.exclusive_ok, 60)}`,
  ].filter(Boolean).join(' | ');
  // The apply form carries the full commercial qualification. Send it as a structured record so LeadDrive stores and shows every answer.
  const APP_KEYS = ['website', 'role', 'goal', 'target_market', 'category', 'states', 'avg_sale', 'gross_margin', 'customer_value', 'sales_cycle', 'salespeople', 'conversion', 'response_speed', 'growth_goal', 'constraint', 'qualified_opportunity', 'why_you', 'monthly_budget', 'exclusive_ok'];
  let application;
  if (data.target_market || data.exclusive_ok || data.gross_margin) {
    application = { business_name: clean(data.business, 200) };
    for (const k of APP_KEYS) { const v = Array.isArray(data[k]) ? data[k].join(', ') : data[k]; if (v) application[k] = clean(v, 800); }
  }
  return {
    email: clean(data.email, 200).toLowerCase(),
    first_name, last_name,
    company: clean(data.business, 200),
    role: clean(data.role, 60),
    phone: clean(data.phone, 40),
    website: clean(data.website, 200),
    state: clean(Array.isArray(data.states) ? data.states.join(', ') : (data.states || data.state), 40),
    vertical: clean(data.category, 100),
    title: `Website enquiry: ${clean(data.business, 120) || clean(data.name, 120)}`,
    message: application ? `Partner application: ${clean(data.goal, 300)}` : message,
    application,
    source: `Website form: ${page}`,
    attribution,
  };
}

exports.buildPayload = buildPayload;
exports.validEmail = validEmail;
exports.spamReason = spamReason;

exports.handler = async (event) => {
  let submission;
  try { submission = JSON.parse(event.body || '{}').payload || {}; } catch (e) { return { statusCode: 400, body: 'Bad payload' }; }
  const formName = submission.form_name || (submission.data && submission.data['form-name']);
  if (!FORMS.has(formName)) return { statusCode: 200, body: 'Ignored form' };

  const base = (process.env.LEADDRIVE_URL || '').replace(/\/+$/, '');
  const key = process.env.LEADDRIVE_API_KEY || '';
  if (!base || !key) { console.log('LeadDrive not configured; submission kept in Netlify Forms only.'); return { statusCode: 200, body: 'LeadDrive not configured' }; }

  const data = submission.data || {};
  if (!validEmail(data.email)) { console.log('Submission has no valid email; not forwarded.'); return { statusCode: 200, body: 'No valid email' }; }
  const spam = spamReason(data, submission.created_at);
  if (spam) { console.log(`Submission looks like spam (${spam}); not forwarded.`); return { statusCode: 200, body: 'Ignored (spam check)' }; }

  try {
    const res = await fetch(`${base}/api/hooks/enquiry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(buildPayload(data, formName)),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error(`LeadDrive rejected the enquiry: HTTP ${res.status} (form ${formName})`); return { statusCode: 502, body: `LeadDrive HTTP ${res.status}` }; }
    return { statusCode: 200, body: 'Forwarded' };
  } catch (e) {
    console.error(`Could not reach LeadDrive: ${e.name}`);
    return { statusCode: 502, body: 'LeadDrive unreachable' };
  }
};
