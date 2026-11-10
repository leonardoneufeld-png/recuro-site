// Stencil icons: holes cut through a steel plate. Panel units, origin at panel centre, inside x,y in [-2.5, 2.5].
// Every outline is clockwise, at least 0.35 wide, and at least 0.35 from its neighbours. Pure data, no imports.

const area = (pts) => pts.reduce((s, [x, y], i) => {
  const [x2, y2] = pts[(i + 1) % pts.length];
  return s + (x * y2 - x2 * y);
}, 0) / 2;
const clockwise = (pts) => (area(pts) > 0 ? [...pts].reverse() : pts);

const rect = (x0, y0, x1, y1) => clockwise([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
const poly = (pts) => clockwise(pts);
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

function circle(cx, cy, r, n = 32) {
  return clockwise(Array.from({ length: n }, (_, i) => polar(cx, cy, r, (2 * Math.PI * i) / n)));
}

// Piece of a ring between radii r0 < r1 and angles a0 < a1 (radians, counter-clockwise from +x).
function arcSegment(r0, r1, a0, a1, steps = 8) {
  const at = (i) => a0 + ((a1 - a0) * i) / steps;
  const outer = Array.from({ length: steps + 1 }, (_, i) => polar(0, 0, r1, at(i)));
  const inner = Array.from({ length: steps + 1 }, (_, i) => polar(0, 0, r0, at(steps - i)));
  return clockwise([...outer, ...inner]);
}

const QUARTER = Math.PI / 2;
const BRIDGE = 0.14; // half-width of a diagonal bridge in radians: 0.45 of steel at the inner radius
const clockRing = [0, 1, 2, 3].map((q) => arcSegment(1.6, 2.4, q * QUARTER - QUARTER / 2 + BRIDGE, q * QUARTER + QUARTER / 2 - BRIDGE));

const deepFreeze = (v) => (Array.isArray(v) ? Object.freeze(v.map(deepFreeze)) : v);

export const ICONS = Object.freeze({
  // Till: screen, three keys, cash drawer.
  pos: deepFreeze([
    rect(-1.4, 1.4, 1.4, 2.3),
    rect(-2.35, 0.3, -1.05, 1.0),
    rect(-0.65, 0.3, 0.65, 1.0),
    rect(1.05, 0.3, 2.35, 1.0),
    rect(-2.35, -1.5, 2.35, -0.1),
  ]),
  // Shelf: two planks, three boxes above the upper one, two above the lower one.
  stock: deepFreeze([
    rect(-2.4, -0.05, 2.4, 0.4),
    rect(-2.4, -2.05, 2.4, -1.6),
    rect(-2.4, 0.8, -0.9, 2.05),
    rect(-0.5, 0.8, 0.7, 1.6),
    rect(1.1, 0.8, 2.4, 2.05),
    rect(-2.4, -1.2, -0.2, -0.45),
    rect(0.2, -1.2, 2.4, -0.45),
  ]),
  // Crate: lid, three slats, base.
  ordering: deepFreeze([
    rect(-2.4, 1.65, 2.4, 2.3),
    rect(-2.35, -1.35, -1.05, 1.25),
    rect(-0.65, -1.35, 0.65, 1.25),
    rect(1.05, -1.35, 2.35, 1.25),
    rect(-2.4, -2.3, 2.4, -1.75),
  ]),
  // Clock: ring broken into four arcs by diagonal bridges, a vertical and a short horizontal hand.
  staff: deepFreeze([
    ...clockRing,
    rect(-0.2, -0.2, 0.2, 1.2),
    rect(0.6, -0.2, 1.15, 0.2),
  ]),
  // Kitchen scale: pan, neck, round dial, two side blocks, base.
  cogs: deepFreeze([
    poly([[-2, 2.35], [2, 2.35], [1.5, 1.5], [-1.5, 1.5]]),
    rect(-0.2, 0.7, 0.2, 1.1),
    circle(0, -0.6, 0.9),
    rect(-2.35, -1.5, -1.4, -0.1),
    rect(1.4, -1.5, 2.35, -0.1),
    rect(-2.35, -2.35, 2.35, -1.9),
  ]),
  // Sheet: four text lines of different lengths and the folded corner.
  invoices: deepFreeze([
    poly([[1.3, 2.35], [2.35, 2.35], [2.35, 1.3]]),
    rect(-2.35, 1.1, 0.8, 1.6),
    rect(-2.35, 0.2, 2.35, 0.7),
    rect(-2.35, -0.7, 1.4, -0.2),
    rect(-2.35, -1.6, -0.2, -1.1),
  ]),
});
