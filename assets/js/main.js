import { pickLang, applyLang, safeStorage, t } from './i18n.js';
import { STRINGS } from './strings.js';
import { parseNumber, yearlyCost, formatCHF } from './calc.js';
import { BOOKING_URL, CONTACT_EMAIL, bookingHref, isBookingLive } from './config.js';
import { initParticles } from './particles.js';

const toggle = document.querySelector('.lang-toggle');
const form = document.querySelector('#calc-form');
const result = document.querySelector('#calc-result');
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
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// the rule sentence gets ink dots instead of the plain fade
const ruleText = document.querySelector('.rule-text');
if (!reduce && ruleText && 'ResizeObserver' in window && 'IntersectionObserver' in window) {
  ruleText.classList.remove('reveal');
  initParticles(ruleText);
}
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
