// A dither in the last pass of the composer (the output pass), so the dark gradients of the room do not band.
// At most one 8-bit level up or down: it was a visible film grain (0.025) until 2026-11-14, when Leo asked for a crisp
// page. Monochrome, weighted by brightness (none in black, none in the brightest light), refreshed 24 times a second.
export const GRAIN = Object.freeze({ amount: 0.5 / 255, hz: 24, cell: 1.0 });

const FUNCTION = `
uniform float uGrain;
uniform vec2 uSeed;
uniform float uCell;
float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {`;
const APPLY = `
  vec2 cell = floor(gl_FragCoord.xy / uCell) + uSeed;
  float n = grainHash(cell) + grainHash(cell + 71.7) - 1.0;
  float l = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(0.02, 0.25, l) * (1.0 - smoothstep(0.55, 0.95, l));
  gl_FragColor.rgb += n * 2.0 * uGrain * w;
}`;

// Pure: the fragment shader source with the grain added in front of the closing brace of main().
export function withGrain(source) {
  const i = source.lastIndexOf('}');
  return source.slice(0, i).replace('void main() {', FUNCTION) + APPLY + source.slice(i + 1);
}

export function addGrain(output, pixelRatio) {
  const material = output.material;
  material.fragmentShader = withGrain(material.fragmentShader);
  material.uniforms.uGrain = { value: GRAIN.amount };
  material.uniforms.uSeed = { value: { x: 0, y: 0, isVector2: true, set(x, y) { this.x = x; this.y = y; return this; }, copy() { return this; } } };
  material.uniforms.uCell = { value: GRAIN.cell * pixelRatio };
  material.needsUpdate = true;
  let clock = 0;
  return {
    // call every frame; the pattern changes GRAIN.hz times a second, whatever the frame rate
    update(dt, on, ratio) {
      material.uniforms.uGrain.value = on ? GRAIN.amount : 0;
      material.uniforms.uCell.value = GRAIN.cell * ratio;
      clock += dt;
      if (clock < 1 / GRAIN.hz) return;
      clock %= 1 / GRAIN.hz;
      material.uniforms.uSeed.value.set(Math.floor(Math.random() * 4096), Math.floor(Math.random() * 4096));
    },
  };
}
