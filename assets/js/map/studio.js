// The photo studio the steel reflects: one big soft key, two strips, a dark room. Baked once into a PMREM texture.
const ROOM = '#14110e';
const ROOM_SIZE = 140;

// [x, y, z, width, height, intensity, warm, gradient]; every light faces the middle of the room.
// The big ones fade across their face so a flat plate shows a soft gradient, not one flat white.
const LIGHTS = [
  [-26, 30, 44, 80, 50, 2.6, 0.5, true], // key: large, soft, up and to the left, behind the camera
  [58, 4, 12, 8, 80, 15, 0, false], // strip right
  [-60, -6, -6, 6, 80, 11, 0, false], // strip left
  [10, 70, -12, 60, 6, 7, 0.2, false], // overhead strip
  [30, -10, 55, 90, 70, 0.55, 0.3, true], // dim fill from the front right so shadowed steel is not pure black
  [0, -45, 30, 90, 14, 0.7, 0.4, false], // faint floor bounce
];

function fadeTexture(T3) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#a8a8a8');
  grad.addColorStop(1, '#3a3a3a');
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
