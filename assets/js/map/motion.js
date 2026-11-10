// Per-frame motion maths for the map. Plain arrays in, plain arrays out, so it runs in Node.
import { smoothstep, panelAssemble, assembleAmount } from './cues.js';

const lerp = (a, b, t) => a + (b - a) * t;

export const damp = (dt, rate) => 1 - Math.exp(-dt * rate);

// Overshoots past 1 and settles back; 0 -> 0 and 1 -> 1.
export function easeOutBack(t, c = 1.1) {
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

// 1 while the reader is inside the beat of panel `stop` (1..6), eased in just before and out after the hold.
export function focusAmount(T, stop) {
  return smoothstep((T - (stop - 0.2)) / 0.4) * (1 - smoothstep((T - (stop + 0.55)) / 0.4));
}

// Scratch arrays, filled in place every call so the frame loop allocates nothing.
const drift = [0, 0, 0];
const spin = [0, 0, 0];
const breath = [0, 0, 0];
const turned = [0, 0, 0];

// Where a panel is and how it is turned. `face` = [rx, ry] that makes it face the camera.
// Pass `out` ({ pos, rot } arrays) to have the result written there.
export function panelPose({ index, T, time, scatter, layout, face }, out = { pos: [0, 0, 0], rot: [0, 0, 0] }) {
  const s = panelAssemble(assembleAmount(T), index / 5);
  const a = easeOutBack(s);
  const free = 1 - s;
  const ph = index * 1.7;
  drift[0] = Math.sin(time * 0.35 + ph) * 0.7;
  drift[1] = Math.sin(time * 0.27 + ph * 1.3) * 0.55;
  drift[2] = Math.sin(time * 0.21 + ph * 0.8) * 0.9;
  spin[0] = Math.sin(time * 0.23 + ph) * 0.05;
  spin[1] = Math.sin(time * 0.19 + ph * 1.1) * 0.2;
  spin[2] = Math.sin(time * 0.29 + ph * 0.7) * 0.04;
  breath[0] = Math.sin(time * 0.4 + ph) * 0.018;
  breath[1] = Math.sin(time * 0.33 + ph) * 0.03;
  breath[2] = 0;
  turned[0] = face[0];
  turned[1] = face[1];
  turned[2] = 0;
  const focus = focusAmount(T, index + 1) * free;
  for (let k = 0; k < 3; k++) {
    out.pos[k] = lerp(scatter.pos[k] + drift[k] * free, layout[k], a);
    out.rot[k] = lerp(lerp(scatter.rot[k] + spin[k], turned[k], focus), breath[k], s);
  }
  return out;
}

// Point where the line from centre `c` toward `other` leaves a hx-by-hy panel, pushed out by `gap`.
// Pass `out` to have the point written there.
export function edgePoint(c, other, hx, hy, gap, out = [0, 0, 0]) {
  const dx = other[0] - c[0];
  const dy = other[1] - c[1];
  const dz = other[2] - c[2];
  const t = Math.min(hx / Math.max(Math.abs(dx), 1e-6), hy / Math.max(Math.abs(dy), 1e-6), 1);
  const len = Math.hypot(dx, dy, dz) || 1;
  out[0] = c[0] + dx * t + (dx / len) * gap;
  out[1] = c[1] + dy * t + (dy / len) * gap;
  out[2] = c[2] + dz * t + (dz / len) * gap;
  return out;
}
