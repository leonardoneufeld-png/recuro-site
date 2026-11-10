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
// Gaps between plates (8 and 5 units landscape, 3 and 4 portrait) are long enough for a link to read as a line.
const LANDSCAPE_COLS = [-20, 0, 20];
const LANDSCAPE_ROWS = [6.5, -6.5];
const PORTRAIT_COLS = [-7.5, 7.5];
const PORTRAIT_ROWS = [12, 0, -12];
const PANEL_W = 12;
const PANEL_H = 8;
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

// Hand-picked, no randomness. Placed for the hero shot (see HERO): on a 1280x800 screen they sit in the top band and
// the upper right, clear of the headline (left 62%, lower 55%) and the sub-line block (lower right). Two sit behind
// others in z, which reads as depth.
const scatter = (pos, rot) => Object.freeze({ pos: Object.freeze(pos), rot: Object.freeze(rot) });
export const SCATTER = Object.freeze({
  pos: scatter([-26, 10.6, -4], [0.1, 0.28, 0.05]),
  stock: scatter([-7.4, 13.1, -10], [-0.12, 0.2, -0.04]),
  ordering: scatter([12.4, 10.2, -6], [0.08, -0.3, 0.07]),
  staff: scatter([28.8, 13.3, -12], [-0.06, -0.14, -0.09]),
  cogs: scatter([20.8, -2, -8], [0.14, -0.22, 0.1]),
  invoices: scatter([-20.5, 8.2, -19], [-0.1, 0.18, 0.03]),
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
// done a third of the way into the flow section; the rest of that section is the hold
export const assembleAmount = (T) => clamp((T - 6.6) / 0.73, 0, 1);

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

// Hero: plates about 1.5x larger than the first version. Landscape looks at the middle of the scatter; portrait looks
// below it so the plates fill the upper half and the headline has the bottom.
const HERO = { fit: [41, 38], target: [[0, 1.4, 0], [-2, -5, -8]], azimuth: 0.18, polar: Math.PI / 2 - 0.08, hold: 0.85 };
const PANEL = { fit: [20, 17], azimuth: 0.22, polar: Math.PI / 2 - 0.05, shiftX: 0.22, portraitDrop: 4.5 };
// Flow: the assembled map is framed in the lower part of the screen under the pinned text. region = share of the screen
// height the map may use, margin = share of that space it fills.
const FLOW = { region: [0.64, 0.52], margin: 0.88 };

// Distance at which a box of w x h fits the view, filling at most `margin` of each side.
export function distanceForBox(w, h, fovDeg, aspect, margin = 0.88) {
  const unit = 2 * Math.tan((fovDeg * Math.PI) / 360);
  return Math.max(w / margin / (unit * aspect), h / margin / unit);
}

// Width and height of the assembled map for this aspect.
export function mapBox(aspect) {
  const pts = Object.values(layoutFor(aspect));
  const span = (k) => Math.max(...pts.map((p) => p[k])) - Math.min(...pts.map((p) => p[k]));
  return [span(0) + PANEL_W, span(1) + PANEL_H];
}

function flowShot(aspect, k) {
  const [w, h] = mapBox(aspect);
  const region = FLOW.region[k];
  // the map has to fit the lower `region` of the screen, so size the view as if that region were the whole screen
  const distance = distanceForBox(w, h / region, FOV_DEG, aspect, FLOW.margin);
  const visibleH = 2 * distance * Math.tan((FOV_DEG * Math.PI) / 360);
  const centreFromTop = 1 - region / 2 - 0.02;
  return { target: [0, (centreFromTop - 0.5) * visibleH, 0], distance, polar: Math.PI / 2, azimuth: 0, shiftX: 0 };
}

const lerp = (a, b, t) => a + (b - a) * t;
const copyShot = (s) => ({ ...s, target: [...s.target] });

function buildShots(aspect) {
  const portrait = aspect < 1;
  const k = portrait ? 1 : 0;
  const shots = [{
    target: [...HERO.target[k]], distance: distanceFor(HERO.fit[k], FOV_DEG, aspect),
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
  shots.push(flowShot(aspect, k));
  return shots;
}

// The table only depends on the aspect, so it is built once per aspect (a few at most: window sizes seen so far).
const MAX_CACHED = 8;
const tables = new Map();
function table(aspect) {
  if (!tables.has(aspect)) {
    if (tables.size >= MAX_CACHED) tables.clear();
    tables.set(aspect, buildShots(aspect));
  }
  return tables.get(aspect);
}

// One shot per stop 0..7. Callers get their own copies; the cached table is never handed out.
export const shotsFor = (aspect) => table(aspect).map(copyShot);

const HOLD = 0.6;

// Holds a stop's shot for its first 60% (the hero for 85%), then blends to the next shot over the rest.
export function shotAt(T, aspect) {
  const t = Number.isFinite(T) ? clamp(T, 0, T_MAX) : 0; // NaN or Infinity from a bad measurement counts as the hero
  const n = Math.floor(t);
  const shots = table(aspect);
  const f = t - n;
  const hold = n === 0 ? HERO.hold : HOLD;
  if (n >= STOPS - 1 || f <= hold) return copyShot(shots[n]);
  const w = smoothstep((f - hold) / (1 - hold));
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
