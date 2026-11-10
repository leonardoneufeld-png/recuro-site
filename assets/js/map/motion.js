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

// Where a panel is and how it is turned. `face` = [rx, ry] that makes it face the camera.
export function panelPose({ index, T, time, scatter, layout, face }) {
  const s = panelAssemble(assembleAmount(T), index / 5);
  const a = easeOutBack(s);
  const free = 1 - s;
  const ph = index * 1.7;
  const drift = [Math.sin(time * 0.35 + ph) * 0.7, Math.sin(time * 0.27 + ph * 1.3) * 0.55, Math.sin(time * 0.21 + ph * 0.8) * 0.9];
  const spin = [Math.sin(time * 0.23 + ph) * 0.05, Math.sin(time * 0.19 + ph * 1.1) * 0.2, Math.sin(time * 0.29 + ph * 0.7) * 0.04];
  const focus = focusAmount(T, index + 1) * free;
  const turned = [face[0], face[1], 0];
  const breath = [Math.sin(time * 0.4 + ph) * 0.018, Math.sin(time * 0.33 + ph) * 0.03, 0];
  const pos = scatter.pos.map((v, k) => lerp(v + drift[k] * free, layout[k], a));
  const rot = scatter.rot.map((v, k) => lerp(lerp(v + spin[k], turned[k], focus), breath[k], s));
  return { pos, rot };
}

// Point where the line from centre `c` toward `other` leaves a hx-by-hy panel, pushed out by `gap`.
export function edgePoint(c, other, hx, hy, gap) {
  const d = other.map((v, k) => v - c[k]);
  const t = Math.min(hx / Math.max(Math.abs(d[0]), 1e-6), hy / Math.max(Math.abs(d[1]), 1e-6), 1);
  const len = Math.hypot(...d) || 1;
  return c.map((v, k) => v + d[k] * t + (d[k] / len) * gap);
}
