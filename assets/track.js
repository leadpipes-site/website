/*
 * LeadPipes first-party lead attribution. No third-party scripts, no cookies.
 *
 * What it does: when someone arrives with UTM tags or an ad click id (gclid, fbclid, msclkid), it remembers
 * them for the visit (sessionStorage) and remembers the very first visit (localStorage), then writes them into
 * the hidden fields of any enquiry form on the page. LeadDrive stores them on the lead, so every enquiry can
 * be traced to a channel, campaign and landing page.
 *
 * Rule for which touch is used: tags on this visit, else tags from this browsing session, else the first
 * recorded visit. Nothing personal is stored until the person submits a form.
 */
(function () {
  'use strict';
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'msclkid'];

  function read(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch (e) { return null; } }
  function write(store, key, value) { try { store.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: attribution falls back to this page view only */ } }
  function clip(v) { return String(v || '').slice(0, 200); }

  function externalReferrer() {
    try {
      if (!document.referrer) return '';
      var u = new URL(document.referrer);
      return u.hostname === location.hostname ? '' : u.hostname;
    } catch (e) { return ''; }
  }

  var params = new URLSearchParams(location.search);
  var current = {};
  KEYS.forEach(function (k) { var v = params.get(k); if (v) current[k] = clip(v); });
  var hasTags = Object.keys(current).length > 0;

  var session = read(window.sessionStorage, 'lp_touch');
  var first = read(window.localStorage, 'lp_first');

  if (hasTags) {
    session = current;
    session.landing_page = location.pathname;
    var ref = externalReferrer(); if (ref) session.referrer = ref;
    write(window.sessionStorage, 'lp_touch', session);
  } else if (!session) {
    session = { landing_page: location.pathname };
    var r = externalReferrer(); if (r) session.referrer = r;
    write(window.sessionStorage, 'lp_touch', session);
  }

  if (!first) {
    first = {}; Object.keys(session).forEach(function (k) { first[k] = session[k]; });
    first.first_touch_at = new Date().toISOString();
    write(window.localStorage, 'lp_first', first);
  }

  // Choose the touch to report.
  var hasSessionTags = KEYS.some(function (k) { return session && session[k]; });
  var firstHasTags = KEYS.some(function (k) { return first && first[k]; });
  var chosen = hasSessionTags || !firstHasTags ? session : first;

  function fill(form) {
    var values = {};
    KEYS.forEach(function (k) { values[k] = chosen[k] || ''; });
    values.referrer = chosen.referrer || '';
    values.first_touch_at = (first && first.first_touch_at) || '';
    // landing_page is the page the form is on: the page that actually produced the enquiry.
    values.landing_page = location.pathname;
    Object.keys(values).forEach(function (name) {
      var el = form.elements[name];
      if (el) el.value = values[name];
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('form[data-lead-form]');
    Array.prototype.forEach.call(forms, function (form) {
      fill(form);
      form.addEventListener('submit', function () {
        fill(form);
        var btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
      });
    });
    // Keep tags on internal links so the apply page still knows where the visitor came from (same-visit storage already does this; links are a fallback for blocked storage).
    if (hasTags) {
      Array.prototype.forEach.call(document.querySelectorAll('a[href^="/apply"]'), function (a) {
        var url = new URL(a.getAttribute('href'), location.origin);
        KEYS.forEach(function (k) { if (current[k] && !url.searchParams.get(k)) url.searchParams.set(k, current[k]); });
        a.setAttribute('href', url.pathname + url.search);
      });
    }
  });
})();
