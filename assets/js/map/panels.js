// Steel plates with the icon cut out: satin face, polished bevel. One pair of materials per panel so one can glint alone.
import { brushTextures } from './brush.js';

const W = 12;
const H = 8;
const DEPTH = 0.4;
const RADIUS = 0.6;
const ICON_SCALE = 1.2;
const BEVEL = 0.1;

function plateShape(T3, outlines) {
  const s = new T3.Shape();
  const [x0, y0, x1, y1] = [-W / 2, -H / 2, W / 2, H / 2];
  s.moveTo(x0 + RADIUS, y0);
  s.lineTo(x1 - RADIUS, y0);
  s.absarc(x1 - RADIUS, y0 + RADIUS, RADIUS, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - RADIUS);
  s.absarc(x1 - RADIUS, y1 - RADIUS, RADIUS, 0, Math.PI / 2, false);
  s.lineTo(x0 + RADIUS, y1);
  s.absarc(x0 + RADIUS, y1 - RADIUS, RADIUS, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + RADIUS);
  s.absarc(x0 + RADIUS, y0 + RADIUS, RADIUS, Math.PI, Math.PI * 1.5, false);
  for (const outline of outlines) {
    const hole = new T3.Path(outline.map(([x, y]) => new T3.Vector2(x * ICON_SCALE, y * ICON_SCALE)));
    s.holes.push(hole);
  }
  return s;
}

const plateGeometry = (T3, outlines) => {
  const g = new T3.ExtrudeGeometry(plateShape(T3, outlines), {
    depth: DEPTH, bevelEnabled: true, bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 3, curveSegments: 10,
  });
  g.translate(0, 0, -DEPTH / 2);
  return g;
};

export function buildPanels(T3, ids, icons) {
  const group = new T3.Group();
  const byId = {};
  const textures = brushTextures(T3);
  const materials = [];
  for (const id of ids) {
    const face = new T3.MeshPhysicalMaterial({
      color: 0xd9d6d0, metalness: 1, roughness: 0.34, roughnessMap: textures.roughnessMap,
      anisotropy: 0.85, anisotropyMap: textures.anisotropyMap, transparent: true,
    });
    const bevel = new T3.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1, transparent: true });
    const mesh = new T3.Mesh(plateGeometry(T3, icons[id]), [face, bevel]);
    const panel = new T3.Group();
    panel.add(mesh);
    panel.userData = { face, bevel };
    group.add(panel);
    byId[id] = panel;
    materials.push(face, bevel);
  }
  group.userData = { textures, materials };
  return { group, byId };
}

export function disposePanels({ group }) {
  group.traverse((o) => o.geometry?.dispose());
  group.userData.materials.forEach((m) => m.dispose());
  Object.values(group.userData.textures).forEach((t) => t.dispose());
}
