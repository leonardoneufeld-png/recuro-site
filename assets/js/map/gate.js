// Decisions for the 3D map that need no browser: may it run, how to degrade, when to resize. No imports.
export const FPS_FLOOR = 40;
// 0 full (native pixels up to 3x), 1 at most 2x, 2 at most 1.5x, 3 no multisampling, 4 bloom off, 5 give up and show the stills
export const LAST_LEVEL = 5;
export const LEVEL = Object.freeze({ msaa: 3, bloom: 4 });
const PIXEL_RATIO_CAPS = [3, 2, 1.5]; // by level; the levels after keep the last
const LOW_MEMORY_GB = 2;
const REFRESH_FRACTION = 2 / 3;
const REFRESH_RATES = [30, 60, 90, 120, 144];
const COARSE_RESIZE_SLACK = 0.25;
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export function mayRun({ webgl2, reducedMotion, saveData, deviceMemory, force }) {
  if (!webgl2 || reducedMotion) return false;
  if (force) return true;
  if (saveData) return false;
  return !(typeof deviceMemory === 'number' && deviceMemory <= LOW_MEMORY_GB);
}

// The pixel ratio to render at: the device's own, capped by the level, so a sharp picture is only given up step by step.
export function pixelRatioFor(level, devicePixelRatio) {
  const native = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(native, PIXEL_RATIO_CAPS[Math.min(level, PIXEL_RATIO_CAPS.length - 1)]);
}

export const isLocalHost = (hostname) => LOCAL_HOSTS.includes(hostname);

// ?map=force turns the quality ladder off, but only while developing; a live visitor keeps it.
export const ladderActive = (force, hostname) => !(force && isLocalHost(hostname));

// Display refresh rate guessed from frame intervals (seconds): the median, snapped to a common rate.
// A 30 Hz cap (low power mode) therefore reads as 30, not as a slow device.
export function estimateRefreshHz(intervals) {
  const ok = intervals.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!ok.length) return 60;
  const hz = 1 / ok[Math.floor(ok.length / 2)];
  return REFRESH_RATES.reduce((best, r) => (Math.abs(r - hz) < Math.abs(best - hz) ? r : best));
}

// Steps down only when fps is under the floor and under two thirds of the display's own rate.
// `now` describes what is already applied, so a level that would change nothing is skipped.
export function nextLevel(fps, level, { refreshHz = 60, pixelRatio = 3, samples = 4, bloom = true } = {}) {
  if (level >= LAST_LEVEL) return LAST_LEVEL;
  if (!(fps < FPS_FLOOR && fps < refreshHz * REFRESH_FRACTION)) return level;
  const changesNothing = (l) => (l < LEVEL.msaa && pixelRatio <= PIXEL_RATIO_CAPS[l])
    || (l === LEVEL.msaa && samples <= 0) || (l === LEVEL.bloom && !bloom);
  let next = level + 1;
  while (next < LAST_LEVEL && changesNothing(next)) next += 1;
  return next;
}

// On a touch screen the toolbar collapsing changes only the height; do not rebuild render targets for that.
export function resizeMatters(prev, next, coarsePointer) {
  if (!coarsePointer || prev.width !== next.width) return true;
  return Math.abs(next.height - prev.height) / Math.max(prev.height, 1) >= COARSE_RESIZE_SLACK;
}
