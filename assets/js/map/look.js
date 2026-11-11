// How one plate looks this frame. A plate is cool steel until its thread arrives and warm steel, with a gold rim and a gold
// icon, once it is connected; `gold` (the whole map joined up) warms every plate a little more. Every plate goes through
// this one function, so no panel can be treated differently from the others.
import { waveGlow } from './cues.js';

export const COOL_FACE = [0.78, 0.86, 1.0];
export const WARM_FACE = [1.0, 0.86, 0.66];
export const COOL_BEVEL = [0.68, 0.76, 0.92];
export const WARM_BEVEL = [0.9, 0.76, 0.56];
const HOLE_HDR = 0.85;
const WAVE_CAP = 0.3; // the finale wave brightens an icon by at most this much, so it never flares to white
const DEPTH_WRITE_FROM = 0.98;
// the lower plates reflect a darker part of the room, so they get a little more colour to read as bright as the top row
const LOWER_BOOST = 0.75;
const RIGHT_BOOST = 0.35;
const ROW_SPAN = 8;
const COL_SPAN = 20;

const unit = (v) => Math.min(1, Math.max(0, v));

export function createLook(T3) {
  const cool = new T3.Color(...COOL_FACE);
  const warm = new T3.Color(...WARM_FACE);
  const coolBevel = new T3.Color(...COOL_BEVEL);
  const warmBevel = new T3.Color(...WARM_BEVEL);
  // p: { index, lit, gold, glint, wave, walk, bright, assemble, at ([x, y] of the plate in the layout), time, halosOn, glow }
  return function look(obj, p) {
    const { face, bevel, glow: hole } = obj.userData;
    const w = p.wave > -5 ? waveGlow(p.wave, p.walk, 0.32) : 0;
    const g = Math.max(p.glint * 0.6, w * 0.7);
    const warmth = unit(p.lit + (1 - p.lit) * p.gold);
    bevel.emissiveIntensity = p.lit * 0.2 + g * 0.3;
    face.emissiveIntensity = p.lit * 0.01 + g * 0.03;
    face.opacity = bevel.opacity = p.bright;
    // a faded plate must not occlude: with depth writes on, an invisible plate still cut the threads behind it
    face.depthWrite = bevel.depthWrite = p.bright >= DEPTH_WRITE_FROM;
    obj.visible = p.bright > 0.02;
    obj.userData.shown = p.bright;
    const holeGain = (p.lit * (0.65 + 0.4 * p.gold) + p.glint * 0.3 + Math.min(w * 0.6, WAVE_CAP)) * p.bright;
    hole.visible = holeGain > 0.003;
    hole.material.uniforms.uGain.value = HOLE_HDR * holeGain;
    hole.material.uniforms.uTime.value = p.time + p.index * 1.7;
    p.glow.setHalo(p.index, p.halosOn ? (p.lit * 0.02 * (0.5 + p.gold) + w * 0.05) * p.bright : 0);
    const boost = 1 + p.assemble * (LOWER_BOOST * unit(-p.at[1] / ROW_SPAN) + RIGHT_BOOST * unit(p.at[0] / COL_SPAN));
    face.color.copy(cool).lerp(warm, warmth).multiplyScalar(boost);
    bevel.color.copy(coolBevel).lerp(warmBevel, warmth);
  };
}
