// The warm light that builds up as plates connect: a screen-space glow in the room behind the map, a faint halo behind
// each plate, and the light that shines through each plate's cut-outs.
const HALO_SCALE = [26, 19];
const HOLE_SPAN = 7; // world units the hole-light texture covers (icons are inside 6 x 6)
const HOLE_PX = 192;

const PLANE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Haze: drawn straight onto the screen. Gaussian falloff round uCentre (in screen heights), so the corners stay ink.
// A little noise, only where there is light, keeps the dark gradient from banding.
const HAZE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const HAZE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
uniform float uAspect;
uniform vec2 uCentre;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - uCentre) * vec2(uAspect, 1.0) / uRadius;
  float light = exp(-dot(d, d)) * uGain;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  light += n * 0.004 * clamp(light * 40.0, 0.0, 1.0);
  gl_FragColor = vec4(uColor * light, 1.0);
}`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - 0.5) / 0.34;
  gl_FragColor = vec4(uColor * exp(-dot(d, d)) * uGain, 1.0);
}`;

// Light through a stencil: brighter and warmer toward the middle of each cut-out, darker at the walls, with a slow
// swell so it is alive but never flickers. uMap is a mask painted from the icon outlines (see holeTexture).
const HOLE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uGain;
uniform float uTime;
varying vec2 vRaw;
void main() {
  float m = texture2D(uMap, vRaw / ${HOLE_SPAN.toFixed(1)} + 0.5).r;
  float swell = 1.0 + 0.06 * sin(uTime * 0.7 + vRaw.x * 0.8 + vRaw.y * 0.55) + 0.03 * sin(uTime * 1.3 - vRaw.y * 1.1);
  vec3 hot = vec3(1.0, 0.46, 0.1); // warmer than the signal gold, toward the middle of each cut-out
  vec3 c = mix(uColor * 0.7, hot * 1.3, m);
  gl_FragColor = vec4(c * (0.55 + 0.45 * m) * uGain * swell, 1.0);
}`;
const HOLE_VERT = /* glsl */ `
varying vec2 vRaw;
void main() { vRaw = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function holeTexture(T3, outlines, scale) {
  const c = document.createElement('canvas');
  c.width = c.height = HOLE_PX;
  const g = c.getContext('2d');
  const k = HOLE_PX / HOLE_SPAN;
  g.fillStyle = '#000';
  g.fillRect(0, 0, HOLE_PX, HOLE_PX);
  const path = new Path2D();
  for (const o of outlines) {
    o.forEach(([x, y], i) => {
      const px = (x * scale) * k + HOLE_PX / 2;
      const py = HOLE_PX / 2 - (y * scale) * k;
      if (i) path.lineTo(px, py); else path.moveTo(px, py);
    });
    path.closePath();
  }
  g.fillStyle = '#fff';
  g.fill(path);
  g.save();
  g.clip(path);
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.035)';
  for (let w = 56; w >= 2; w -= 2) { g.lineWidth = w; g.stroke(path); } // only the inside half shows: a smooth fall-off toward the walls
  g.restore();
  return new T3.CanvasTexture(c);
}

// The icon shapes as sheets of light just behind a plate. Returns { mesh, texture }; mesh.material.uniforms drive it.
export function buildHole(T3, outlines, scale, z, signal) {
  const shapes = outlines.map((o) => new T3.Shape(o.map(([x, y]) => new T3.Vector2(x * scale, y * scale))));
  const geometry = new T3.ShapeGeometry(shapes);
  geometry.translate(0, 0, z);
  const texture = holeTexture(T3, outlines, scale);
  const material = new T3.ShaderMaterial({
    uniforms: { uMap: { value: texture }, uColor: { value: new T3.Color(signal) }, uGain: { value: 0 }, uTime: { value: 0 } },
    vertexShader: HOLE_VERT, fragmentShader: HOLE_FRAG, transparent: true, depthWrite: false, blending: T3.AdditiveBlending,
  });
  const mesh = new T3.Mesh(geometry, material);
  mesh.visible = false;
  return { mesh, texture, material, geometry };
}

export function buildGlow(T3, signal, halos = 0) {
  const base = new T3.Color(signal);
  const owned = [];
  const mk = (geometry, vertexShader, fragmentShader, extra, mat = {}) => {
    const material = new T3.ShaderMaterial({
      uniforms: { uColor: { value: base }, uGain: { value: 0 }, ...extra }, vertexShader, fragmentShader,
      transparent: true, depthWrite: false, depthTest: false, blending: T3.AdditiveBlending, ...mat,
    });
    const mesh = new T3.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    owned.push(geometry, material);
    return mesh;
  };
  // amber, with less green than the signal gold, so the room reads as warm light and not olive
  const amber = new T3.Color().setRGB(1.0, 0.46, 0.14);
  const haze = mk(new T3.PlaneGeometry(2, 2), HAZE_VERT, HAZE_FRAG, {
    uColor: { value: amber },
    uAspect: { value: 1.6 }, uCentre: { value: new T3.Vector2(0.5, 0.5) }, uRadius: { value: 0.5 },
  });
  haze.renderOrder = -10;
  const plateHalos = Array.from({ length: halos }, () => {
    const h = mk(new T3.PlaneGeometry(HALO_SCALE[0], HALO_SCALE[1]), PLANE_VERT, HALO_FRAG, {});
    h.position.z = -1.2;
    h.renderOrder = -5;
    return h;
  });
  // centre = where the framed thing sits on screen, as 0..1 from the lower left
  const setHaze = (gain, cx, cy, aspect) => {
    haze.visible = gain > 0.0005;
    const u = haze.material.uniforms;
    u.uGain.value = gain;
    u.uCentre.value.set(cx, cy);
    u.uAspect.value = aspect;
  };
  const setHalo = (i, gain) => {
    const h = plateHalos[i];
    h.visible = gain > 0.0005;
    h.material.uniforms.uGain.value = gain;
  };
  const dispose = () => owned.forEach((o) => o.dispose());
  return { haze, halos: plateHalos, setHaze, setHalo, dispose };
}
