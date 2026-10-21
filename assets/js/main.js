/* ==========================================================
   KOZA LITERARY LIAISON — interactions
   ========================================================== */
(function () {
  'use strict';

  /* ------------------------------------------- sticky header + mobile nav */
  var header = document.querySelector('.header');
  var burger = document.querySelector('.burger');
  var mobileNav = document.querySelector('.mobile-nav');

  function onScroll() {
    if (!header) return;
    header.classList.toggle('is-stuck', window.scrollY > 20);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --------------------------------------------------- scroll reveal */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  function showReveal(el) { el.classList.add('is-visible'); }

  if ('IntersectionObserver' in window && revealEls.length) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          showReveal(entry.target);
          revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealEls.forEach(showReveal);
  }

  /* Safety net: a fast scroll (or a jump to an anchor) can skip the
     observer's sampling frames — so sweep the viewport on every scroll
     and reveal anything that is already in view. */
  function sweepReveal() {
    var vh = window.innerHeight;
    revealEls.forEach(function (el) {
      if (el.classList.contains('is-visible')) return;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > 0) showReveal(el);
    });
  }

  /* ------------------------------------------------------ stat counters */
  function animateCount(el) {
    if (el.dataset.animated === '1') return;
    el.dataset.animated = '1';
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1900;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = prefix + val.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }

  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
  if (counters.length) {
    if ('IntersectionObserver' in window) {
      var countIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countIO.unobserve(entry.target);
          }
        });
      }, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
      counters.forEach(function (el) { countIO.observe(el); });
    } else {
      counters.forEach(animateCount);
    }
  }

  /* Same safety net for the counters. */
  function sweepCounters() {
    var vh = window.innerHeight;
    counters.forEach(function (el) {
      if (el.dataset.animated === '1') return;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.96 && r.bottom > 0) animateCount(el);
    });
  }

  var sweepQueued = false;
  window.addEventListener('scroll', function () {
    if (sweepQueued) return;
    sweepQueued = true;
    window.requestAnimationFrame(function () {
      sweepQueued = false;
      sweepReveal();
      sweepCounters();
    });
  }, { passive: true });

  window.addEventListener('load', function () {
    sweepReveal();
    sweepCounters();
  });
  sweepReveal();
  sweepCounters();

  /* ------------------------------------------------- testimonial slider */
  var carousels = document.querySelectorAll('[data-carousel]');
  carousels.forEach(function (root) {
    var track = root.querySelector('.tst-track');
    var slides = root.querySelectorAll('.tst-slide');
    var dotsWrap = root.querySelector('.tst-dots');
    if (!track || !slides.length) return;

    var index = 0;
    var timer = null;
    var AUTO = 7000;

    var dots = [];
    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
      b.addEventListener('click', function () { go(i, true); });
      dotsWrap.appendChild(b);
      dots.push(b);
    });

    function go(i, manual) {
      index = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === index); });
      if (manual) restart();
    }
    function next() { go(index + 1); }
    function prev() { go(index - 1); }
    function restart() { clearInterval(timer); timer = setInterval(next, AUTO); }
    function start() { restart(); }

    var nextBtn = root.querySelector('.tst-arrow--next');
    var prevBtn = root.querySelector('.tst-arrow--prev');
    if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1, true); });
    if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1, true); });

    root.addEventListener('mouseenter', function () { clearInterval(timer); });
    root.addEventListener('mouseleave', start);

    // touch swipe
    var startX = 0, delta = 0, dragging = false;
    track.addEventListener('touchstart', function (e) {
      dragging = true; startX = e.touches[0].clientX; delta = 0;
      clearInterval(timer);
    }, { passive: true });
    track.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      delta = e.touches[0].clientX - startX;
    }, { passive: true });
    track.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(delta) > 45) { delta < 0 ? next() : prev(); }
      restart();
    });

    go(0);
    start();
  });

  /* ------------------------------------------------------ contact form */
  document.querySelectorAll('[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var ok  = form.querySelector('.form__success');
      var err = form.querySelector('.form__error');
      var btn = form.querySelector('button[type="submit"]');
      var original = btn ? btn.innerHTML : '';

      if (err) { err.textContent = ''; err.classList.remove('is-visible'); }
      if (ok)  { ok.classList.remove('is-visible'); }
      if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }

      var done = function (res) {
        if (btn) { btn.innerHTML = original; btn.disabled = false; }

        if (res.mode === 'blocked') return;   /* bot — show nothing */

        if (res.mode === 'mailto' || res.mode === 'mailto-fallback') {
          if (ok) {
            ok.classList.add('is-visible');
            ok.innerHTML = 'Thanks — we&rsquo;ve opened your email app with your details filled in. ' +
              'Press send and it comes straight to our team at ' +
              '<a href="mailto:' + (window.KOZAForms ? window.KOZAForms.email() : '') + '" style="display:inline-block;margin-top:8px;color:#1D6B40;font-weight:700;text-decoration:underline;text-underline-offset:3px">' +
              (window.KOZAForms ? window.KOZAForms.email() : 'our inbox') + '</a>';
          }
          return;
        }

        if (res.ok) {
          if (ok) {
            ok.classList.add('is-visible');
            ok.innerHTML = 'Thank you — your proposal request is on its way. A member of the Koza team will reach out within one business day.' +
              ' <a href="register.html" style="display:inline-block;margin-top:8px;color:#1D6B40;font-weight:700;text-decoration:underline;text-underline-offset:3px">Already ready to begin? Start your registration &rarr;</a>';
          }
          form.reset();
        } else if (err) {
          err.textContent = 'Something went wrong sending that. Please email us directly at ' +
            (window.KOZAForms ? window.KOZAForms.email() : 'our inbox') + ' and we will pick it up right away.';
          err.classList.add('is-visible');
        }
      };

      if (window.KOZAForms && window.KOZAForms.send) {
        window.KOZAForms.send(form).then(done);
      } else {
        done({ ok: false, mode: 'error' });
      }
    });
  });

  /* ------------------------------------------------- current year stamp */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ------------------------------------------ smooth anchor offset fix */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 92;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });
})();
