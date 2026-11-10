import { pickLang, applyLang, safeStorage, t } from './i18n.js';
import { STRINGS } from './strings.js';
import { parseNumber, yearlyCost, formatCHF, calcHint } from './calc.js';
import { BOOKING_URL, CONTACT_EMAIL, bookingHref, isBookingLive } from './config.js';

const toggle = document.querySelector('.lang-toggle');
const form = document.querySelector('#calc-form');
const result = document.querySelector('#calc-result');
const hint = document.querySelector('#calc-hint');
let lang = pickLang(safeStorage.get('lang'), navigator.languages || [navigator.language]);

const updateCalc = () => {
  if (!form || !result) return;
  const { hours, rate } = form.elements;
  const [h, r] = [hours, rate].map((input) => {
    const n = parseNumber(input.value);
    // flag text we can't read; a blank field is just empty, not wrong
    if (Number.isNaN(n) && input.value.trim()) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    return n;
  });
  result.textContent = formatCHF(yearlyCost(h, r), lang);
  if (hint) {
    const key = calcHint(hours.value, rate.value);
    hint.textContent = key ? t(STRINGS, key, lang) : '';
  }
};

const render = () => {
  applyLang(document, STRINGS, lang);
  // applyLang doesn't cover meta tags
  document.querySelectorAll('[data-i18n-content]').forEach((m) => {
    m.setAttribute('content', t(STRINGS, m.getAttribute('data-i18n-content'), lang));
  });
  // the toggle is an action ("switch to the other language"); its label is read in that language
  if (toggle) toggle.setAttribute('lang', lang === 'de' ? 'en' : 'de');
  const href = bookingHref(BOOKING_URL, CONTACT_EMAIL, lang);
  document.querySelectorAll('[data-book]').forEach((a) => a.setAttribute('href', href));
  const live = isBookingLive(BOOKING_URL);
  document.querySelectorAll('[data-booking-live]').forEach((n) => { n.hidden = !live; });
  document.querySelectorAll('[data-booking-fallback]').forEach((n) => { n.hidden = live; });
  updateCalc();
  // language is applied: show the text the head script hid for German visitors
  document.documentElement.classList.remove('i18n-pending');
};

if (toggle) {
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    lang = lang === 'de' ? 'en' : 'de';
    safeStorage.set('lang', lang);
    render();
  });
}
if (form) {
  form.addEventListener('input', updateCalc);
  form.addEventListener('submit', (e) => e.preventDefault());
}
render();

// Fade-in on scroll. No JS, no IntersectionObserver or reduced motion: content stays static and visible.
const MAX_STAGGER = 6; // keeps a section's cascade under ~450 ms
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduce = motionQuery.matches;
// the rule sentence gets ink dots instead of the plain fade; particles.js loads only when the section is near
const ruleText = document.querySelector('.rule-text');
const ruleSection = ruleText && ruleText.closest('section');
let stopParticles = null, nearObserver = null, loading = false;
const canParticles = () => ruleSection && 'ResizeObserver' in window && 'IntersectionObserver' in window;
const startParticles = async () => {
  if (stopParticles || loading) return;
  loading = true;
  try {
    const { initParticles } = await import('./particles.js');
    // the preference may have flipped while the module loaded
    if (!motionQuery.matches) stopParticles = initParticles(ruleText);
  } catch { /* module failed to load: the plain sentence stays */ }
  loading = false;
};
const armParticles = () => {
  if (!canParticles() || nearObserver) return;
  // within about one viewport of the screen
  nearObserver = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    nearObserver.disconnect(); nearObserver = null;
    startParticles();
  }, { rootMargin: '100% 0px 100% 0px' });
  nearObserver.observe(ruleSection);
};
const disarmParticles = () => {
  nearObserver?.disconnect(); nearObserver = null;
  stopParticles?.(); stopParticles = null;
};
if (!reduce && canParticles()) {
  ruleText.classList.remove('reveal');
  armParticles();
}
// reduced motion switched on or off during the visit
motionQuery.addEventListener?.('change', (e) => (e.matches ? disarmParticles() : armParticles()));
const items = document.querySelectorAll('.reveal');
if (!reduce && 'IntersectionObserver' in window && items.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  // stagger index restarts per section
  document.querySelectorAll('section').forEach((s) => {
    s.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--i', Math.min(i, MAX_STAGGER)));
  });
  // already on screen at load: show at once, so the first paint never waits on a fade
  items.forEach((el) => (el.getBoundingClientRect().top < innerHeight ? el.classList.add('is-in') : io.observe(el)));
  document.documentElement.classList.add('motion');
}
