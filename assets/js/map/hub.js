// The hub in the middle of the assembled map: a small steel plate carrying the Recuro wordmark as gold light. The six panels
// connect to it through spokes (links.js). It leans toward the pointer, and the engine lets it send a pulse round the ring.
import { capRadiance } from './panels.js';
import { COOL_FACE, WARM_FACE, COOL_BEVEL, WARM_BEVEL } from './look.js';

const W = 9;
const H = 4;
const RADIUS = 0.7;
const DEPTH = 0.3;
const BEVEL = 0.06;
const FACE_Z = DEPTH / 2 + BEVEL + 0.01;
const LABEL_W = 7.2;
const TEX_W = 1024;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uGain;
uniform float uTime;
varying vec2 vUv;
void main() {
  float m = texture2D(uMap, vUv).r;
  float swell = 1.0 + 0.05 * sin(uTime * 0.8 + vUv.x * 5.0);
  vec3 hot = vec3(1.0, 0.56, 0.16);
  gl_FragColor = vec4(mix(uColor, hot, 0.35) * m * uGain * swell, 1.0);
}`;

function plateShape(T3) {
  const s = new T3.Shape();
  const [x0, y0, x1, y1] = [-W / 2, -H / 2, W / 2, H / 2];
  s.moveTo(x0 + RADIUS, y0);
  s.lineTo(x1 - RADIUS, y0);
  s.absarc(x1 - RADIUS, y0 + RADIUS, RADIUS, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - RADIUS);
  s.absarc(x1 - RADIUS, y1 - RADIUS, RADIUS, 0, Math.PI / 2, false);
  s.lineTo(x0 + RADIUS, y1);
  s.absarc(x0 + RADIUS, y1 - RADIUS, RADIUS, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + RADIUS);
  s.absarc(x0 + RADIUS, y0 + RADIUS, RADIUS, Math.PI, Math.PI * 1.5, false);
  return s;
}

// "recuro" in the page's own font with a smaller ".ch", like the header wordmark: white on black, used as a mask.
function paintLabel(canvas) {
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const family = '"Schibsted Grotesk", system-ui, sans-serif';
  const size = h * 0.62;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#fff';
  if ('letterSpacing' in g) g.letterSpacing = `${-0.04 * size}px`;
  g.font = `600 ${size}px ${family}`;
  const main = g.measureText('recuro').width;
  g.font = `400 ${size * 0.58}px ${family}`;
  const tail = g.measureText('.ch').width;
  const x0 = (w - (main + tail)) / 2;
  const base = h * 0.5 + size * 0.34;
  g.font = `600 ${size}px ${family}`;
  g.fillText('recuro', x0, base);
  g.globalAlpha = 0.75;
  g.font = `400 ${size * 0.58}px ${family}`;
  g.fillText('.ch', x0 + main, base);
  g.globalAlpha = 1;
}

export function buildHub(T3, signal) {
  const group = new T3.Group();
  const geometry = new T3.ExtrudeGeometry(plateShape(T3), {
    depth: DEPTH, bevelEnabled: true, bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 3, curveSegments: 10,
  });
  geometry.translate(0, 0, -DEPTH / 2);
  const face = new T3.MeshPhysicalMaterial({ color: 0xd2d4d8, metalness: 1, roughness: 0.42, transparent: true });
  const bevel = new T3.MeshPhysicalMaterial({ color: 0xbfc2c8, metalness: 1, roughness: 0.12, transparent: true });
  face.emissive.set(signal); bevel.emissive.set(signal);
  face.emissiveIntensity = 0; bevel.emissiveIntensity = 0;
  capRadiance(face); capRadiance(bevel);
  group.add(new T3.Mesh(geometry, [face, bevel]));

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = Math.round((TEX_W * 2.3) / LABEL_W);
  paintLabel(canvas);
  const texture = new T3.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const labelMat = new T3.ShaderMaterial({
    uniforms: { uMap: { value: texture }, uColor: { value: new T3.Color(signal) }, uGain: { value: 0 }, uTime: { value: 0 } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: T3.AdditiveBlending,
  });
  const label = new T3.Mesh(new T3.PlaneGeometry(LABEL_W, 2.3), labelMat);
  label.position.z = FACE_Z;
  group.add(label);
  group.userData = { half: [W / 2 + BEVEL, H / 2 + BEVEL], faceZ: FACE_Z + 0.01 };
  group.visible = false;

  // the font may arrive after the first paint: draw the label again once it has
  const fonts = document.fonts;
  if (fonts?.load) fonts.load('600 64px "Schibsted Grotesk"').then(() => { paintLabel(canvas); texture.needsUpdate = true; }).catch(() => {});

  const [cf, wf, cb, wb] = [COOL_FACE, WARM_FACE, COOL_BEVEL, WARM_BEVEL].map((c) => new T3.Color(...c));
  // level 0..1 (appearing), hover 0..1 (pointer on it), warm 0..1 (the map is joined up), tilt = [x, y] radians
  function update({ level, hover, warm, tiltX, tiltY, time, scale }) {
    group.visible = level > 0.01;
    if (!group.visible) return;
    group.scale.setScalar(scale * (0.78 + 0.22 * level));
    group.rotation.set(tiltX, tiltY, 0);
    face.opacity = bevel.opacity = level;
    face.depthWrite = bevel.depthWrite = level >= 0.98;
    face.color.copy(cf).lerp(wf, warm).multiplyScalar(0.8);
    bevel.color.copy(cb).lerp(wb, warm);
    labelMat.uniforms.uGain.value = level * (1.25 + 0.6 * hover);
    labelMat.uniforms.uTime.value = time;
    bevel.emissiveIntensity = hover * 0.35;
    face.emissiveIntensity = hover * 0.04;
  }
  const dispose = () => { geometry.dispose(); face.dispose(); bevel.dispose(); label.geometry.dispose(); labelMat.dispose(); texture.dispose(); };
  return { group, update, dispose };
}
