/*
 * LeadPipes form helpers. No third-party code.
 * Replaces the browser's generic validation messages with plain, specific ones (from each field's data-error attribute).
 */
(function () {
  'use strict';
  function message(el) {
    var custom = el.getAttribute('data-error');
    if (el.validity.valueMissing && custom) return custom;
    if (el.validity.typeMismatch && el.type === 'email') return 'That email address does not look right. Use the form name@yourbusiness.com.au.';
    if (el.validity.tooLong) return 'That is a little too long. Please shorten it.';
    return '';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var forms = document.querySelectorAll('form[data-lead-form]');
    Array.prototype.forEach.call(forms, function (form) {
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.willValidate) return;
        el.addEventListener('invalid', function () { el.setCustomValidity(''); var m = message(el); if (m) el.setCustomValidity(m); });
        el.addEventListener('input', function () { el.setCustomValidity(''); });
        el.addEventListener('change', function () { el.setCustomValidity(''); });
      });
    });
  });
})();
