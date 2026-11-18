import { solveAxes } from './motion.js';
import { bowNormal, smoothstep } from './cues.js';
import { MASK_GLSL } from './textmask.js';

// Light that flows between plates: curved ribbons drawn by a shader. Each ribbon is a gentle arc between two plate edges
// with a bright thin core and a feathered edge, a soft head while it draws in, and a few soft highlights that travel
// along it continuously. Everything is a function of time and uniforms, so nothing ever switches on in one frame.
const DEFAULT_HALF = [6.1, 4.1]; // plate rim, bevel included; a plate may carry its own in userData.half
const DEFAULT_RADIUS = 0.7; // its corner radius, bevel included (panels.js: 0.6 + 0.1); a plate may carry its own in userData.radius
const TUCK = 0.3; // the ribbon ends this far under the plate, so the join is hidden
const RIM_LEN = 5;
const RIM_WIDTH = 0.9;
const RIM_GAIN = 1.5;
const CORNER_BAND = 0.18; // share of the plate's half size around a corner diagonal where the rim pick-up fades
const RIM_Z = 0.31; // just in front of the plate's face
const SEG = 44;
const HALF_WIDTH = 0.34; // world units, across the ribbon, before the shader feathers it
const BOW = 0.13; // bulge as a share of the link's length; the direction is fixed in map space (see bowNormal in cues.js)
const SPOKE_WIDTH = 0.17;
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
${MASK_GLSL}
uniform float uStretch;
uniform float uMaskOn;
uniform vec3 uColor;
uniform float uFeather;
uniform float uHead;
uniform float uGain;
uniform vec3 uPhase;
uniform float uWaveU;
uniform float uWaveGain;
uniform vec2 uEnds;
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
  float tz = (u - uHead) / (0.035 * (1.0 + uStretch)); // the head stretches a little with scroll speed
  float tip = exp(-tz * tz) * (1.0 - smoothstep(0.86, 1.0, uHead));
  float flow = bump(u, uPhase.x, ${SPREAD[0]}) + 0.8 * bump(u, uPhase.y, ${SPREAD[1]}) + 0.6 * bump(u, uPhase.z, ${SPREAD[2]});
  float line = (0.5 + 0.8 * flow) * drawn;
  float wz = (u - uWaveU) / 0.12;
  float wave = exp(-wz * wz) * uWaveGain;
  // an end that meets a plate which has faded out fades with it, instead of stopping with a hard edge at an invisible plate
  float ends = mix(uEnds.x, 1.0, smoothstep(0.0, 0.5, u)) * mix(1.0, uEnds.y, smoothstep(0.5, 1.0, u)) * max(uEnds.x, uEnds.y);
  // (a link between two faded plates has nothing to join, so it fades out whole)
  float clear = mix(1.0, textClear(gl_FragCoord.xy, 90.0), uMaskOn); // fades out before the text instead of passing behind it
  float light = profile * (uGain * (line + 1.6 * tip) + wave * 2.2) * ends * clear;
  gl_FragColor = vec4(uColor * light, 1.0);
}`;

// Edge-to-edge arc: a quadratic curve that bows by `bow` (a unit vector in map space) times BOW times the length. The vector
// comes from the assembled layout, so it never depends on where the plates are right now or where the camera is, and a thread
// and the ring link between the same two plates lie on one curve. bow = null gives a straight line (the spokes).
function arc(ca, cb, bow, outP, outT) {
  const len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1], cb[2] - ca[2]) || 1;
  const sx = bow ? bow[0] * len * BOW : 0;
  const sy = bow ? bow[1] * len * BOW : 0;
  const cx = (ca[0] + cb[0]) / 2 + sx;
  const cy = (ca[1] + cb[1]) / 2 + sy;
  const cz = (ca[2] + cb[2]) / 2;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const m = 1 - t;
    const w0 = m * m;
    const w1 = 2 * m * t;
    const w2 = t * t;
    const p = i * 6;
    outP[p] = outP[p + 3] = w0 * ca[0] + w1 * cx + w2 * cb[0];
    outP[p + 1] = outP[p + 4] = w0 * ca[1] + w1 * cy + w2 * cb[1];
    outP[p + 2] = outP[p + 5] = w0 * ca[2] + w1 * cz + w2 * cb[2];
    outT[p] = outT[p + 3] = 2 * m * (cx - ca[0]) + 2 * t * (cb[0] - cx);
    outT[p + 1] = outT[p + 4] = 2 * m * (cy - ca[1]) + 2 * t * (cb[1] - cy);
    outT[p + 2] = outT[p + 5] = 2 * m * (cz - ca[2]) + 2 * t * (cb[2] - cz);
  }
}

// Where the plate's rim picks up the light of a link that meets it: a short bright stretch centred on the join, on the
// straight part of one edge only. Brightest on the edge, falling smoothly to 0 a strip's width inside it, and fading out
// along the edge before the corner arc begins: light bent round a corner drew a crease parallel to the arc (round 6b).
// Nothing reaches outside the outline: until 2026-11-18 the quad itself stuck out past the rounded corner.
const RIM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uSide; // 1: the strip lies on a side edge (runs along y), 0: on the top or bottom edge (runs along x)
varying vec2 vUv;
varying vec2 vPlate;
void main() {
  float az = (vUv.x - 0.5) / 0.2;
  float along = exp(-az * az) * (1.0 - smoothstep(0.3, 0.5, abs(vUv.x - 0.5)));
  vec2 p = abs(vPlate);
  float edge = mix(uHalf.y - p.y, uHalf.x - p.x, uSide); // depth inside the strip's own straight edge
  float run = mix(p.x, p.y, uSide); // distance from the edge's middle, along it
  float straight = mix(uHalf.x, uHalf.y, uSide) - uRadius; // where the corner arc begins
  float corner = 1.0 - smoothstep(straight - min(0.6, 0.5 * straight), straight, run);
  float inner = clamp(1.0 - edge / ${RIM_WIDTH.toFixed(2)}, 0.0, 1.0); // never negative, so no NaN
  float across = inner * inner * inner * smoothstep(0.0, 0.04, edge); // 0 on and outside the edge, after a 0.04 soft rise
  gl_FragColor = vec4(uColor * uGain * along * across * corner, 1.0);
}`;
const RIM_VERT = /* glsl */ `
uniform mat4 uLocal;
varying vec2 vUv;
varying vec2 vPlate;
void main() {
  vUv = uv;
  vPlate = (uLocal * vec4(position, 1.0)).xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// how visible a plate is (1 when it does not say): set every frame by look.js
const shown = (plate) => plate.userData.shown ?? 1;

export function buildLinks(T3, ring, threads, signal = '#f0c987', plates = {}, spokes = [], maskUniforms = {}) {
  const group = new T3.Group();
  const base = new T3.Color(signal);
  const shared = { ...maskUniforms, uColor: { value: base }, uFeather: { value: 1 }, uWidth: { value: HALF_WIDTH }, uStretch: { value: 0 }, uMaskOn: { value: 1 } };
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
      uniforms: {
        uColor: shared.uColor, uGain: { value: 0 }, uLocal: { value: null },
        uHalf: { value: new T3.Vector2(...(plate.userData.half || DEFAULT_HALF)) }, uRadius: { value: plate.userData.radius ?? DEFAULT_RADIUS }, uSide: { value: 1 },
      },
      vertexShader: RIM_VERT, fragmentShader: RIM_FRAG, transparent: true, depthWrite: false, blending: T3.AdditiveBlending,
    });
    const mesh = new T3.Mesh(rimGeometry, material);
    material.uniforms.uLocal.value = mesh.matrix; // the strip's place on the plate, kept current by three every frame
    mesh.visible = false;
    plate.add(mesh);
    owned.push(material);
    return mesh;
  };
  const make = (link, k, width = HALF_WIDTH) => {
    const geometry = new T3.BufferGeometry();
    geometry.setAttribute('position', new T3.BufferAttribute(new Float32Array((SEG + 1) * 6), 3));
    geometry.setAttribute('aTan', new T3.BufferAttribute(new Float32Array((SEG + 1) * 6), 3));
    geometry.setAttribute('aU', new T3.BufferAttribute(aU, 1));
    geometry.setAttribute('aSide', new T3.BufferAttribute(aSide, 1));
    geometry.setIndex(index);
    const u = {
      ...shared, uWidth: { value: width }, uHead: { value: 0 }, uGain: { value: 0 }, uPhase: { value: new T3.Vector3() },
      uWaveU: { value: -9 }, uWaveGain: { value: 0 }, uEnds: { value: new T3.Vector2(1, 1) },
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
  const spokeItems = spokes.map((l, k) => make(l, k + 7, SPOKE_WIDTH));

  const ea = [0, 0, 0];
  const eb = [0, 0, 0];
  const other = new T3.Vector3();
  const world = new T3.Vector3();
  const join = [[0, 0], [0, 0]];
  const bowVec = [0, 1];
  // The point where a ribbon meets `plate` on the way to the plate at `toPos`: on the rim, in the plate's own frame
  // (so tilted and shrunken plates still get it right), pushed under the plate by TUCK. Returns the world point in `out`.
  const pc = new T3.Vector3();
  const px = new T3.Vector3();
  const py = new T3.Vector3();
  const po = new T3.Vector3();
  const ex = [0, 0];
  const ey = [0, 0];
  const dir = [0, 0];
  const solved = [0, 0];
  let camera = null;
  let aspect = 1;
  // Which way, on the plate's own axes, the other plate lies as seen by the camera. The thread must meet the rim on the side
  // that faces the other plate on screen, or it would cross the plate's face. null when the camera view gives no answer.
  function screenDirection(plate, toPos) {
    if (!camera) return null;
    pc.setFromMatrixPosition(plate.matrixWorld).project(camera);
    px.set(3, 0, 0).applyMatrix4(plate.matrixWorld).project(camera);
    py.set(0, 3, 0).applyMatrix4(plate.matrixWorld).project(camera);
    po.copy(toPos).project(camera);
    ex[0] = (px.x - pc.x) * aspect; ex[1] = px.y - pc.y;
    ey[0] = (py.x - pc.x) * aspect; ey[1] = py.y - pc.y;
    dir[0] = (po.x - pc.x) * aspect; dir[1] = po.y - pc.y;
    return solveAxes(ex, ey, dir, solved);
  }
  function rimPoint(plate, toPos, out, slot) {
    other.copy(toPos);
    plate.worldToLocal(other);
    const seen = screenDirection(plate, toPos);
    const dx = seen ? seen[0] : other.x;
    const dy = seen ? seen[1] : other.y;
    const [hw, hh] = plate.userData.half || DEFAULT_HALF;
    const t = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
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
  function setRim(mesh, slot, gain, plate) {
    const [hw, hh] = plate.userData.half || DEFAULT_HALF;
    const z = plate.userData.faceZ ?? RIM_Z;
    const [jx, jy] = join[slot];
    const lean = Math.abs(jx) / hw - Math.abs(jy) / hh; // > 0: the join is on a side edge, < 0: on the top or bottom edge
    // near a corner the strip would jump from one edge to the other; it fades out there and changes edge while it is invisible
    gain *= smoothstep(Math.abs(lean) / CORNER_BAND);
    mesh.visible = gain > 0.003;
    if (!mesh.visible) return;
    const sideways = lean > 0;
    mesh.material.uniforms.uSide.value = sideways ? 1 : 0;
    const inset = RIM_WIDTH / 2 - 0.05;
    if (sideways) {
      const sx = Math.sign(jx) || 1;
      mesh.position.set(sx * (hw - inset), jy, z);
      mesh.rotation.z = -sx * Math.PI / 2;
      mesh.scale.x = Math.min(1, (hh * 1.6) / RIM_LEN);
    } else {
      const sy = Math.sign(jy) || 1;
      mesh.position.set(jx, sy * (hh - inset), z);
      mesh.rotation.z = sy > 0 ? 0 : Math.PI;
      mesh.scale.x = Math.min(1, (hw * 1.6) / RIM_LEN);
    }
    mesh.material.uniforms.uGain.value = gain * shown(plate);
  }
  function place(item, positions, head, gain, time, layout) {
    const { mesh, geometry, u, link, rims } = item;
    const live = gain > 0.003 && head > 0.003;
    mesh.visible = live;
    if (!live) { rims[0].visible = rims[1].visible = false; return; }
    rimPoint(plates[link.from], positions[link.to], ea, 0);
    rimPoint(plates[link.to], positions[link.from], eb, 1);
    const bow = link.from === 'hub' || !layout ? null : bowNormal(layout[link.from], layout[link.to], bowVec);
    arc(ea, eb, bow, geometry.attributes.position.array, geometry.attributes.aTan.array);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aTan.needsUpdate = true;
    u.uEnds.value.set(shown(plates[link.from]), shown(plates[link.to]));
    u.uHead.value = head;
    u.uGain.value = gain;
    u.uPhase.value.set((time * SPEEDS[0] + item.seed) % 1, (time * SPEEDS[1] + item.seed * 1.7 + 0.33) % 1, (time * SPEEDS[2] + item.seed * 2.3 + 0.66) % 1);
    const sway = 0.85 + 0.15 * Math.sin(time * 0.9 + item.seed * 6);
    setRim(rims[0], 0, gain * RIM_GAIN * Math.min(1, head * 8) * sway, plates[link.from]);
    setRim(rims[1], 1, gain * RIM_GAIN * Math.min(1, Math.max(0, (head - 0.9) * 10)) * sway, plates[link.to]);
  }

  // s: { time, ring[], threads[] (draw amounts), ringGain, threadGain, wave, waveGain, cycle[] ({order, reversed}) }
  function update(positions, s) {
    shared.uStretch.value = s.stretch || 0;
    shared.uMaskOn.value = s.maskOn ?? 1;
    camera = s.camera || null;
    aspect = s.aspect || 1;
    ringItems.forEach((item, i) => {
      place(item, positions, 1, s.ringGain, s.time, s.layout);
      const c = s.cycle[i];
      const local = s.wave - c.order;
      item.u.uWaveU.value = c.reversed ? 1 - local : local;
      item.u.uWaveGain.value = s.waveGain * s.ringGain;
    });
    threadItems.forEach((item, i) => place(item, positions, s.threads[i], s.threadGain, s.time, s.layout));
    // spokes: straight, hub to each plate; `spokeHead` draws them out, `spokeWave` is the pulse running along them
    spokeItems.forEach((item) => {
      place(item, positions, s.spokeHead, s.spokeGain, s.time, null);
      item.u.uWaveU.value = s.spokeWave;
      item.u.uWaveGain.value = s.spokeWaveGain;
    });
  }

  // without bloom the feathered edge has to carry the glow itself
  const setBloom = (on) => { shared.uFeather.value = on ? 1 : 1.7; };
  const dispose = () => owned.forEach((o) => o.dispose());
  return { group, update, setBloom, dispose };
}
