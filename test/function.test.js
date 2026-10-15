'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fn = require('../netlify/functions/submission-created.js');

const submission = (data, formName = 'lp-enquiry') => ({ body: JSON.stringify({ payload: { form_name: formName, data: { 'form-name': formName, ...data } } }) });
const sample = {
  name: 'Pat  Citizen-Smith', business: 'Fitouts Pty Ltd', email: 'Pat@Fitouts.com.au', phone: '0400 000 000', website: 'fitouts.com.au', state: 'WA',
  category: 'Commercial fit-out and construction', avg_sale: '$30,000 to $100,000', goal: 'Two more projects a quarter',
  utm_source: 'linkedin', utm_medium: 'paid', utm_campaign: 'fitout-oct', utm_content: '', gclid: '', referrer: 'linkedin.com', landing_page: '/lp/commercial-fitout-construction/', first_touch_at: '2026-10-16T01:00:00.000Z',
};

function mock(status = 201) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; });
    req.on('end', () => { seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: JSON.parse(b || '{}') }); res.writeHead(status, { 'content-type': 'application/json' }); res.end('{}'); });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ seen, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) })));
}
const withEnv = async (env, f) => { const old = { u: process.env.LEADDRIVE_URL, k: process.env.LEADDRIVE_API_KEY }; Object.assign(process.env, env); try { return await f(); } finally { for (const [k, v] of [['LEADDRIVE_URL', old.u], ['LEADDRIVE_API_KEY', old.k]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } } };

test('buildPayload maps the form to the LeadDrive enquiry shape', () => {
  const p = fn.buildPayload(sample, 'lp-enquiry');
  assert.equal(p.email, 'pat@fitouts.com.au');
  assert.equal(p.first_name, 'Pat'); assert.equal(p.last_name, 'Citizen-Smith');
  assert.equal(p.company, 'Fitouts Pty Ltd'); assert.equal(p.vertical, 'Commercial fit-out and construction'); assert.equal(p.state, 'WA');
  assert.equal(p.source, 'Website form: /lp/commercial-fitout-construction/');
  assert.match(p.message, /Avg sale: \$30,000 to \$100,000/); assert.match(p.message, /Goal: Two more projects/);
  assert.equal(p.attribution.utm_campaign, 'fitout-oct'); assert.equal(p.attribution.form, 'lp-enquiry');
  assert.equal(p.attribution.utm_content, undefined); // empty values are not sent
});

test('forwards to LeadDrive with the bearer key', async () => {
  const m = await mock();
  await withEnv({ LEADDRIVE_URL: m.url + '/', LEADDRIVE_API_KEY: 'ldk_test' }, async () => {
    const r = await fn.handler(submission(sample));
    assert.equal(r.statusCode, 200);
  });
  assert.equal(m.seen.length, 1); assert.equal(m.seen[0].url, '/api/hooks/enquiry'); assert.equal(m.seen[0].auth, 'Bearer ldk_test');
  assert.equal(m.seen[0].body.email, 'pat@fitouts.com.au');
  await m.close();
});

test('does nothing when LeadDrive is not configured, ignores other forms, rejects bad email', async () => {
  const m = await mock();
  await withEnv({ LEADDRIVE_URL: '', LEADDRIVE_API_KEY: '' }, async () => { assert.equal((await fn.handler(submission(sample))).statusCode, 200); });
  await withEnv({ LEADDRIVE_URL: m.url, LEADDRIVE_API_KEY: 'k' }, async () => {
    assert.equal((await fn.handler(submission(sample, 'some-other-form'))).body, 'Ignored form');
    assert.equal((await fn.handler(submission({ ...sample, email: 'not-an-email' }))).body, 'No valid email');
    assert.equal((await fn.handler({ body: 'not json' })).statusCode, 400);
  });
  assert.equal(m.seen.length, 0);
  await m.close();
});

test('reports a failure (502) when LeadDrive rejects or is down', async () => {
  const m = await mock(500);
  await withEnv({ LEADDRIVE_URL: m.url, LEADDRIVE_API_KEY: 'k' }, async () => { assert.equal((await fn.handler(submission(sample))).statusCode, 502); });
  await m.close();
  await withEnv({ LEADDRIVE_URL: 'http://127.0.0.1:9', LEADDRIVE_API_KEY: 'k' }, async () => { assert.equal((await fn.handler(submission(sample))).statusCode, 502); });
});
