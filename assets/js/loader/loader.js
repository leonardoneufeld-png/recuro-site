// Loading screen over the 3D map's start-up: DOM and timing. The inline head script in index.html decides whether it
// shows (html.loading) and uncovers the page after 5 s if this module never runs.
import { fibonacciSphere, projectDots } from './orb.js';

export const MIN_MS = 600; // shorter than this reads as a flash
export const CAP_MS = 3500; // a slow map never holds the page longer; the stills show and the map fades in later
const FADE_MS = 400; // matches the .loader transition in site.css
const SETTLE_FRAMES = 3; // the map swaps its stills for the canvas two frames after it reports ready
const DOTS = 200;
const TURN_SECONDS = 9;
const TILT = 0.35;
const ORB_FILL = 0.42; // sphere radius as a share of the canvas
const MAX_DPR = 2;
// any input ends it: nobody is held on a loading screen, and Tab never lands on something hidden behind it
const INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'];

// both times are milliseconds since navigation start (performance.now())
export const exitDelay = (now) => Math.max(0, MIN_MS - now);

// shortcut: drawn on the main thread, so it can stutter while the map compiles its shaders; move it to an
// OffscreenCanvas worker if that shows on real phones
function drawOrb(canvas) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const size = Math.round(canvas.clientWidth * dpr);
  canvas.width = canvas.height = size;
  const points = fibonacciSphere(DOTS);
  const centre = size / 2, radius = size * ORB_FILL;
  ctx.fillStyle = getComputedStyle(canvas).color;
  let raf = 0;
  const tick = (ms) => {
    ctx.clearRect(0, 0, size, size);
    for (const d of projectDots(points, (ms / 1000 / TURN_SECONDS) * 2 * Math.PI, TILT)) {
      ctx.globalAlpha = 0.18 + 0.82 * d.depth;
      ctx.beginPath();
      ctx.arc(centre + d.x * radius, centre + d.y * radius, (0.45 + 0.75 * d.depth) * dpr, 0, 2 * Math.PI);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

const afterFrames = (n, fn) => (n ? requestAnimationFrame(() => afterFrames(n - 1, fn)) : fn());

// Returns mapReady(): call it when the map's first frame is up, or when the map gave up.
export function initLoader(root = document.documentElement) {
  const el = document.querySelector('.loader');
  if (!el || !root.classList.contains('loading')) return () => {};
  const stopOrb = drawOrb(el.querySelector('.loader-orb'));
  let leaving = false, wait = 0, cap = 0;
  const leave = () => {
    if (leaving) return;
    leaving = true;
    clearTimeout(wait);
    clearTimeout(cap);
    INPUTS.forEach((type) => removeEventListener(type, leave));
    root.classList.add('loading-out');
    setTimeout(() => { root.classList.remove('loading', 'loading-out'); stopOrb(); }, FADE_MS);
  };
  cap = setTimeout(leave, Math.max(0, CAP_MS - performance.now()));
  INPUTS.forEach((type) => addEventListener(type, leave, { passive: true }));
  return () => afterFrames(SETTLE_FRAMES, () => { if (!leaving) wait = setTimeout(leave, exitDelay(performance.now())); });
}
