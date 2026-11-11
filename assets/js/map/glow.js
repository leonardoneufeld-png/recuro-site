// The warm light that builds up as plates connect: a very soft haze behind the scene and a faint halo behind each plate.
const HAZE_SIZE = [520, 420];
const HAZE_DEPTH = 42; // behind the camera target
const HALO_SCALE = [26, 19];

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Gaussian falloff, plus a little noise that only exists where there is light, so the dark gradient does not band.
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
uniform vec2 uSigma;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - 0.5) / uSigma;
  float g = exp(-dot(d, d));
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  float light = g * uGain;
  light += n * 0.004 * clamp(light * 40.0, 0.0, 1.0);
  gl_FragColor = vec4(uColor * light, 1.0);
}`;

export function buildGlow(T3, signal, halos = 0) {
  const base = new T3.Color(signal);
  const owned = [];
  const mk = (w, h, sigma) => {
    const geometry = new T3.PlaneGeometry(w, h);
    const material = new T3.ShaderMaterial({
      uniforms: { uColor: { value: base }, uGain: { value: 0 }, uSigma: { value: new T3.Vector2(sigma[0], sigma[1]) } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false, blending: T3.AdditiveBlending,
    });
    const mesh = new T3.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    owned.push(geometry, material);
    return mesh;
  };
  const haze = mk(HAZE_SIZE[0], HAZE_SIZE[1], [0.17, 0.2]);
  haze.renderOrder = -10;
  const plateHalos = Array.from({ length: halos }, () => {
    const h = mk(HALO_SCALE[0], HALO_SCALE[1], [0.34, 0.34]);
    h.position.z = -1.2;
    h.renderOrder = -5;
    return h;
  });
  // haze sits behind the framed point and lags the camera a little, so it drifts against the plates
  const setHaze = (gain, target) => {
    haze.visible = gain > 0.0005;
    haze.material.uniforms.uGain.value = gain;
    haze.position.set(target[0] * 0.6, target[1] * 0.6 + 4, target[2] - HAZE_DEPTH);
  };
  const setHalo = (i, gain) => {
    const h = plateHalos[i];
    h.visible = gain > 0.0005;
    h.material.uniforms.uGain.value = gain;
  };
  const dispose = () => owned.forEach((o) => o.dispose());
  return { haze, halos: plateHalos, setHaze, setHalo, dispose };
}
