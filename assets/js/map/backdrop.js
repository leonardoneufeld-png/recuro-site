// Zone backdrops: a dark video loop behind the plates for each panel beat and the flow map. Drawn inside the scene,
// so bloom, tone mapping and the text-box fades treat it like the rest of the room.
// Each new video frame is copied into a canvas at the video's own size (the vendored three.js bundle has no VideoTexture)
// and sampled once per pixel: no blur, so the footage stays as sharp as it was encoded (agreed 2026-11-14).
import { PANEL_IDS, PHONE_ASPECT, assembleAmount, smoothstep } from './cues.js';
import { presenceAmount } from './motion.js';

export const ZONE_IDS = Object.freeze([...PANEL_IDS, 'flow']);
export const zoneSrc = (id) => `assets/video/zone-${id}.mp4`;
// 65% brightness on screen, as a linear factor (45% until 2026-11-16, when Leo asked for rooms that read as lit)
export const BRIGHTNESS = 0.65 ** 2.2;
export const VIDEO_SIZE = Object.freeze({ width: 1728, height: 992 }); // the loops, encoded at twice the 864 x 496 masters
const VIDEO_ASPECT = VIDEO_SIZE.width / VIDEO_SIZE.height;
const LINEAR_FILTER = 1006; // THREE.LinearFilter, which the vendored bundle does not export: no mipmaps to rebuild per frame
const LOAD_AHEAD = 1.3; // start fetching a zone's video this far (in stops) before it shows
const READY_RATE = 2.5; // fade-in per second once the first frame is in
const FLOW = ZONE_IDS.length - 1;
// Portrait crops show about a quarter of the loop's width, and the loops were made with a dark empty centre for the
// desktop plates. So on narrow screens each zone's crop slides to the side that has light in it, picked from frames
// of each loop (0 left edge, 1 right edge). A phone's stage band shows the top half of the video, where these sides
// have their lamps, windows and steam.
export const ANCHORS = Object.freeze({
  pos: 1, // the window and its light beam, right
  stock: 0, // the lit jar shelf, left
  ordering: 1, // truck lights and the bare tree, right
  cogs: 1, // the light beam, brass scale and flour dust, right
  invoices: 0, // the desk lamp, left
  staff: 0.9, // the pass lamp and the right-hand cook
  flow: 0, // the pendant lamps and a steaming cup, left; the lit window on the right washed the whole phone screen
});
// Phone brightness per zone, against the desktop look: the anchored sides differ a lot in light, so each is set to land
// near the desktop backdrop's brightness (measured on screenshots; see implementation-notes.html).
export const LIFTS = Object.freeze({ pos: 0.35, stock: 0.9, ordering: 1, staff: 1, cogs: 2.5, invoices: 2.5, flow: 0.6 });
const SQUARE_ASPECT = 1; // at and above this the crop is the plain centred cover desktop has always had
const BAND_FADE = 0.3; // phone: the soft edge at each end of the stage band, as a share of its height
const FLOW_FADE = 0.35; // phone: the flow backdrop fades to ink over the bottom of the screen, as a share of its height
const FULL = Object.freeze({ y0: -1, y1: 2, f0: 0.5, f1: 0.5 }); // the mask is exactly 1 on the whole screen

// Cover the screen by cropping the video's long side. Between square and the phone layout the crop slides from the
// centre to the zone's anchor and its lift fades in, so a resize never jumps.
export function cropFor(aspect, anchor = 0.5, zoneLift = 1) {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : SQUARE_ASPECT;
  const sx = Math.min(1, a / VIDEO_ASPECT), sy = Math.min(1, VIDEO_ASPECT / a);
  const k = 1 - smoothstep((a - PHONE_ASPECT) / (SQUARE_ASPECT - PHONE_ASPECT));
  const side = Number.isFinite(anchor) ? Math.min(1, Math.max(0, anchor)) - 0.5 : 0;
  const lift = Number.isFinite(zoneLift) ? zoneLift : 1;
  return { sx, sy, ox: side * (1 - sx) * k, lift: 1 + (lift - 1) * k };
}

// Where on screen a zone's backdrop shows: rows y0..y1 (0 top, 1 bottom) with soft edges f0, f1. Phone panels only light
// the stage band under the header (the text frames sit on ink below it), and never what is still behind the hero, whose
// bottom edge opens the band as it scrolls away. The flow map uses the whole phone screen and fades to ink at the bottom.
// Inputs in CSS px from the top of the screen.
export function bandFor({ phone, flow, height, stageBottom, heroBottom }) {
  if (!phone || !(height > 0) || !Number.isFinite(stageBottom) || !Number.isFinite(heroBottom)) return FULL;
  if (flow) return { y0: -1, y1: 1, f0: 0.5, f1: FLOW_FADE };
  const fade = (BAND_FADE * Math.max(1, stageBottom)) / height;
  return { y0: heroBottom / height, y1: stageBottom / height, f0: fade, f1: fade };
}

const weightOf = (T, i) => (i === FLOW ? smoothstep(assembleAmount(T)) : presenceAmount(T, i + 1));

// The two strongest zones at timeline position T: a is the stronger. Weights never add up to more than 1.
export function zoneMix(T) {
  const out = { a: 0, wa: 0, b: 0, wb: 0 };
  if (!Number.isFinite(T) || T < 0) return out;
  for (let i = 0; i < ZONE_IDS.length; i++) {
    const w = weightOf(T, i);
    if (w > out.wa) { out.b = out.a; out.wb = out.wa; out.a = i; out.wa = w; } else if (w > out.wb) { out.b = i; out.wb = w; }
  }
  const sum = out.wa + out.wb;
  if (sum > 1) { out.wa /= sum; out.wb /= sum; }
  return out;
}
// the stop at which zone i is fully shown
const stopOf = (i) => (i === FLOW ? 6.6 + 0.73 : i + 1);

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uWA;
uniform float uWB;
uniform float uBright;
uniform vec2 uScale;
uniform float uOffA;
uniform float uOffB;
uniform vec4 uBandA; // y0, y1, f0, f1 from bandFor
uniform vec4 uBandB;
uniform float uLiftA;
uniform float uLiftB;
uniform vec3 uFloor;
varying vec2 vUv;
float band(vec4 b, float y) { return smoothstep(b.x, b.x + b.z, y) * (1.0 - smoothstep(b.y - b.w, b.y, y)); }
void main() {
  vec2 uv = (vUv - 0.5) * uScale + 0.5;
  float w = uWA + uWB;
  float y = 1.0 - vUv.y;
  vec3 a = texture2D(uA, uv + vec2(uOffA, 0.0)).rgb * (uLiftA * band(uBandA, y));
  vec3 b = texture2D(uB, uv + vec2(uOffB, 0.0)).rgb * (uLiftB * band(uBandB, y));
  vec3 c = (a * uWA + b * uWB) / max(w, 1e-4);
  // never darker than the ink of the page around the canvas
  gl_FragColor = vec4(max(c * uBright, uFloor), w);
}`;

function makeZone(T3, id) {
  const video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_SIZE.width;
  canvas.height = VIDEO_SIZE.height;
  const ctx = canvas.getContext('2d');
  const texture = new T3.CanvasTexture(canvas);
  texture.colorSpace = T3.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LINEAR_FILTER;
  return { id, video, ctx, texture, loaded: false, ready: 0, drawnAt: -1, playing: false };
}

// gain: the factor the engine applies to the background so it matches the page ink after tone mapping
export function buildBackdrop(T3, { floor, gain = 1 }) {
  const zones = ZONE_IDS.map((id) => makeZone(T3, id));
  const blank = new T3.CanvasTexture(document.createElement('canvas'));
  const material = new T3.ShaderMaterial({
    uniforms: {
      uA: { value: blank }, uB: { value: blank }, uWA: { value: 0 }, uWB: { value: 0 },
      uBright: { value: BRIGHTNESS * gain }, uScale: { value: new T3.Vector2(1, 1) }, uOffA: { value: 0 }, uOffB: { value: 0 },
      // vec4 as a flat array: the vendored bundle has no Vector4
      uBandA: { value: new Float32Array([FULL.y0, FULL.y1, FULL.f0, FULL.f1]) }, uBandB: { value: new Float32Array([FULL.y0, FULL.y1, FULL.f0, FULL.f1]) },
      uLiftA: { value: 1 }, uLiftB: { value: 1 },
      uFloor: { value: floor.clone() },
    },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false,
  });
  const geometry = new T3.PlaneGeometry(2, 2);
  const mesh = new T3.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -20; // first, so the haze and the plates draw over it
  mesh.visible = false;
  let running = true, enabled = true;
  // the phone layout (site.css, max-width 759px) and the boxes that bound its stage band
  const phoneQuery = window.matchMedia('(max-width: 759px)');
  const header = document.querySelector('.site-header'), hero = document.querySelector('.hero'), still = document.querySelector('.beat-still');
  const screenBands = () => {
    if (!phoneQuery.matches || !header || !hero || !still) return null;
    return { phone: true, height: document.documentElement.clientHeight, stageBottom: header.getBoundingClientRect().bottom + still.offsetHeight, heroBottom: hero.getBoundingClientRect().bottom };
  };
  const setBand = (v, box, i) => {
    const b = box ? bandFor({ ...box, flow: i === FLOW }) : FULL;
    v[0] = b.y0; v[1] = b.y1; v[2] = b.f0; v[3] = b.f1;
  };

  const play = (z, on) => {
    if (on === z.playing) return;
    z.playing = on;
    if (on) z.video.play().catch(() => { z.playing = false; }); else z.video.pause();
  };
  const draw = (z) => {
    if (z.video.readyState < 2 || z.video.currentTime === z.drawnAt) return;
    z.ctx.drawImage(z.video, 0, 0, VIDEO_SIZE.width, VIDEO_SIZE.height);
    z.drawnAt = z.video.currentTime;
    z.texture.needsUpdate = true;
  };

  function update(T, dt, aspect) {
    if (!enabled) return;
    const m = zoneMix(T);
    zones.forEach((z, i) => {
      if (!z.loaded && Number.isFinite(T) && T > stopOf(i) - LOAD_AHEAD) { z.loaded = true; z.video.src = zoneSrc(z.id); }
      const shown = running && ((i === m.a && m.wa > 0) || (i === m.b && m.wb > 0));
      play(z, shown && z.loaded);
      if (!shown) return;
      draw(z);
      if (z.drawnAt >= 0) z.ready = Math.min(1, z.ready + dt * READY_RATE);
    });
    const A = zones[m.a], B = zones[m.b];
    const u = material.uniforms;
    u.uA.value = A.texture;
    u.uB.value = B.texture;
    u.uWA.value = m.wa * A.ready;
    u.uWB.value = m.wb * B.ready;
    // each texture gets its own offset, lift and band, since two zones cross-fade between stops
    const ca = cropFor(aspect, ANCHORS[A.id], LIFTS[A.id]), cb = cropFor(aspect, ANCHORS[B.id], LIFTS[B.id]);
    u.uScale.value.set(ca.sx, ca.sy);
    u.uOffA.value = ca.ox;
    u.uOffB.value = cb.ox;
    u.uLiftA.value = ca.lift;
    u.uLiftB.value = cb.lift;
    const box = screenBands();
    setBand(u.uBandA.value, box, m.a);
    setBand(u.uBandB.value, box, m.b);
    mesh.visible = u.uWA.value + u.uWB.value > 0.002;
  }
  const setRunning = (on) => {
    running = on;
    if (!on) zones.forEach((z) => play(z, false));
  };
  const off = () => {
    enabled = false;
    mesh.visible = false;
    zones.forEach((z) => play(z, false));
  };
  const dispose = () => {
    off();
    zones.forEach((z) => { z.video.removeAttribute('src'); z.video.load(); z.texture.dispose(); });
    blank.dispose();
    material.dispose();
    geometry.dispose();
  };
  return { mesh, update, setRunning, off, dispose };
}
