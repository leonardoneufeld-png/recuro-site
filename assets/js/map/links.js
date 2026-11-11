// Light that flows between plates: curved ribbons drawn by a shader. Each ribbon is a gentle arc between two plate edges
// with a bright thin core and a feathered edge, a soft head while it draws in, and a few soft highlights that travel
// along it continuously. Everything is a function of time and uniforms, so nothing ever switches on in one frame.
const HALF_W = 6.1; // plate rim, bevel included
const HALF_H = 4.1;
const TUCK = 0.3; // the ribbon ends this far under the plate, so the join is hidden
const RIM_LEN = 5;
const RIM_WIDTH = 0.9;
const RIM_GAIN = 1.5;
const RIM_Z = 0.31; // just in front of the plate's face
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
  float tz = (u - uHead) / 0.035;
  float tip = exp(-tz * tz) * (1.0 - smoothstep(0.86, 1.0, uHead));
  float flow = bump(u, uPhase.x, ${SPREAD[0]}) + 0.8 * bump(u, uPhase.y, ${SPREAD[1]}) + 0.6 * bump(u, uPhase.z, ${SPREAD[2]});
  float line = (0.5 + 0.8 * flow) * drawn;
  float wz = (u - uWaveU) / 0.12;
  float wave = exp(-wz * wz) * uWaveGain;
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

// Where the plate's rim picks up the light of a link that meets it: a short bright stretch centred on the join.
const RIM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
void main() {
  float az = (vUv.x - 0.5) / 0.2;
  float along = exp(-az * az);
  float v = clamp(vUv.y, 0.0, 1.0); // a negative sqrt or pow input would give NaN, and bloom spreads one NaN pixel over the whole screen
  float across = v * v * v;
  gl_FragColor = vec4(uColor * uGain * along * across, 1.0);
}`;
const RIM_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function buildLinks(T3, ring, threads, signal = '#f0c987', plates = {}) {
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
  const rimGeometry = new T3.PlaneGeometry(RIM_LEN, RIM_WIDTH);
  owned.push(rimGeometry);
  const makeRim = (plate) => {
    const material = new T3.ShaderMaterial({
      uniforms: { uColor: shared.uColor, uGain: { value: 0 } }, vertexShader: RIM_VERT, fragmentShader: RIM_FRAG,
      transparent: true, depthWrite: false, blending: T3.AdditiveBlending,
    });
    const mesh = new T3.Mesh(rimGeometry, material);
    mesh.visible = false;
    plate.add(mesh);
    owned.push(material);
    return mesh;
  };
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
    const rims = [makeRim(plates[link.from]), makeRim(plates[link.to])];
    return { link, mesh, geometry, u, rims, seed: (k * 0.37) % 1 };
  };
  const ringItems = ring.map((l, k) => make(l, k));
  const threadItems = threads.map((l, k) => make(l, k + 3));

  const ea = [0, 0, 0];
  const eb = [0, 0, 0];
  const other = new T3.Vector3();
  const world = new T3.Vector3();
  const join = [[0, 0], [0, 0]];
  // The point where a ribbon meets `plate` on the way to the plate at `toPos`: on the rim, in the plate's own frame
  // (so tilted and shrunken plates still get it right), pushed under the plate by TUCK. Returns the world point in `out`.
  function rimPoint(plate, toPos, out, slot) {
    other.copy(toPos);
    plate.worldToLocal(other);
    const dx = other.x;
    const dy = other.y;
    const t = Math.min(HALF_W / Math.max(Math.abs(dx), 1e-6), HALF_H / Math.max(Math.abs(dy), 1e-6));
    const len = Math.hypot(dx, dy) || 1;
    const jx = dx * t - (dx / len) * TUCK;
    const jy = dy * t - (dy / len) * TUCK;
    join[slot][0] = dx * t;
    join[slot][1] = dy * t;
    world.set(jx, jy, 0);
    plate.localToWorld(world);
    out[0] = world.x; out[1] = world.y; out[2] = world.z;
  }
  // Lay a rim pick-up along the edge the join sits on, centred on the join.
  function setRim(mesh, slot, gain) {
    mesh.visible = gain > 0.003;
    if (!mesh.visible) return;
    const [jx, jy] = join[slot];
    const sideways = Math.abs(jx) / HALF_W > Math.abs(jy) / HALF_H;
    const inset = RIM_WIDTH / 2 - 0.05;
    if (sideways) {
      const sx = Math.sign(jx) || 1;
      mesh.position.set(sx * (HALF_W - inset), jy, RIM_Z);
      mesh.rotation.z = -sx * Math.PI / 2;
    } else {
      const sy = Math.sign(jy) || 1;
      mesh.position.set(jx, sy * (HALF_H - inset), RIM_Z);
      mesh.rotation.z = sy > 0 ? 0 : Math.PI;
    }
    mesh.material.uniforms.uGain.value = gain;
  }
  function place(item, positions, head, gain, time) {
    const { mesh, geometry, u, link, rims } = item;
    const live = gain > 0.003 && head > 0.003;
    mesh.visible = live;
    if (!live) { rims[0].visible = rims[1].visible = false; return; }
    rimPoint(plates[link.from], positions[link.to], ea, 0);
    rimPoint(plates[link.to], positions[link.from], eb, 1);
    arc(ea, eb, geometry.attributes.position.array, geometry.attributes.aTan.array);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aTan.needsUpdate = true;
    u.uHead.value = head;
    u.uGain.value = gain;
    u.uPhase.value.set((time * SPEEDS[0] + item.seed) % 1, (time * SPEEDS[1] + item.seed * 1.7 + 0.33) % 1, (time * SPEEDS[2] + item.seed * 2.3 + 0.66) % 1);
    const sway = 0.85 + 0.15 * Math.sin(time * 0.9 + item.seed * 6);
    setRim(rims[0], 0, gain * RIM_GAIN * Math.min(1, head * 8) * sway);
    setRim(rims[1], 1, gain * RIM_GAIN * Math.min(1, Math.max(0, (head - 0.9) * 10)) * sway);
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
