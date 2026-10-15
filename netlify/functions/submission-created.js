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

const clean = (v, max = 300) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

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
    data.goal && `Goal: ${clean(data.goal, 600)}`,
  ].filter(Boolean).join(' | ');
  return {
    email: clean(data.email, 200).toLowerCase(),
    first_name, last_name,
    company: clean(data.business, 200),
    phone: clean(data.phone, 40),
    website: clean(data.website, 200),
    state: clean(data.state, 20),
    vertical: clean(data.category, 100),
    title: `Website enquiry: ${clean(data.business, 120) || clean(data.name, 120)}`,
    message,
    source: `Website form: ${page}`,
    attribution,
  };
}

exports.buildPayload = buildPayload;

exports.handler = async (event) => {
  let submission;
  try { submission = JSON.parse(event.body || '{}').payload || {}; } catch (e) { return { statusCode: 400, body: 'Bad payload' }; }
  const formName = submission.form_name || (submission.data && submission.data['form-name']);
  if (!FORMS.has(formName)) return { statusCode: 200, body: 'Ignored form' };

  const base = (process.env.LEADDRIVE_URL || '').replace(/\/+$/, '');
  const key = process.env.LEADDRIVE_API_KEY || '';
  if (!base || !key) { console.log('LeadDrive not configured; submission kept in Netlify Forms only.'); return { statusCode: 200, body: 'LeadDrive not configured' }; }

  const data = submission.data || {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean(data.email, 200))) { console.log('Submission has no valid email; not forwarded.'); return { statusCode: 200, body: 'No valid email' }; }

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
