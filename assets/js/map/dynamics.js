// How the map reacts to how fast the page is scrolled, not only to where it is: plates lean against the direction of travel
// and settle with a soft overshoot, the thread head stretches, the room light sweeps faster. At rest all of it is exactly 0.
import { nextScrollSpeed, springStep } from './motion.js';

const LEAN_PER_SPEED = 0.05; // rad per screen/s: about 2.5 degrees at an ordinary scroll
const LEAN_MAX = 0.07; // 4 degrees
const STRETCH_PER_SPEED = 0.35;
const SWEEP_PER_SPEED = 0.8;
const SPEED_CAP = 2;

export function createDynamics() {
  let lastY = null;
  let speed = 0;
  const lean = { x: 0, v: 0 };
  const out = { speed: 0, lean: 0, stretch: 0, sweep: 1 };
  return function step({ dt, scrollY, vh }) {
    const dy = lastY === null ? 0 : scrollY - lastY;
    lastY = scrollY;
    speed = nextScrollSpeed(speed, dy, dt, vh);
    const target = Math.max(-LEAN_MAX, Math.min(LEAN_MAX, speed * LEAN_PER_SPEED));
    springStep(lean, target, dt);
    const a = Math.min(Math.abs(speed), SPEED_CAP);
    out.speed = speed;
    out.lean = lean.x;
    out.stretch = a * STRETCH_PER_SPEED;
    out.sweep = 1 + a * SWEEP_PER_SPEED;
    return out;
  };
}
