// Steel plates with the icon cut out: satin face, polished bevel. One pair of materials per panel so one can glint alone.
import { brushTextures } from './brush.js';
import { buildHole } from './glow.js';

const W = 12;
const H = 8;
const DEPTH = 0.4;
const RADIUS = 0.6;
const ICON_SCALE = 1.2;
const BEVEL = 0.1;
const BACKING_Z = -DEPTH / 2 - BEVEL - 0.04; // just behind the back face: seen only through the cut-outs

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

// No pixel of a plate may reach the bloom threshold on its own: a polished bevel or hole wall that mirrors the key light
// would otherwise bloom into a white star. The cap sits under the threshold in engine.js; only light sources go above it.
const PLATE_CAP = 1.0;
export function capRadiance(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
      `#include <opaque_fragment>\n  gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(${PLATE_CAP.toFixed(2)}));`);
  };
  material.customProgramCacheKey = () => 'plate-cap';
}

export function buildPanels(T3, ids, icons, signal = '#f0c987') {
  const group = new T3.Group();
  const byId = {};
  const textures = brushTextures(T3);
  const materials = [];
  const holeTextures = [];
  for (const id of ids) {
    const face = new T3.MeshPhysicalMaterial({
      color: 0xd9d6d0, metalness: 1, roughness: 0.34, roughnessMap: textures.roughnessMap,
      anisotropy: 0.85, anisotropyMap: textures.anisotropyMap, transparent: true,
    });
    const bevel = new T3.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.1, transparent: true });
    capRadiance(face);
    capRadiance(bevel);
    const mesh = new T3.Mesh(plateGeometry(T3, icons[id]), [face, bevel]);
    const panel = new T3.Group();
    const hole = buildHole(T3, icons[id], ICON_SCALE, BACKING_Z, signal);
    const glow = hole.mesh;
    panel.add(mesh, glow);
    panel.userData = { face, bevel, glow };
    group.add(panel);
    byId[id] = panel;
    materials.push(face, bevel, hole.material);
    holeTextures.push(hole.texture);
  }
  group.userData = { textures, materials, holeTextures };
  return { group, byId };
}

export function disposePanels({ group }) {
  group.traverse((o) => o.geometry?.dispose());
  group.userData.materials.forEach((m) => m.dispose());
  Object.values(group.userData.textures).forEach((t) => t.dispose());
  group.userData.holeTextures.forEach((t) => t.dispose());
}
