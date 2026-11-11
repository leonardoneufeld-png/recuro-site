// Hours × cost per hour × 52 weeks. Pure functions, no DOM.
export const HOURS_MAX = 168;
export const RATE_MAX = 1000;
export const WEEKS = 52;
export const DEFAULT_HOURS = 12;
export const DEFAULT_RATE = 32;

const NUMBER_RE = /^\d*[.,]?\d+$/;
const GROUPED_RE = /^\d{1,3}(?:[.,]\d{3})+$/;

// Accepts what owners type: "12", "12,5", ".5", "CHF 32", "Fr. 32.50", "32.–", "12.5h", "12 Std.", "1'000".
// A separator before exactly three digits is a thousands separator ("1,000" = 1000). Anything else is NaN.
export function parseNumber(raw) {
  const s = String(raw ?? '').trim()
    .replace(/^(?:CHF|Fr\.?)\s*/i, '')
    .replace(/[.,]?\s*[–-]+$/, '')
    .replace(/\s*[a-zäöü.]+$/i, '')
    .replace(/(\d)['’\s](?=\d{3}\b)/g, '$1');
  if (GROUPED_RE.test(s)) return Number(s.replace(/[.,]/g, ''));
  return NUMBER_RE.test(s) ? Number(s.replace(',', '.')) : NaN;
}

const clamp = (n, max) => (Number.isNaN(n) || n < 0 ? 0 : Math.min(n, max));

export function yearlyCost(hoursPerWeek, ratePerHour) {
  return Math.round(clamp(hoursPerWeek, HOURS_MAX) * clamp(ratePerHour, RATE_MAX) * WEEKS);
}

// Separator inserted by hand: Intl's de-CH output differs between runtimes.
export function formatCHF(amount, lang) {
  const sep = lang === 'de' ? '’' : ',';
  return `CHF ${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, sep)}`;
}

// The thousands separators of a formatted amount, apart from the rest. With tabular figures on, the font gives a comma
// the width of a digit ("19 ,968"), so the page sets the separators in a span that turns tabular figures off.
export function splitSeparators(text) {
  return text.split(/([,’])/).filter(Boolean).map((part) => ({ part, sep: part === ',' || part === '’' }));
}

// Which hint (a STRINGS key) the calculator should show, or null. Blank is empty, not wrong.
export function calcHint(rawHours, rawRate) {
  const [h, r] = [rawHours, rawRate].map(parseNumber);
  const unreadable = (raw, n) => Number.isNaN(n) && String(raw ?? '').trim() !== '';
  if (unreadable(rawHours, h) || unreadable(rawRate, r)) return 'calc.hintNumber';
  if (h > HOURS_MAX) return 'calc.hintMaxHours';
  if (r > RATE_MAX) return 'calc.hintMaxRate';
  return null;
}
