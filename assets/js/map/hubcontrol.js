// The hub's play control: a transparent, focusable button laid over the hub, and the pulse it starts. The pulse runs out along
// the spokes (spokeWave), then the engine's ring wave takes over (startRing). The button never blocks scrolling (touch-action).
import { PULSE, spokePulse, pulseStartsRing } from './cues.js';

const LABEL = { en: 'Recuro: play the connection', de: 'Recuro: Verbindung abspielen' };
const SHOW_FROM = 0.85;
const HOVER_RATE = 6;

export function createHubControl({ root, html }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hub-btn';
  button.hidden = true;
  const setLabel = () => button.setAttribute('aria-label', html.lang === 'de' ? LABEL.de : LABEL.en);
  setLabel();
  const watcher = new MutationObserver(setLabel);
  watcher.observe(html, { attributes: true, attributeFilter: ['lang'] });
  root.appendChild(button);

  let clock = -1;
  let hoverTarget = 0;
  let wantPlay = false;
  const out = { hover: 0, spokeWave: -9, spokeWaveGain: 0, startRing: false, arrived: false };
  const play = () => { wantPlay = true; };
  button.addEventListener('click', play);
  const enter = (e) => { if (e.pointerType === 'mouse') { hoverTarget = 1; play(); } };
  const leave = () => { hoverTarget = 0; };
  button.addEventListener('pointerenter', enter);
  button.addEventListener('pointerleave', leave);

  // ready: the hub is fully there; busy: the ring wave is running. Returns a shared object, valid until the next call.
  function update({ dt, ready, busy }) {
    out.startRing = false;
    out.arrived = false;
    if (clock < 0 && wantPlay && ready && !busy) clock = 0;
    wantPlay = false;
    if (clock >= 0) {
      const before = spokePulse(clock);
      clock += dt;
      const now = spokePulse(clock);
      out.arrived = before <= 1 && now > 1;
      out.startRing = pulseStartsRing(clock) && !pulseStartsRing(clock - dt);
      if (clock > PULSE.seconds) clock = -1;
    }
    out.spokeWave = clock >= 0 ? spokePulse(clock) : -9;
    out.spokeWaveGain = clock >= 0 ? 1 : 0;
    out.hover += (hoverTarget - out.hover) * (1 - Math.exp(-dt * HOVER_RATE));
    return out;
  }

  // x, y: centre in CSS pixels; width: hub width in CSS pixels
  function place(level, visible, x, y, width, height) {
    const show = visible && level > SHOW_FROM;
    if (button.hidden === show) button.hidden = !show;
    if (!show) return;
    button.style.width = `${width}px`;
    button.style.height = `${height}px`;
    button.style.transform = `translate(${x - width / 2}px, ${y - height / 2}px)`;
  }

  function dispose() {
    watcher.disconnect();
    button.remove();
  }
  return { update, place, dispose };
}
