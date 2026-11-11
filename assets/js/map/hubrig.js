// The hub as the engine sees it: the plate (hub.js), its play button and pulse (hubcontrol.js), the tilt toward the pointer,
// and the spoke state that links.js draws. One call per frame.
import { hubSizeFor, hubLevel } from './cues.js';
import { damp } from './motion.js';
import { buildHub } from './hub.js';
import { createHubControl } from './hubcontrol.js';

const BASE_W = 9;
const TILT_X = 0.18;
const TILT_Y = 0.22;
const TILT_MAX = 0.2; // more than this swings the face into the key light and it washes out to cream
const READY = 0.8;
const SPOKE_GAIN = 0.55;
const SPOKE_GOLD = 0.2;
const clamp = (v, m) => Math.max(-m, Math.min(m, v));

export function buildHubRig(T3, { root, html, signal }) {
  const hub = buildHub(T3, signal);
  const control = createHubControl({ root, html });
  const edge = new T3.Vector3();
  let level = 0;
  let tiltX = 0;
  let tiltY = 0;

  // f: { T, raw, dt, time, aspect, size, camera, ndc (origin, projected), pointer, mouse, visible, waveBusy, gold, linkState }
  function update(f) {
    level += (hubLevel(f.T) - level) * damp(f.raw, 3);
    const ready = level > READY;
    const c = control.update({ dt: f.dt, ready, busy: f.waveBusy });
    const scale = hubSizeFor(f.aspect)[0] / BASE_W;
    const lean = ready && f.mouse ? 1 + c.hover : 0;
    const wantX = clamp((f.pointer.y + f.ndc.y) * TILT_X * lean, TILT_MAX);
    const wantY = clamp((f.pointer.x - f.ndc.x) * TILT_Y * lean, TILT_MAX);
    tiltX += (wantX - tiltX) * damp(f.raw, 6);
    tiltY += (wantY - tiltY) * damp(f.raw, 6);
    hub.update({ level, hover: c.hover, warm: f.gold, tiltX, tiltY, time: f.time, scale });
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
