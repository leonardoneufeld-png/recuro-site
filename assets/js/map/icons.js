// Stencil icons: holes cut through a steel plate. Panel units, origin at the plate centre, before panels.js scales them.
// Box: 7.0 wide by 4.6 high (x in [-3.5, 3.5], y in [-2.3, 2.3]); panels.js applies ICON_SCALE 1.2 and keeps >= 1.2 of steel to the edge.
// Every outline is clockwise, at least 0.25 wide and at least 0.25 from its neighbours. Pure data, no imports.

const T = 0.3; // stroke, bridge and gap thickness shared by the whole family
const R = 0.3; // corner radius shared by the whole family

const area = (pts) => pts.reduce((s, [x, y], i) => {
  const [x2, y2] = pts[(i + 1) % pts.length];
  return s + (x * y2 - x2 * y);
}, 0) / 2;
const cw = (pts) => (area(pts) > 0 ? [...pts].reverse() : pts);
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
const mirrorX = (pts) => cw(pts.map(([x, y]) => [-x, y]));
const unit = ([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1]];

// Polygon with every corner rounded by its own radius (number for all, array per vertex, 0 keeps it sharp).
function roundPoly(v, rad = R, seg = 8) {
  const out = [];
  v.forEach((p, i) => {
    const a = v[(i + v.length - 1) % v.length];
    const b = v[(i + 1) % v.length];
    const r0 = Array.isArray(rad) ? rad[i] : rad;
    const u1 = unit(sub(a, p));
    const u2 = unit(sub(b, p));
    const theta = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    if (r0 <= 0 || theta > Math.PI - 1e-3) { out.push(p); return; }
    const reach = Math.min(Math.hypot(...sub(a, p)), Math.hypot(...sub(b, p))) / 2;
    const d = Math.min(r0 / Math.tan(theta / 2), reach);
    const r = d * Math.tan(theta / 2);
    const c = add(p, unit(add(u1, u2)), r / Math.sin(theta / 2));
    const t1 = add(p, u1, d);
    const t2 = add(p, u2, d);
    const a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]);
    let sweep = Math.atan2(t2[1] - c[1], t2[0] - c[0]) - a1;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    for (let k = 0; k <= seg; k++) out.push(polar(c[0], c[1], r, a1 + (sweep * k) / seg));
  });
  return cw(out);
}

const rect = (x0, y0, x1, y1, rad = R) => roundPoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], rad);
const circle = (cx, cy, r, n = 48) => cw(Array.from({ length: n }, (_, i) => polar(cx, cy, r, (2 * Math.PI * i) / n)));
const arcPts = (cx, cy, r, a0, a1, n = 16) => Array.from({ length: n + 1 }, (_, i) => polar(cx, cy, r, a0 + ((a1 - a0) * i) / n));

// Ring piece between radii r0 < r1 and angles a0 < a1; the four end corners are softened.
function arcBand(cx, cy, r0, r1, a0, a1, steps = 16) {
  const outer = arcPts(cx, cy, r1, a0, a1, steps);
  const inner = arcPts(cx, cy, r0, a1, a0, steps);
  const rad = new Array(2 * steps + 2).fill(0);
  [0, steps, steps + 1, 2 * steps + 1].forEach((i) => { rad[i] = 0.1; });
  return roundPoly([...outer, ...inner], rad, 6);
}

// Offsets the edges of a convex counter-clockwise polygon inwards by t.
function inset(v, t) {
  const lines = v.map((p, i) => {
    const q = v[(i + 1) % v.length];
    const d = unit(sub(q, p));
    return { p: add(p, [-d[1], d[0]], t), d };
  });
  return lines.map((l, i) => {
    const k = lines[(i + lines.length - 1) % lines.length];
    const den = k.d[0] * l.d[1] - k.d[1] * l.d[0];
    const s = ((l.p[0] - k.p[0]) * l.d[1] - (l.p[1] - k.p[1]) * l.d[0]) / den;
    return add(k.p, k.d, s);
  });
}

// Outline ring of a convex polygon with one steel bridge across edge `e` (position u in 0..1). One piece, so it stays a C.
function ringC(v, e, u, rad = R) {
  const n = v.length;
  const ins = inset(v, T);
  const d = unit(sub(v[(e + 1) % n], v[e]));
  const len = Math.hypot(...sub(v[(e + 1) % n], v[e]));
  const m = add(v[e], d, u * len);
  const s1 = add(m, d, -T / 2);
  const s2 = add(m, d, T / 2);
  const inward = [-d[1], d[0]];
  const pts = [s2];
  const rads = [0];
  for (let k = 1; k <= n; k++) { pts.push(v[(e + k) % n]); rads.push(rad); }
  pts.push(s1, add(s1, inward, T));
  rads.push(0, 0);
  for (let k = 0; k < n; k++) { pts.push(ins[(e - k + n) % n]); rads.push(Math.max(rad - T, 0.15)); }
  pts.push(add(s2, inward, T));
  rads.push(0);
  return roundPoly(pts, rads);
}

// Polyline a-b-c thickened to width w (square ends, mitred middle).
function stroke3(a, b, c, w) {
  const nrm = (p, q) => { const d = unit(sub(q, p)); return [-d[1], d[0]]; };
  const n1 = nrm(a, b);
  const n2 = nrm(b, c);
  const mid = unit(add(n1, n2));
  const k = w / 2 / (mid[0] * n1[0] + mid[1] * n1[1]);
  return roundPoly([add(a, n1, w / 2), add(b, mid, k), add(c, n2, w / 2), add(c, n2, -w / 2), add(b, mid, -k), add(a, n1, -w / 2)], [0.1, 0.12, 0.1, 0.1, 0.12, 0.1]);
}

// Wheel arch: concave arc cut into a body edge at height yEdge around a wheel at (cx, cy), left to right.
const arch = (cx, cy, r, yEdge) => {
  const dx = Math.sqrt(r * r - (yEdge - cy) ** 2);
  return arcPts(cx, cy, r, Math.atan2(yEdge - cy, -dx), Math.atan2(yEdge - cy, dx), 24);
};

const bbox = (outlines) => {
  const all = outlines.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};
const centred = (outlines) => { const [cx, cy] = bbox(outlines); return outlines.map((o) => shift(o, -cx, -cy)); };
const deepFreeze = (v) => (Array.isArray(v) ? Object.freeze(v.map(deepFreeze)) : v);

// Till: slanted display, keypad body, drawer with a handle notch.
function pos() {
  const body = ringC([[-2.9, -1.2], [2.9, -1.2], [2.6, 1.1], [-2.6, 1.1]], 0, 0.5);
  const keys = [];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 2; r++) {
    const x0 = -1.8 + c * 1.3;
    const y0 = -0.65 + r * 0.75;
    keys.push(rect(x0, y0, x0 + 1.0, y0 + 0.45, 0.12));
  }
  const display = roundPoly([[-1.6, 1.4], [1.6, 1.4], [1.2, 2.3], [-1.2, 2.3]], R);
  const drawer = roundPoly([[-3.3, -2.3], [-0.55, -2.3], [-0.55, -2.0], [0.55, -2.0], [0.55, -2.3], [3.3, -2.3], [3.3, -1.5], [-3.3, -1.5]],
    [R, 0.1, 0.1, 0.1, 0.1, R, R, R]);
  return [display, body, ...keys, drawer];
}

// Shelf boxes: two below, one on top; each has a lid slab and a body split by a tape strip.
function stock() {
  const LID = 0.5;
  const half = (xo, xi, y0, y1) => roundPoly([[xo, y0], [xi, y0], [xi, y1], [xo, y1]], [R, 0.08, 0.08, 0.1], 6);
  const box = (cx, y0, y1) => {
    const yb = y1 - LID - 0.25;
    return [rect(cx - 1.6, yb + 0.25, cx + 1.6, y1, 0.15), half(cx - 1.5, cx - T / 2, y0, yb), half(cx + 1.5, cx + T / 2, y0, yb)];
  };
  return [...box(-1.75, -2.3, -0.15), ...box(1.75, -2.3, -0.15), ...box(0, 0.15, 2.3)];
}

// Delivery truck: cargo box, cab with a window held by a bridge, two solid wheels.
function ordering() {
  const wheels = [[-2.0, -1.68], [2.2, -1.68]];
  const wr = 0.62;
  const ar = wr + T;
  const yb = -1.25;
  const cargo = roundPoly([[-3.5, yb], ...arch(wheels[0][0], wheels[0][1], ar, yb), [0.8, yb], [0.8, 2.3], [-3.5, 2.3]],
    [R, 0.12, ...new Array(23).fill(0), 0.12, R, R, R]);
  const cab = roundPoly([[1.1, yb], ...arch(wheels[1][0], wheels[1][1], ar, yb), [3.5, yb], [3.5, 0.15], [2.85, 1.5], [1.1, 1.5],
    [1.1, 0.7], [1.45, 0.7], [1.45, 1.15], [2.52, 1.15], [2.88, 0.4], [1.1, 0.4]],
  [R, 0.12, ...new Array(23).fill(0), 0.12, R, R, R, 0.2, 0, 0.1, 0.1, 0.1, 0.1, 0]);
  return [cargo, cab, ...wheels.map(([x, y]) => circle(x, y, wr))];
}

// Person (head and shoulders) beside a clock at ten past ten; the clock overlaps the shoulder.
function staff() {
  const [cx, cy, ro, ri] = [1.35, 0.15, 2.15, 1.85];
  const diag = (a) => [a - 0.085, a + 0.085];
  const ring = [0, 1, 2, 3].map((q) => {
    const [, s] = diag(Math.PI / 4 + (q * Math.PI) / 2);
    const [e] = diag(Math.PI / 4 + ((q + 1) * Math.PI) / 2);
    return arcBand(cx, cy, ri, ro, s, e);
  });
  const ticks = [0, 1, 2, 3].map((q) => {
    const a = (q * Math.PI) / 2;
    const d = [Math.cos(a), Math.sin(a)];
    const n = [-d[1], d[0]];
    const [p0, p1] = [add([cx, cy], d, 1.25), add([cx, cy], d, 1.55)];
    return roundPoly([add(p0, n, -0.15), add(p1, n, -0.15), add(p1, n, 0.15), add(p0, n, 0.15)], 0.08, 5);
  });
  const hand = (deg, len) => { const a = (deg * Math.PI) / 180; const d = [Math.cos(a), Math.sin(a)]; return { d, n: [-d[1], d[0]], len }; };
  const [h, m] = [hand(150, 0.62), hand(30, 0.95)];
  const tip = (k, s) => add(add([cx, cy], k.d, k.len), k.n, s * 0.14);
  const base = (k, s) => add([cx, cy], k.n, s * 0.2);
  const crotch = [cx, cy + 0.42];
  const hands = roundPoly([base(m, -1), tip(m, -1), tip(m, 1), crotch, tip(h, -1), tip(h, 1), base(h, 1), [cx, cy - 0.2]],
    [0.1, 0.1, 0.1, 0.12, 0.1, 0.1, 0.1, 0.2], 6);
  const dense = [];
  const body = roundPoly([[-3.5, -2.3], [-0.6, -2.3], [-0.6, 0.5], [-3.5, 0.5]], [0, 0, 1.0, 1.0], 14);
  body.forEach((p, i) => {
    const q = body[(i + 1) % body.length];
    const k = Math.max(1, Math.ceil(Math.hypot(...sub(q, p)) / 0.1));
    for (let j = 0; j < k; j++) dense.push(add(p, sub(q, p), j / k));
  });
  const pushR = ro + T;
  const shoulders = cw(dense.map((p) => {
    const dist = Math.hypot(p[0] - cx, p[1] - cy);
    return dist < pushR ? add([cx, cy], unit(sub(p, [cx, cy])), pushR) : p;
  }));
  return [shoulders, circle(-2.15, 1.5, 0.65), ...ring, ...ticks, hands];
}

// Price tag with a punched eyelet and a percent sign cut out of its face.
function cogs() {
  const frame = ringC([[-1.5, -1.4], [2.9, -1.4], [2.9, 1.4], [-1.5, 1.4], [-2.9, 0]], 0, 0.55);
  const eyelet = circle(-1.7, 0, 0.27);
  const dot = (x, y) => circle(x, y, 0.3, 40);
  const slash = roundPoly([[-0.4, -0.7], [-0.05, -0.7], [0.4, 0.7], [0.05, 0.7]], 0.1);
  const a = (-22 * Math.PI) / 180;
  const rot = ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  const [px, py] = rot([0.9, 0]);
  const pct = [dot(-0.62, 0.42), dot(0.62, -0.42), slash].map((o) => shift(o, px, py));
  return [...[frame, eyelet].map((o) => o.map(rot)), ...pct];
}

// Invoice: sheet with a folded corner, three text lines and a check mark.
function invoices() {
  const sheet = ringC([[-1.9, -2.3], [1.9, -2.3], [1.9, 1.35], [0.95, 2.3], [-1.9, 2.3]], 0, 0.5);
  const flap = roundPoly([[0.7, 1.1], [1.3, 1.1], [0.7, 1.7]], 0.1);
  const check = stroke3([-0.8, -0.85], [-0.25, -1.5], [0.85, -0.2], 0.4);
  return [sheet, flap, rect(-1.3, 1.4, 0.4, 1.7, 0.12), rect(-1.3, 0.8, 0.4, 1.1, 0.12), rect(-1.3, 0.2, 1.3, 0.5, 0.12), check];
}

export const ICONS = Object.freeze({
  pos: deepFreeze(centred(pos())),
  stock: deepFreeze(centred(stock())),
  ordering: deepFreeze(centred(ordering())),
  staff: deepFreeze(centred(staff())),
  cogs: deepFreeze(centred(cogs())),
  invoices: deepFreeze(centred(invoices())),
});
