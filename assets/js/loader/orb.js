// Maths for the loading orb: dots on a sphere and their flat projection. No DOM, no imports.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// n points spread evenly over the unit sphere, as [x, y, z]
export function fibonacciSphere(n) {
  return Array.from({ length: n }, (_, i) => {
    const y = n === 1 ? 0 : 1 - (2 * i) / (n - 1);
    const r = Math.sqrt(1 - y * y);
    const a = i * GOLDEN_ANGLE;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
}

// Turn the sphere by `spin` around its vertical axis, lean it by `tilt` towards the viewer, look straight at it.
// x and y land in the unit disc; depth is 0 at the back and 1 at the front.
export function projectDots(points, spin, tilt) {
  const cs = Math.cos(spin), ss = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
  return points.map(([px, py, pz]) => {
    const x = px * cs + pz * ss;
    const z = pz * cs - px * ss;
    return { x, y: py * ct - z * st, depth: (py * st + z * ct + 1) / 2 };
  });
}
