// Step arrows: previous and next buttons that scroll the page from one stop to the next, for visitors who would rather
// click than scroll. Stops: the hero, each panel where the map holds it with its own text in view, the assembled flow
// map, then calc, case, about and book. The map's stops come from timeline.js, the same boxes the engine scrolls by,
// so they are right with or without the live map.
import { measureTimeline } from './map/timeline.js';

// Panel i is held by the camera from T = i+1 to i+1.6. Desktop: its text is fully in from i+0.85 to i+1.4, so the stop
// is i+1.3. Phone: the stop is where the frame pins under the header (about i+1.27; the last frame is pinned only at that
// one position, since its bottom margin must stay inside .beats).
export const PANEL_STOP = 0.3;
export const FLOW_STOP = 7.4; // the map is fully assembled from 7.33 (cues.js assembleAmount)
const AFTER = ['#calc', '#case', '#about', '#book'];
const SCROLL_PAD = 8; // site.css scroll-padding-top: the header plus 0.5rem
const EPS = 2; // px: this close to a stop counts as on it
const SETTLE_MS = 180; // no scroll for this long ends a scroll the arrows started
const HINT_KEY = 'stepnav-hint-seen';
const HEADER_GAP = 8; // phone: px between the arrows and the language switch
// The glide between stops: slow enough for the camera's move from plate to plate (the browser's own smooth scroll took
// about 0.67 s in Chrome, whatever the distance, and Safari times it differently).
export const GLIDE_MS = 1400;
export const GLIDE_MAX_MS = 2000;
const GLIDE_STEP_PX = 1300; // about one phone step; longer moves take longer, by the square root of the distance
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);

// The scroll position at which the engine's timeline reads T (the inverse of cues.js timelineAt).
export function yAtT(tops, heights, T, vh) {
  const n = Math.min(Math.floor(T), tops.length - 1);
  return tops[n] + (T - n) * heights[n] - vh / 2;
}

// Pure. All stops as scroll positions, rising, on the page. `after`: the page tops of calc, case, about, book.
export function stopList({ tops, heights, vh, header, phone, after, maxY }) {
  const at = (T) => yAtT(tops, heights, T, vh);
  const panels = tops.slice(1, -1).map((top, i) => (phone ? top - header : at(i + 1 + PANEL_STOP)));
  const all = [0, ...panels, at(FLOW_STOP), ...after.map((top) => top - header - SCROLL_PAD)];
  return all.map((y) => Math.min(maxY, Math.max(0, Math.round(y)))).reduce((out, y) => (out.length && y <= out[out.length - 1] ? out : [...out, y]), []);
}

// Pure. The index of the next (dir 1) or previous (dir -1) stop from scroll position y, or -1 if there is none.
export function stepTarget(stops, y, dir) {
  if (dir > 0) return stops.findIndex((s) => s > y + EPS);
  for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < y - EPS) return i;
  return -1;
}

// Pure. How long a glide over `distance` px takes.
export const glideMs = (distance) => Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MS, GLIDE_MS * Math.sqrt(Math.abs(distance) / GLIDE_STEP_PX)));

// Pure. Position and speed (px per ms) at fraction t of a glide { from, to, v0 (px per ms), ms }: a cubic Hermite curve
// that leaves `from` at speed v0 and lands on `to` at rest. With v0 = 0 it is a symmetric ease-in-out (smoothstep).
// A click mid-glide starts the next one at the current speed, so nothing jumps or jolts.
export function glideAt({ from, to, v0, ms }, t) {
  const d = to - from, k = v0 * ms;
  return { y: from + d * t * t * (3 - 2 * t) + k * t * (1 - t) * (1 - t), v: (d * 6 * t * (1 - t) + k * (1 - t) * (1 - 3 * t)) / ms };
}

const store = (fn) => { try { return fn(window.localStorage); } catch { return null; } };

export function initStepNav(nav) {
  const map = document.querySelector('.map');
  const header = document.querySelector('.site-header');
  const after = AFTER.map((s) => document.querySelector(s));
  const lang = header.querySelector('.lang-toggle');
  if (!nav || !map || !header || after.some((el) => !el)) return;
  const buttons = [...nav.querySelectorAll('[data-step]')];
  const phone = window.matchMedia('(max-width: 759px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stops = [], height = -1, pending = null, settle = 0, raf = 0;
  let glide = null, frame = 0; // the glide in flight and its animation frame

  const measure = () => {
    const root = document.documentElement;
    height = root.scrollHeight;
    const { tops, heights } = measureTimeline(map, phone.matches);
    stops = stopList({
      tops, heights, vh: innerHeight, header: header.getBoundingClientRect().height, phone: phone.matches,
      after: after.map((el) => el.getBoundingClientRect().top + window.scrollY), maxY: height - innerHeight,
    });
  };
  const here = () => pending ?? window.scrollY;
  const update = () => {
    raf = 0;
    if (document.documentElement.scrollHeight !== height) measure();
    for (const b of buttons) b.setAttribute('aria-disabled', String(stepTarget(stops, here(), Number(b.dataset.step)) < 0));
    // phone: the arrows sit in the header bar, just left of the language switch, whose width follows the language
    const r = phone.matches && lang && !lang.hidden ? lang.getBoundingClientRect() : null;
    if (r && r.width) nav.style.setProperty('--stepnav-right', `${Math.round(document.documentElement.clientWidth - r.left + HEADER_GAP)}px`);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };

  const dismissHint = () => {
    if (!nav.classList.contains('hint')) return;
    nav.classList.remove('hint');
    store((s) => s.setItem(HINT_KEY, '1'));
  };
  if (!store((s) => s.getItem(HINT_KEY)) && window.scrollY < 40) nav.classList.add('hint');

  const stopGlide = () => { cancelAnimationFrame(frame); frame = 0; glide = null; };
  const tick = (now) => {
    const t = Math.min(1, (now - glide.t0) / glide.ms);
    // 'instant': the page's scroll-behavior: smooth must not ease each of our frames again
    window.scrollTo({ top: glideAt(glide, t).y, behavior: 'instant' });
    if (t < 1) { frame = requestAnimationFrame(tick); return; }
    stopGlide();
    pending = null;
    queue();
  };
  const glideTo = (to) => {
    const now = performance.now();
    const v0 = glide ? glideAt(glide, Math.min(1, (now - glide.t0) / glide.ms)).v : 0;
    cancelAnimationFrame(frame);
    const from = window.scrollY;
    glide = { from, to, v0, ms: glideMs(to - from), t0: now };
    frame = requestAnimationFrame(tick);
  };

  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    measure();
    // a click while an arrow's scroll still runs goes on from where that scroll is heading
    const i = stepTarget(stops, here(), Number(b.dataset.step));
    dismissHint();
    if (i < 0) return;
    pending = stops[i];
    if (reduced.matches) { stopGlide(); window.scrollTo({ top: pending, behavior: 'instant' }); } else glideTo(pending);
    queue();
  });
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) dismissHint();
    clearTimeout(settle);
    settle = setTimeout(() => { if (!glide) { pending = null; queue(); } }, SETTLE_MS);
    if (pending !== null && Math.abs(window.scrollY - pending) < EPS) pending = null;
    queue();
  }, { passive: true });
  // the visitor scrolls on their own: the glide stops at once and their position counts again
  const release = () => { stopGlide(); pending = null; queue(); };
  for (const type of ['wheel', 'touchstart']) window.addEventListener(type, release, { passive: true });
  // a press anywhere but the arrows, including a grab of the scrollbar, which sends no wheel or key
  window.addEventListener('pointerdown', (e) => { if (glide && !e.target.closest?.('.stepnav')) release(); }, { passive: true });
  // keys that scroll the page; Space and Enter on the arrows themselves are clicks, not a takeover
  window.addEventListener('keydown', (e) => { if (SCROLL_KEYS.has(e.key) && !e.target.closest?.('input, textarea, select, .stepnav')) release(); });
  // a new width moves every stop, so the glide stops where it is; a phone toolbar sliding away (height only) does not
  // stop it. A hidden tab gets no frames, so the glide lands on its stop at once.
  let width = innerWidth;
  window.addEventListener('resize', () => { if (innerWidth !== width) { width = innerWidth; release(); } height = -1; queue(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !glide) return;
    const to = glide.to;
    release();
    window.scrollTo({ top: to, behavior: 'instant' });
  });
  lang?.addEventListener('click', () => setTimeout(queue, 0));
  measure();
  nav.hidden = false;
  update();
}
