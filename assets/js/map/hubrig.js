// The hub as the engine sees it: the plate (hub.js), its play button and pulse (hubcontrol.js), its small growth under the pointer,
// and the spoke state that links.js draws. One call per frame.
import { hubSizeFor, hubLevel } from './cues.js';
import { damp } from './motion.js';
import { buildHub } from './hub.js';
import { createHubControl } from './hubcontrol.js';

const BASE_W = 9;
const HOVER_GROW = 0.05; // the pointer on the hub enlarges it a little; it does not tilt (Leo, 2026-11-18: the tilt was too much)
const READY = 0.8;
const SPOKE_GAIN = 0.55;
const SPOKE_GOLD = 0.2;

export function buildHubRig(T3, { root, html, signal }) {
  const hub = buildHub(T3, signal);
  const control = createHubControl({ root, html });
  const edge = new T3.Vector3();
  let level = 0;

  // f: { T, raw, dt, time, aspect, size, camera, ndc (origin, projected), pointer, mouse, visible, waveBusy, gold, linkState }
  function update(f) {
    level += (hubLevel(f.T) - level) * damp(f.raw, 3);
    const ready = level > READY;
    const c = control.update({ dt: f.dt, ready, busy: f.waveBusy });
    const scale = hubSizeFor(f.aspect)[0] / BASE_W;
    hub.update({ level, hover: c.hover, warm: f.gold, tiltX: 0, tiltY: 0, time: f.time, scale: scale * (1 + HOVER_GROW * c.hover) });
    const s = f.linkState;
    s.spokeHead = level;
    s.spokeGain = (SPOKE_GAIN + SPOKE_GOLD * f.gold) * level;
    s.spokeWave = c.spokeWave;
    s.spokeWaveGain = c.spokeWaveGain;
    // the button follows the hub on screen
    edge.set((BASE_W / 2) * scale, 0, 0).project(f.camera);
    const half = Math.abs(edge.x - f.ndc.x) * f.size.width * 0.5;
    const x = (f.ndc.x * 0.5 + 0.5) * f.size.width;
    const y = (1 - (f.ndc.y * 0.5 + 0.5)) * f.size.height;
    control.place(level, f.visible, x, y, half * 2, half * 2 * (hubSizeFor(f.aspect)[1] / hubSizeFor(f.aspect)[0]));
    return c;
  }
  const dispose = () => { control.dispose(); hub.dispose(); };
  return { group: hub.group, update, dispose };
}
