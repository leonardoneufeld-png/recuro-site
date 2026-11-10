// Decisions for the 3D map that need no browser: may it run, and when to drop quality. No imports.
export const FPS_FLOOR = 40;
// 0 full, 1 lower resolution, 2 bloom off, 3 give up and show the stills
export const LAST_LEVEL = 3;
const LOW_MEMORY_GB = 2;

export function mayRun({ webgl2, reducedMotion, saveData, deviceMemory, force }) {
  if (!webgl2 || reducedMotion) return false;
  if (force) return true;
  if (saveData) return false;
  return !(typeof deviceMemory === 'number' && deviceMemory <= LOW_MEMORY_GB);
}

export function nextLevel(fps, level) {
  if (level >= LAST_LEVEL) return LAST_LEVEL;
  return fps < FPS_FLOOR ? level + 1 : level;
}
