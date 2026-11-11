// Light that flows between plates: curved ribbons drawn by a shader. Each ribbon is a gentle arc between two plate edges
// with a bright thin core and a feathered edge, a soft head while it draws in, and a few soft highlights that travel
// along it continuously. Everything is a function of time and uniforms, so nothing ever switches on in one frame.
import { edgePoint } from './motion.js';

const HALF_W = 6.2;
const HALF_H = 4.2;
const GAP = 0.5;
const SEG = 44;
const HALF_WIDTH = 0.34; // world units, across the ribbon, before the shader feathers it
const ARC_SIDE = 0.15; // sideways bulge as a share of the length
const ARC_DEPTH = 0.1; // bulge toward the camera
const SPEEDS = [0.075, 0.105, 0.14]; // highlights per second along the ribbon: different on purpose
const SPREAD = [0.11, 0.075, 0.095];

const VERT = /* glsl */ `
attribute float aU;
attribute float aSide;
attribute vec3 aTan;
uniform float uWidth;
varying vec2 vUv;
void main() {
  vUv = vec2(aU, aSide);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 t = mat3(modelViewMatrix) * aTan;
  vec2 n = normalize(vec2(-t.y, t.x) + vec2(1e-5, 0.0));
  mv.xy += n * aSide * uWidth;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFeather;
uniform float uHead;
uniform float uGain;
uniform vec3 uPhase;
uniform float uWaveU;
uniform float uWaveGain;
varying vec2 vUv;
float bump(float u, float c, float w) {
  float d = abs(fract(u - c + 0.5) - 0.5); // distance on a loop, so a highlight that leaves at one end enters at the other
  return exp(-(d * d) / (w * w));
}
void main() {
  float u = vUv.x;
  float a = abs(vUv.y);
  float profile = (exp(-a * a * 15.0) + 0.3 * uFeather * exp(-a * a * 3.4)) * (1.0 - smoothstep(0.72, 1.0, a));
  float reach = uHead * 1.16;
  float drawn = 1.0 - smoothstep(reach - 0.16, reach, u); // soft head that fades back into the line
  float tip = exp(-pow((u - uHead) / 0.035, 2.0)) * (1.0 - smoothstep(0.86, 1.0, uHead));
  float ends = smoothstep(0.0, 0.07, u) * (1.0 - smoothstep(0.93, 1.0, u));
  float flow = bump(u, uPhase.x, ${SPREAD[0]}) + 0.8 * bump(u, uPhase.y, ${SPREAD[1]}) + 0.6 * bump(u, uPhase.z, ${SPREAD[2]});
  float line = (0.5 + 0.8 * flow) * drawn * ends;
  float wave = exp(-pow((u - uWaveU) / 0.12, 2.0)) * uWaveGain * ends;
  float light = profile * (uGain * (line + 1.6 * tip) + wave * 2.2);
  gl_FragColor = vec4(uColor * light, 1.0);
}`;

// Edge-to-edge arc: a quadratic curve whose bulge is the same whichever way the link is drawn, so a thread and the
// ring link between the same two plates lie on one curve.
function arc(ca, cb, outP, outT) {
  const dx = cb[0] - ca[0];
  const dy = cb[1] - ca[1];
  const dz = cb[2] - ca[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  let nx = -dy;
  let ny = dx;
  if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const nl = Math.hypot(nx, ny) || 1;
  const kx = ((ca[0] + cb[0]) / 2 + (nx / nl) * len * ARC_SIDE) * 2;
  const ky = ((ca[1] + cb[1]) / 2 + (ny / nl) * len * ARC_SIDE) * 2;
  const kz = ((ca[2] + cb[2]) / 2 + len * ARC_DEPTH) * 2;
  // control = k / 2 * 2 - ...: B(t) = (1-t)^2 a + 2(1-t)t c + t^2 b with c = k / 2
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const m = 1 - t;
    const w0 = m * m;
    const w1 = m * t; // times 2 c = k
    const w2 = t * t;
    const p = i * 6;
    outP[p] = outP[p + 3] = w0 * ca[0] + w1 * kx + w2 * cb[0];
    outP[p + 1] = outP[p + 4] = w0 * ca[1] + w1 * ky + w2 * cb[1];
    outP[p + 2] = outP[p + 5] = w0 * ca[2] + w1 * kz + w2 * cb[2];
    outT[p] = outT[p + 3] = 2 * m * (kx / 2 - ca[0]) + 2 * t * (cb[0] - kx / 2);
    outT[p + 1] = outT[p + 4] = 2 * m * (ky / 2 - ca[1]) + 2 * t * (cb[1] - ky / 2);
    outT[p + 2] = outT[p + 5] = 2 * m * (kz / 2 - ca[2]) + 2 * t * (cb[2] - kz / 2);
  }
}

export function buildLinks(T3, ring, threads, signal = '#f0c987') {
  const group = new T3.Group();
  const base = new T3.Color(signal);
  const shared = { uColor: { value: base }, uFeather: { value: 1 }, uWidth: { value: HALF_WIDTH } };
  const aU = new Float32Array((SEG + 1) * 2);
  const aSide = new Float32Array((SEG + 1) * 2);
  const index = [];
  for (let i = 0; i <= SEG; i++) {
    aU[i * 2] = aU[i * 2 + 1] = i / SEG;
    aSide[i * 2] = -1;
    aSide[i * 2 + 1] = 1;
    if (i < SEG) { const v = i * 2; index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
  }
  const owned = [];
  const make = (link, k) => {
    const geometry = new T3.BufferGeometry();
    geometry.setAttribute('position', new T3.BufferAttribute(new Float32Array((SEG + 1) * 6), 3));
    geometry.setAttribute('aTan', new T3.BufferAttribute(new Float32Array((SEG + 1) * 6), 3));
    geometry.setAttribute('aU', new T3.BufferAttribute(aU, 1));
    geometry.setAttribute('aSide', new T3.BufferAttribute(aSide, 1));
    geometry.setIndex(index);
    const u = {
      ...shared, uHead: { value: 0 }, uGain: { value: 0 }, uPhase: { value: new T3.Vector3() },
      uWaveU: { value: -9 }, uWaveGain: { value: 0 },
    };
    const material = new T3.ShaderMaterial({
      uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide,
    });
    const mesh = new T3.Mesh(geometry, material);
    mesh.frustumCulled = false; // the curve is rewritten every frame; its bounds are not tracked
    mesh.visible = false;
    group.add(mesh);
    owned.push(geometry, material);
    return { link, mesh, geometry, u, seed: (k * 0.37) % 1 };
  };
  const ringItems = ring.map((l, k) => make(l, k));
  const threadItems = threads.map((l, k) => make(l, k + 3));

  const pa = [0, 0, 0];
  const pb = [0, 0, 0];
  const ca = [0, 0, 0];
  const cb = [0, 0, 0];
  const ea = [0, 0, 0];
  const eb = [0, 0, 0];
  function place(item, positions, head, gain, time) {
    const { mesh, geometry, u, link } = item;
    mesh.visible = gain > 0.003 && head > 0.003;
    if (!mesh.visible) return;
    positions[link.from].toArray(ca);
    positions[link.to].toArray(cb);
    edgePoint(ca, cb, HALF_W, HALF_H, GAP, ea);
    edgePoint(cb, ca, HALF_W, HALF_H, GAP, eb);
    arc(ea, eb, geometry.attributes.position.array, geometry.attributes.aTan.array);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aTan.needsUpdate = true;
    u.uHead.value = head;
    u.uGain.value = gain;
    u.uPhase.value.set((time * SPEEDS[0] + item.seed) % 1, (time * SPEEDS[1] + item.seed * 1.7 + 0.33) % 1, (time * SPEEDS[2] + item.seed * 2.3 + 0.66) % 1);
  }

  // s: { time, ring[], threads[] (draw amounts), ringGain, threadGain, wave, waveGain, cycle[] ({order, reversed}) }
  function update(positions, s) {
    ringItems.forEach((item, i) => {
      place(item, positions, 1, s.ringGain, s.time);
      const c = s.cycle[i];
      const local = s.wave - c.order;
      item.u.uWaveU.value = c.reversed ? 1 - local : local;
      item.u.uWaveGain.value = s.waveGain * s.ringGain;
    });
    threadItems.forEach((item, i) => place(item, positions, s.threads[i], s.threadGain, s.time));
  }

  // without bloom the feathered edge has to carry the glow itself
  const setBloom = (on) => { shared.uFeather.value = on ? 1 : 1.7; };
  const dispose = () => owned.forEach((o) => o.dispose());
  return { group, update, setBloom, dispose };
}
