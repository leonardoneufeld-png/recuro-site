// Brushed-steel data textures, painted on a canvas at boot. Streaks run along u (horizontal on the plate).
const SIZE = 256;
const REPEAT = 0.22; // texture tiles per panel unit: roughly one tile across a 4.5 unit square

function streakRows() {
  // deterministic noise (no Math.random): sum of sines at unrelated frequencies, plus a hash for hairlines
  return Array.from({ length: SIZE }, (_, y) => {
    const hash = Math.abs(Math.sin(y * 127.1) * 43758.5453) % 1;
    const wave = Math.sin(y * 0.9) * 0.5 + Math.sin(y * 2.3 + 1) * 0.3 + Math.sin(y * 0.21) * 0.2;
    return Math.min(1, Math.max(0, 0.55 + wave * 0.25 + (hash - 0.5) * 0.5));
  });
}

function paint(rows, colour) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  rows.forEach((v, y) => { g.fillStyle = colour(v); g.fillRect(0, y, SIZE, 1); });
  return c;
}

function make(T3, canvas) {
  const t = new T3.CanvasTexture(canvas);
  t.wrapS = t.wrapT = T3.RepeatWrapping;
  t.repeat.set(REPEAT, REPEAT);
  t.anisotropy = 8;
  t.colorSpace = T3.LinearSRGBColorSpace;
  return t;
}

// anisotropyMap: rg = direction (1, 0), b = strength. roughnessMap: g = roughness multiplier.
export function brushTextures(T3) {
  const rows = streakRows();
  const dir = paint(rows, (v) => `rgb(255,128,${Math.round(150 + v * 105)})`);
  const rough = paint(rows, (v) => { const n = Math.round(185 + v * 70); return `rgb(${n},${n},${n})`; });
  return { anisotropyMap: make(T3, dir), roughnessMap: make(T3, rough) };
}
