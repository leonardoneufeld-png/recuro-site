// Scroll cues for the 3D business map: layouts, timeline, camera shots. Pure functions, no DOM, no imports.
export const PANEL_IDS = ['pos', 'stock', 'ordering', 'staff', 'cogs', 'invoices'];

// Ring: every panel has two neighbours. `at` = index (1-6) of the beat whose end lights the link.
export const LINKS = [
  { from: 'pos', to: 'stock', at: 2 },
  { from: 'stock', to: 'ordering', at: 3 },
  { from: 'pos', to: 'staff', at: 4 },
  { from: 'staff', to: 'cogs', at: 5 },
  { from: 'ordering', to: 'invoices', at: 6 },
  { from: 'invoices', to: 'cogs', at: 6 },
];

const FOV_DEG = 30;
const STOPS = 8;
const T_MAX = 7.999;
const LANDSCAPE_COLS = [-15, 0, 15];
const LANDSCAPE_ROWS = [5.5, -5.5];
const PORTRAIT_COLS = [-7, 7];
const PORTRAIT_ROWS = [11, 0, -11];
const LANDSCAPE_ORDER = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];
const PORTRAIT_ORDER = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2], [1, 2]]; // pos stock ordering staff cogs invoices

export function layoutFor(aspect) {
  const portrait = aspect < 1;
  const [cols, rows, order] = portrait
    ? [PORTRAIT_COLS, PORTRAIT_ROWS, PORTRAIT_ORDER]
    : [LANDSCAPE_COLS, LANDSCAPE_ROWS, LANDSCAPE_ORDER];
  const out = {};
  PANEL_IDS.forEach((id, i) => { out[id] = [cols[order[i][0]], rows[order[i][1]], 0]; });
  return out;
}

// Hand-picked, no randomness. Lower-left (x < -6, y < -2) stays free for the headline.
const scatter = (pos, rot) => Object.freeze({ pos: Object.freeze(pos), rot: Object.freeze(rot) });
export const SCATTER = Object.freeze({
  pos: scatter([-20, 9, -4], [0.1, 0.28, 0.05]),
  stock: scatter([-2, 13, -12], [-0.12, 0.2, -0.04]),
  ordering: scatter([24, 9, -6], [0.08, -0.3, 0.07]),
  staff: scatter([6, 0, 4], [-0.06, -0.14, -0.09]),
  cogs: scatter([24, -11, -14], [0.14, -0.22, 0.1]),
  invoices: scatter([2, -13, -8], [-0.1, 0.18, 0.03]),
});

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function smoothstep(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

// The reference line is the middle of the viewport. Gaps between sections count as the next section's start.
export function timelineAt(tops, heights, scrollY, viewportH) {
  const y = scrollY + viewportH / 2;
  for (let i = 0; i < STOPS; i++) {
    if (y < tops[i]) return i;
    if (y < tops[i] + heights[i]) return Math.min(i + (y - tops[i]) / heights[i], T_MAX);
  }
  return T_MAX;
}

export const linkAmount = (T, at) => clamp((T - (at + 0.55)) / 0.35, 0, 1);
export const assembleAmount = (T) => clamp((T - 6.6) / 0.9, 0, 1);

// order = panel index / 5. The last panel starts first.
export function panelAssemble(e, order) {
  const delay = (1 - order) * 0.42;
  return smoothstep((e - delay) / 0.58);
}

// Distance at which a square of side `fit` fills the shorter side of the view.
export function distanceFor(fit, fovDeg, aspect) {
  const vertical = (fit / 2) / Math.tan((fovDeg * Math.PI) / 360);
  return aspect < 1 ? vertical / aspect : vertical;
}

const HERO = { fit: [62, 34], azimuth: 0.18, polar: Math.PI / 2 - 0.08 };
const PANEL = { fit: [20, 17], azimuth: 0.22, polar: Math.PI / 2 - 0.05, shiftX: 0.22, portraitDrop: 4.5 };
const FLOW = { fit: [50, 36] };

function groupCentre() {
  const ps = PANEL_IDS.map((id) => SCATTER[id].pos);
  const mid = (k) => (Math.min(...ps.map((p) => p[k])) + Math.max(...ps.map((p) => p[k]))) / 2;
  return [mid(0), mid(1), mid(2)];
}

// One shot per stop 0..7.
export function shotsFor(aspect) {
  const portrait = aspect < 1;
  const k = portrait ? 1 : 0;
  const shots = [{
    target: groupCentre(), distance: distanceFor(HERO.fit[k], FOV_DEG, aspect),
    polar: HERO.polar, azimuth: HERO.azimuth, shiftX: 0,
  }];
  PANEL_IDS.forEach((id, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const [x, y, z] = SCATTER[id].pos;
    shots.push({
      target: [x, portrait ? y - PANEL.portraitDrop : y, z],
      distance: distanceFor(PANEL.fit[k], FOV_DEG, aspect),
      polar: PANEL.polar, azimuth: side * PANEL.azimuth, shiftX: portrait ? 0 : side * PANEL.shiftX,
    });
  });
  shots.push({ target: [0, 0, 0], distance: distanceFor(FLOW.fit[k], FOV_DEG, aspect), polar: Math.PI / 2, azimuth: 0, shiftX: 0 });
  return shots;
}

const lerp = (a, b, t) => a + (b - a) * t;
const copyShot = (s) => ({ ...s, target: [...s.target] });
const HOLD = 0.6;

// Holds a stop's shot for its first 60%, then blends to the next shot over the last 40%.
export function shotAt(T, aspect) {
  const t = clamp(T, 0, T_MAX);
  const n = Math.floor(t);
  const shots = shotsFor(aspect);
  const f = t - n;
  if (n >= STOPS - 1 || f <= HOLD) return copyShot(shots[n]);
  const w = smoothstep((f - HOLD) / (1 - HOLD));
  const a = shots[n];
  const b = shots[n + 1];
  return {
    target: a.target.map((v, i) => lerp(v, b.target[i], w)),
    distance: lerp(a.distance, b.distance, w),
    polar: lerp(a.polar, b.polar, w),
    azimuth: lerp(a.azimuth, b.azimuth, w),
    shiftX: lerp(a.shiftX, b.shiftX, w),
  };
}
