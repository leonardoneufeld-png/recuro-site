// The text that sits over the canvas. Its ink glass hides whatever is behind it, so the light in the room, the threads and the
// links fade out before they reach it instead of being cut off by it, and nothing in the canvas shows a straight edge.
// The shaders read up to two screen rectangles (CSS px, y down) from these uniforms.
import { textFade } from './cues.js';

const PAD = 64; // the glass reaches this far past the text box (4rem) before it has faded to nothing
const FLOW_PAD = 48;
const RECTS = 2;

export const MASK_GLSL = /* glsl */ `
uniform vec4 uRects[${RECTS}];
uniform vec2 uRectGain;
uniform vec3 uView;
// 1 far from the text boxes, 0 inside them; the fall-off from the box edge to \`feather\` px away is smooth
float textClear(vec2 fragCoord, float feather) {
  vec2 css = vec2(fragCoord.x, uView.y * uView.z - fragCoord.y) / uView.z;
  float m = 1.0;
  for (int i = 0; i < ${RECTS}; i++) {
    vec4 r = uRects[i];
    vec2 c = (r.xy + r.zw) * 0.5;
    vec2 h = (r.zw - r.xy) * 0.5;
    vec2 q = abs(css - c) - h;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    m *= mix(1.0, smoothstep(0.0, feather, d), uRectGain[i]);
  }
  return m;
}`;

export function createTextMask(T3, root, html) {
  const uniforms = {
    uRects: { value: new Float32Array(RECTS * 4) }, // vec4[2] as a flat array: three takes numbers as they are
    uRectGain: { value: new T3.Vector2(0, 0) },
    uView: { value: new T3.Vector3(1, 1, 1) },
  };
  const beats = [...root.querySelectorAll('.beat')].map((el) => ({ el, grid: el.querySelector('.beat-grid'), text: el.querySelector('.beat-text') }));
  const flow = root.querySelector('.flow-head');
  const fades = beats.map(() => -1);
  const found = [];

  // `phone`: text panes are opaque and pinned, so they get no fade and no mask on the links. T: the eased timeline position.
  function update({ T, width, height, ratio, phone }) {
    uniforms.uView.value.set(width, height, ratio);
    found.length = 0;
    const add = (rect, gain, pad, full) => {
      if (rect.bottom < -200 || rect.top > height + 200 || gain < 0.02) return;
      const x0 = full ? 0 : rect.left;
      const x1 = full ? width : rect.right;
      found.push({ x0: x0 - pad, y0: rect.top - pad, x1: x1 + pad, y1: rect.bottom + pad, gain, area: (x1 - x0) * Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0)) });
    };
    beats.forEach((b, i) => {
      const fade = phone ? 1 : textFade(T, i + 1);
      if (!phone && Math.abs(fade - fades[i]) > 0.004) { fades[i] = fade; b.grid.style.setProperty('--fade', fade.toFixed(3)); }
      if (phone) { if (fades[i] !== 1) { fades[i] = 1; b.grid.style.removeProperty('--fade'); } }
      if (b.text) add(b.text.getBoundingClientRect(), fade, PAD, false);
    });
    if (flow && !phone) add(flow.getBoundingClientRect(), 1, FLOW_PAD, true);
    found.sort((a, b) => b.area - a.area);
    for (let k = 0; k < RECTS; k++) {
      const f = found[k];
      const r = uniforms.uRects.value;
      r[k * 4] = f ? f.x0 : 0; r[k * 4 + 1] = f ? f.y0 : 0; r[k * 4 + 2] = f ? f.x1 : 0; r[k * 4 + 3] = f ? f.y1 : 0;
      uniforms.uRectGain.value[k ? 'y' : 'x'] = f ? f.gain : 0;
    }
  }
  return { uniforms, update };
}
