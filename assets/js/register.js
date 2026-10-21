/* ==========================================================
   KOZA LITERARY LIAISON — author registration
   Confirms readiness to move forward. No payment, no pricing.
   ========================================================== */
(function () {
  'use strict';

  var form = document.getElementById('regForm');
  if (!form) return;

  var stepEls    = form.querySelectorAll('.step[data-step]');
  var stepperEls = document.querySelectorAll('.stepper__item');
  var nextBtn    = document.getElementById('nextBtn');
  var backBtn    = document.getElementById('backBtn');
  var stepNav    = document.getElementById('stepNav');
  var processing = document.getElementById('processing');
  var successEl  = document.getElementById('success');
  var regTitle   = document.getElementById('regTitle');
  var regSub     = document.getElementById('regSub');

  var current = 1;
  var LAST    = 2;

  /* ------------------------------------------------------ validation */
  function setError(input, msg) {
    var field = input.closest('.field');
    if (!field) return false;
    field.classList.add('has-error');
    var err = field.querySelector('.field__error');
    if (err && msg) err.textContent = msg;
    return false;
  }
  function clearError(input) {
    var field = input.closest('.field');
    if (field) field.classList.remove('has-error');
    return true;
  }

  /* Single source of truth for field rules — used both when a step is
     submitted and live as the author types, so errors clear the moment
     a field becomes valid. */
  function check(el, cond, msg) {
    if (cond) return clearError(el);
    return setError(el, msg);
  }

  var RULES = {
    'r-first':   function (el) { return check(el, (el.value || '').trim(), 'Please enter your first name.'); },
    'r-last':    function (el) { return check(el, (el.value || '').trim(), 'Please enter your last name.'); },
    'r-email':   function (el) {
      return check(el, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((el.value || '').trim()), 'Please enter a valid email address.');
    },
    'b-title':   function (el) { return check(el, (el.value || '').trim(), 'Please enter your book title.'); },
    'b-genre':   function (el) { return check(el, (el.value || '').trim(), 'Please choose a genre.'); },
    'b-date':    function (el) { return check(el, (el.value || '').trim(), 'Please enter your publication date.'); },
    'b-run':     function (el) { return check(el, (el.value || '').trim(), 'Please select a print run.'); },
    'b-imprint': function (el) { return check(el, (el.value || '').trim(), 'Please enter your publisher or imprint.'); },
    'b-addr':    function (el) { return check(el, (el.value || '').trim(), 'Please enter your address.'); },
    'b-city':    function (el) { return check(el, (el.value || '').trim(), 'Please enter your city.'); }
  };

  /* Live validation — only fires once a field has already been flagged,
     so the author isn't scolded while they're still typing. */
  var touched = {};
  Object.keys(RULES).forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () {
      if (!touched[id]) return;
      RULES[id](el);
    });
    el.addEventListener('blur', function () {
      if ((el.value || '').trim() === '' && !touched[id]) return;
      touched[id] = true;
      RULES[id](el);
    });
  });

  var termsBox = form.querySelector('input[name="terms"]');
  if (termsBox) {
    termsBox.addEventListener('change', function () {
      var terr = termsBox.closest('.checkline').querySelector('.field__error');
      terr.style.display = termsBox.checked ? 'none' : 'block';
    });
  }

  function validateStep(n) {
    var step = form.querySelector('.step[data-step="' + n + '"]');
    var ok = true, firstBad = null;

    Object.keys(RULES).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !step.contains(el)) return;
      touched[id] = true;
      if (RULES[id](el) !== true) { ok = false; if (!firstBad) firstBad = el; }
    });

    if (n === 1 && termsBox) {
      var terr = termsBox.closest('.checkline').querySelector('.field__error');
      if (!termsBox.checked) {
        ok = false; terr.style.display = 'block';
        if (!firstBad) firstBad = termsBox;
      } else {
        terr.style.display = 'none';
      }
    }

    if (!ok && firstBad) {
      firstBad.focus();
      if (firstBad.scrollIntoView) firstBad.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return ok;
  }

  /* --------------------------------------------------- step movement */
  var STEP_META = {
    1: { t: 'Tell Us Who You Are', s: 'Takes about two minutes. Nothing is charged and nothing is locked in.' },
    2: { t: 'Tell Us About Your Book', s: 'This is what your strategist uses to build the plan before the kickoff call.' }
  };

  function goTo(n) {
    current = n;
    stepEls.forEach(function (el) {
      el.classList.toggle('is-active', parseInt(el.getAttribute('data-step'), 10) === n);
    });
    stepperEls.forEach(function (el) {
      var s = parseInt(el.getAttribute('data-step'), 10);
      el.classList.toggle('is-active', s === n);
      el.classList.toggle('is-done', s < n);
      var num = el.querySelector('.stepper__num');
      if (s < n) {
        num.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      } else {
        num.textContent = s;
      }
    });

    regTitle.textContent = STEP_META[n].t;
    regSub.textContent   = STEP_META[n].s;

    backBtn.style.visibility = n === 1 ? 'hidden' : 'visible';
    nextBtn.innerHTML = n === LAST
      ? 'Confirm My Registration <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      : 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    var top = form.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }

  nextBtn.addEventListener('click', function () {
    if (!validateStep(current)) return;
    if (current < LAST) { goTo(current + 1); return; }
    submit();
  });

  backBtn.addEventListener('click', function () {
    if (current > 1) goTo(current - 1);
  });

  /* --------------------------------------------------------- submit */
  function refCode() {
    return 'KOZA-' + Math.floor(Math.random() * 900000 + 100000);
  }

  function interests() {
    var picked = [];
    form.querySelectorAll('input[name="interest"]:checked').forEach(function (el) {
      picked.push(el.value);
    });
    return picked;
  }

  function showSuccess(email, wants) {
    var title = (document.getElementById('b-title').value || '').trim();

    stepNav.style.display = 'none';
    processing.classList.remove('is-active');
    stepEls.forEach(function (el) { el.classList.remove('is-active'); });
    stepperEls.forEach(function (el) {
      el.classList.remove('is-active');
      el.classList.add('is-done');
      el.querySelector('.stepper__num').innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    });
    successEl.classList.add('is-active');

    document.getElementById('refCode').textContent = refCode();
    document.getElementById('successEmail').textContent = email || 'your address';

    var msg = 'We have your details for ' + (title || 'your book') + '. ' +
      'A strategist will review your book and email you at ' + (email || 'your address') + ' within one business day with your proposal and kickoff call invite.';
    if (wants.length) {
      msg += ' We have noted your interest in: ' + wants.join(', ') + '.';
    }
    document.getElementById('successMsg').textContent = msg;

    regTitle.textContent = 'Registration complete';
    regSub.textContent = 'We have everything we need. Here is what happens next.';

    var top = form.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
  }

  function showFailure(errEl) {
    stepNav.style.display = '';
    processing.classList.remove('is-active');
    if (errEl) {
      errEl.textContent = 'We could not send that just now. Please email us directly at ' +
        (window.KOZAForms ? window.KOZAForms.email() : 'our inbox') + ' and we will pick it up right away.';
      errEl.classList.add('is-visible');
    }
  }

  function submit() {
    stepNav.style.display = 'none';
    processing.classList.add('is-active');

    var email = (document.getElementById('r-email').value || '').trim();
    var wants = interests();
    var errEl = form.querySelector('.form__error');

    if (errEl) { errEl.textContent = ''; errEl.classList.remove('is-visible'); }

    if (!window.KOZAForms || !window.KOZAForms.send) {
      showFailure(errEl);
      return;
    }

    window.KOZAForms.send(form).then(function (res) {
      if (res.mode === 'blocked') return;          /* bot */
      if (res.ok) { showSuccess(email, wants); return; }
      showFailure(errEl);
    });
  }
})();
