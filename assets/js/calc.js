// Hours × cost per hour × 52 weeks. Pure functions, no DOM.
export const HOURS_MAX = 168;
export const RATE_MAX = 1000;
export const WEEKS = 52;
export const DEFAULT_HOURS = 12;
export const DEFAULT_RATE = 32;

const NUMBER_RE = /^\d+(?:[.,]\d+)?$/;

// Accepts "12", "12.5" and the Swiss/German "12,5". Anything else is NaN.
export function parseNumber(raw) {
  const s = String(raw ?? '').trim();
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
