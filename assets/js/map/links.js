// Lines of light between panel edges: thin boxes that grow from one panel to the next, with pulses on the lit ones.
import { edgePoint } from './motion.js';

const HALF_W = 6.2;
const HALF_H = 4.2;
const GAP = 0.5;
const LINE = 0.07;
const PULSES = 2;
const PULSE_SPEED = 0.16;
const HDR = 1.7; // above 1 so the bloom threshold catches it

export function buildLinks(T3, links, signal = '#f0c987') {
  const group = new T3.Group();
  const box = new T3.BoxGeometry(1, 1, 1);
  const base = new T3.Color(signal);
  const mk = (k) => new T3.MeshBasicMaterial({ color: base.clone().multiplyScalar(k), blending: T3.AdditiveBlending, transparent: true, depthWrite: false });
  const lineMat = mk(HDR * 0.8);
  const pulseMat = mk(HDR * 2.2);
  const X = new T3.Vector3(1, 0, 0);
  const dir = new T3.Vector3();
  const a = new T3.Vector3();
  const b = new T3.Vector3();
  const items = links.map((link) => {
    const line = new T3.Mesh(box, lineMat);
    const pulses = Array.from({ length: PULSES }, () => new T3.Mesh(box, pulseMat));
    line.visible = false;
    pulses.forEach((p) => { p.visible = false; });
    group.add(line, ...pulses);
    return { link, line, pulses };
  });

  // lay a box of `length` along a -> b starting at a
  const place = (mesh, from, dirV, length, at, width, long) => {
    mesh.position.copy(from).addScaledVector(dirV, at);
    mesh.quaternion.setFromUnitVectors(X, dirV);
    mesh.scale.set(long ?? length, width, width);
  };

  function update(positions, amounts, time, boost = 0) {
    lineMat.color.copy(base).multiplyScalar(HDR * 0.8 * (1 + boost * 1.6));
    pulseMat.color.copy(base).multiplyScalar(HDR * 2.2 * (1 + boost));
    const width = LINE * (1 + boost * 1.1);
    items.forEach(({ link, line, pulses }, i) => {
      const amount = amounts[i];
      const from = positions[link.from];
      const to = positions[link.to];
      line.visible = amount > 0.002;
      if (!line.visible) { pulses.forEach((p) => { p.visible = false; }); return; }
      a.fromArray(edgePoint(from.toArray(), to.toArray(), HALF_W, HALF_H, GAP));
      b.fromArray(edgePoint(to.toArray(), from.toArray(), HALF_W, HALF_H, GAP));
      dir.subVectors(b, a);
      const full = dir.length();
      dir.divideScalar(full || 1);
      const drawn = full * amount;
      place(line, a, dir, drawn, drawn / 2, width);
      const lit = amount >= 1;
      pulses.forEach((p, k) => {
        // while drawing, one bright head rides the tip; once lit, pulses travel start to end
        p.visible = lit || k === 0;
        if (!p.visible) return;
        const phase = lit ? (time * PULSE_SPEED + k / PULSES + i * 0.31) % 1 : 1;
        place(p, a, dir, 0, Math.min(drawn, phase * full), width * 2.4, lit ? 0.9 : 0.5);
      });
    });
  }

  function dispose() {
    box.dispose();
    lineMat.dispose();
    pulseMat.dispose();
  }
  return { group, update, dispose };
}
