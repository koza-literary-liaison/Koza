/* ==========================================================
   KOZA LITERARY LIAISON — form delivery
   ------------------------------------------------------------
   One module, used by every form on the site.

   1. If a Formspree id is set in site-config.js, the form is
      POSTed straight to Formspree and lands in your inbox.
   2. If Formspree is unreachable for any reason, it falls back
      to opening the visitor's mail app with every field
      pre-filled and addressed to you.
   3. A hidden honeypot field quietly discards bot submissions.

   Either way a real enquiry always reaches the studio.
   ========================================================== */
(function () {
  'use strict';

  function cfg() { return window.KOZA || {}; }

  function endpoint() {
    var id = (cfg().formspreeId || '').trim();
    return id ? 'https://formspree.io/f/' + id : '';
  }

  function subject(form) {
    return form.getAttribute('data-subject') || 'New enquiry from the KOZA website';
  }

  /* Read every enabled field into a plain object. Arrays are
     flattened into a comma separated list so checkbox groups
     (interests, contact preference) read cleanly in an inbox. */
  function collect(form) {
    var out = {};
    var fd = new FormData(form);

    fd.forEach(function (value, key) {
      if (key === '_gotcha') return;
      if (key.charAt(0) === '_') return;
      if (out[key] === undefined) {
        out[key] = value;
      } else if (Array.isArray(out[key])) {
        out[key].push(value);
      } else {
        out[key] = [out[key], value];
      }
    });

    /* A select stores a numeric value but the reader wants the
       words the visitor actually saw, so swap in the option text. */
    form.querySelectorAll('select').forEach(function (sel) {
      var opt = sel.options[sel.selectedIndex];
      if (!opt) return;
      var text = (opt.textContent || '').trim();
      if (text) out[sel.name] = text;
    });

    Object.keys(out).forEach(function (key) {
      if (Array.isArray(out[key])) out[key] = out[key].join(', ');
    });

    return out;
  }

  function label(key) {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); })
      .replace(/\bId\b/g, 'ID');
  }

  function readable(data) {
    var lines = [];
    Object.keys(data).forEach(function (key) {
      var value = data[key];
      if (value === '' || value == null) return;
      lines.push(label(key) + ': ' + value);
    });
    return lines.join('\n');
  }

  /* --------------------------------------------------- bot trap */
  function isBot(form) {
    var trap = form.querySelector('input[name="_gotcha"]');
    return !!(trap && trap.value);
  }

  /* ------------------------------------------------ mail fallback */
  function mailtoFallback(form, data) {
    var to = (cfg().email || '').trim();
    var href = 'mailto:' + to +
      '?subject=' + encodeURIComponent(subject(form)) +
      '&body=' + encodeURIComponent(readable(data));

    /* Recorded on the form so the fallback can be verified in
       testing and inspected if something ever goes wrong. */
    form.setAttribute('data-mailto', href);

    window.location.href = href;
    return href;
  }

  /* ------------------------------------------------------- send */
  function send(form) {
    var data = collect(form);

    if (isBot(form)) {
      return Promise.resolve({ ok: true, mode: 'blocked' });
    }

    var url = endpoint();

    /* No form service configured — go straight to the mail app. */
    if (!url) {
      try {
        mailtoFallback(form, data);
        return Promise.resolve({ ok: true, mode: 'mailto' });
      } catch (e) {
        return Promise.resolve({ ok: false, mode: 'mailto', error: String(e) });
      }
    }

    var payload = {};
    Object.keys(data).forEach(function (k) { payload[k] = data[k]; });
    payload._subject = subject(form);

    return fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return { ok: true, mode: 'post' };
      })
      .catch(function (err) {
        /* The service is down or blocked — never lose the lead. */
        try { mailtoFallback(form, data); } catch (e) { /* noop */ }
        return { ok: true, mode: 'mailto-fallback', error: String(err) };
      });
  }

  window.KOZAForms = {
    send: send,
    collect: collect,
    readable: readable,
    endpoint: endpoint,
    email: function () { return (cfg().email || ''); }
  };
})();
