// The photo studio the steel reflects: one big soft key, two strips, a dark room. Baked once into a PMREM texture.
const ROOM = '#14110e';
const ROOM_SIZE = 140;

// [x, y, z, width, height, intensity, warm, gradient]; every light faces the middle of the room.
// Luminances stay under the bloom threshold in engine.js, so the steel never glows; only the links and glints do.
// The key is a small-ish box behind the camera: at any plate angle it covers only part of the face, with a soft edge
// (gradient) crossing it. Everything else is dark, so the rest of the face falls to mid-grey.
const LIGHTS = [
  [-18, 14, 60, 40, 26, 1.1, 0.5, true], // key, up and to the left, behind the camera
  [58, 6, 14, 6, 80, 1.0, 0, false], // strip right: lights the right bevels
  [-58, -4, -4, 5, 80, 0.85, 0, false], // strip left
  [10, 66, -10, 60, 5, 0.9, 0.2, false], // overhead strip: lights the top bevels
  [30, -10, 55, 90, 70, 0.085, 0.3, true], // very dim fill so shadowed steel is not black
  [0, -50, 25, 80, 8, 0.3, 0.4, false], // faint floor strip for the bottom bevels
];

function fadeTexture(T3) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 128);
  // steep falloff: a bright band, then quickly dark (stops are sRGB, so 130 is about a fifth of the light)
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#ececec');
  grad.addColorStop(0.5, '#828282');
  grad.addColorStop(0.72, '#2d2d2d');
  grad.addColorStop(1, '#1c1c1c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new T3.CanvasTexture(c);
}

export function buildEnvironment(T3, renderer) {
  const studio = new T3.Scene();
  const disposables = [];
  const room = new T3.Mesh(new T3.BoxGeometry(ROOM_SIZE, ROOM_SIZE, ROOM_SIZE), new T3.MeshBasicMaterial({ color: ROOM, side: T3.DoubleSide }));
  studio.add(room);
  disposables.push(room);
  const fade = fadeTexture(T3);
  for (const [x, y, z, w, h, k, warm, soft] of LIGHTS) {
    const mat = new T3.MeshBasicMaterial({ side: T3.DoubleSide, map: soft ? fade : null });
    mat.color.setRGB(k * (1 + warm * 0.08), k * (1 - warm * 0.02), k * (1 - warm * 0.12));
    const m = new T3.Mesh(new T3.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    studio.add(m);
    disposables.push(m);
  }
  const pmrem = new T3.PMREMGenerator(renderer);
  const target = pmrem.fromScene(studio, 0.035);
  pmrem.dispose();
  fade.dispose();
  for (const m of disposables) { m.geometry.dispose(); m.material.dispose(); }
  return target.texture;
}
