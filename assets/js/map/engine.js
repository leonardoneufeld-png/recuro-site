// Scroll-driven steel panels on a fixed canvas behind the page. startMap() returns { stop() } or null when the map may not run.
import { mayRun, nextLevel } from './gate.js';
import { PANEL_IDS, LINKS, SCATTER, layoutFor, timelineAt, shotAt, linkAmount, assembleAmount } from './cues.js';
import { ICONS } from './icons.js';
import { damp, panelPose, focusAmount } from './motion.js';

const INK = '#14110e';
// ACES darkens the background a little; this gain makes the canvas match --ink on the page around it
const BG_GAIN = 3.0;
const EXPOSURE = 1.0;
const PHONE_DPR = 1.75;
const DESKTOP_DPR = 2;
const LOW_DPR = 1.25;
const FPS_WINDOW = 60;
const FPS_GRACE_MS = 2000;
const POINTER_TILT = 0.12;
const RECEDE = 0.55; // how much panels out of focus dim during a beat, so the text over them stays readable

const mq = (q) => window.matchMedia(q);

export async function startMap({ root, canvas }) {
  const force = new URLSearchParams(location.search).get('map') === 'force';
  const reduced = mq('(prefers-reduced-motion: reduce)');
  const gate = () => mayRun({
    webgl2: !!window.WebGL2RenderingContext, reducedMotion: reduced.matches,
    saveData: !!navigator.connection?.saveData, deviceMemory: navigator.deviceMemory, force,
  });
  if (!gate()) return null;
  const sections = [root.querySelector('#hero'), ...PANEL_IDS.map((id) => root.querySelector(`.beat[data-panel="${id}"]`)), root.querySelector('.flow')];
  if (sections.some((s) => !s)) return null;

  const [T3, panelsMod, studioMod, linksMod] = await Promise.all([
    import('../vendor/three/three.bundle.min.js'), import('./panels.js'), import('./studio.js'), import('./links.js'),
  ]);
  if (!gate()) return null; // reduced motion may have flipped while loading

  const html = document.documentElement;
  const signal = getComputedStyle(html).getPropertyValue('--signal').trim() || '#f0c987';
  const cleanups = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  const renderer = new T3.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = T3.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  const scene = new T3.Scene();
  scene.background = new T3.Color(INK).multiplyScalar(BG_GAIN);
  const camera = new T3.PerspectiveCamera(30, 1, 1, 600);
  const target = new T3.WebGLRenderTarget(4, 4, { type: T3.HalfFloatType, samples: 4 });
  const composer = new T3.EffectComposer(renderer, target);
  const bloom = new T3.UnrealBloomPass(new T3.Vector2(4, 4), 0.3, 0.45, 1.3);
  composer.addPass(new T3.RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new T3.OutputPass());

  scene.environment = studioMod.buildEnvironment(T3, renderer);
  scene.environmentIntensity = 1;
  const panels = panelsMod.buildPanels(T3, PANEL_IDS, ICONS);
  const baseColours = new Map();
  for (const id of PANEL_IDS) for (const m of [panels.byId[id].userData.face, panels.byId[id].userData.bevel]) {
    m.emissive.set(signal); m.emissiveIntensity = 0; baseColours.set(m, m.color.clone());
  }
  const links = linksMod.buildLinks(T3, LINKS, signal);
  scene.add(panels.group, links.group);

  // ---- state ----
  let width = 1, height = 1, aspect = 1, layout = layoutFor(1), tops = [], heights = [];
  let level = 0, pixelCap = DESKTOP_DPR;
  let T = 0, time = 0, last = 0, raf = 0, visible = false, stopped = false;
  let fpsTime = 0, fpsFrames = 0, levelAt = 0, ring = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const glint = Object.fromEntries(PANEL_IDS.map((id) => [id, 0]));
  let prevAmounts = null, prevAssembled = null;

  const measure = () => {
    const y = window.scrollY;
    tops = sections.map((s) => s.getBoundingClientRect().top + y);
    heights = sections.map((s) => s.offsetHeight);
  };
  const resize = () => {
    width = Math.max(1, html.clientWidth);
    height = Math.max(1, html.clientHeight);
    aspect = width / height;
    pixelCap = mq('(pointer: coarse)').matches || width < 760 ? PHONE_DPR : DESKTOP_DPR;
    const pr = Math.min(devicePixelRatio || 1, level >= 1 ? LOW_DPR : pixelCap);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    camera.aspect = aspect;
    layout = layoutFor(aspect);
    measure();
  };

  function frame(raw) {
    const dt = Math.min(raw, 0.05);
    time += dt;
    const measured = timelineAt(tops, heights, window.scrollY, innerHeight);
    T += (measured - T) * damp(raw, 7); // ease toward the scroll position so jittery scrolling stays smooth
    pointer.x += (pointer.tx - pointer.x) * damp(raw, 3);
    pointer.y += (pointer.ty - pointer.y) * damp(raw, 3);

    const shot = shotAt(T, aspect);
    const face = [shot.polar - Math.PI / 2, shot.azimuth];
    const positions = {};
    PANEL_IDS.forEach((id, i) => {
      const p = panelPose({ index: i, T, time, scatter: SCATTER[id], layout: layout[id], face });
      const obj = panels.byId[id];
      obj.position.set(...p.pos);
      obj.rotation.set(...p.rot);
      positions[id] = obj.position;
    });

    const amounts = LINKS.map((l) => linkAmount(T, l.at));
    const assembled = assembleAmount(T) >= 1;
    if (prevAmounts) {
      LINKS.forEach((l, i) => { if (prevAmounts[i] < 1 && amounts[i] >= 1) glint[l.to] = 1; });
      if (!prevAssembled && assembled) ring = 1;
    }
    prevAmounts = amounts;
    prevAssembled = assembled;
    ring *= Math.exp(-dt * 1.3);
    const focus = PANEL_IDS.map((_, i) => focusAmount(T, i + 1));
    const anyFocus = Math.max(...focus);
    PANEL_IDS.forEach((id, i) => {
      glint[id] *= Math.exp(-dt * 2.4);
      const bright = 1 - RECEDE * anyFocus * (1 - focus[i]);
      const g = Math.max(glint[id], ring * 0.75);
      const { face: f, bevel } = panels.byId[id].userData;
      bevel.emissiveIntensity = g * 1.4;
      f.emissiveIntensity = g * 0.18;
      f.color.copy(baseColours.get(f)).multiplyScalar(bright);
      bevel.color.copy(baseColours.get(bevel)).multiplyScalar(bright);
    });
    links.update(positions, amounts, time, ring);

    const [tx, ty, tz] = shot.target;
    const sp = Math.sin(shot.polar);
    camera.position.set(
      tx + shot.distance * sp * Math.sin(shot.azimuth) + pointer.x * 1.6 + Math.sin(time * 0.17) * 0.5,
      ty + shot.distance * Math.cos(shot.polar) - pointer.y * 1.0 + Math.sin(time * 0.13) * 0.3,
      tz + shot.distance * sp * Math.cos(shot.azimuth),
    );
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(width, height, -shot.shiftX * width, 0, width, height);
    scene.environmentRotation.set(pointer.y * 0.05, pointer.x * POINTER_TILT + Math.sin(time * 0.12) * 0.12 + time * 0.01, 0);
    composer.render(dt);
  }

  // ---- loop, visibility, quality ----
  const stopLoop = () => { cancelAnimationFrame(raf); raf = 0; };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const raw = (now - last) / 1000;
    last = now;
    if (raw > 0.5) return; // first frame after a pause
    frame(raw);
    if (force) return;
    fpsTime += raw; fpsFrames += 1;
    if (fpsFrames < FPS_WINDOW) return;
    const next = now - levelAt > FPS_GRACE_MS ? nextLevel(fpsFrames / fpsTime, level) : level;
    fpsTime = 0; fpsFrames = 0;
    if (next !== level) { level = next; levelAt = now; applyLevel(); }
  };
  const syncLoop = () => {
    const run = visible && !document.hidden && !stopped;
    canvas.style.visibility = visible ? '' : 'hidden';
    if (run && !raf) { last = performance.now(); fpsTime = 0; fpsFrames = 0; raf = requestAnimationFrame(tick); }
    if (!run && raf) stopLoop();
  };
  function applyLevel() {
    if (level >= 3) { stop(); return; }
    if (level >= 2) bloom.enabled = false;
    resize();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    stopLoop();
    cleanups.forEach((fn) => fn());
    html.classList.remove('map-live', 'map-shown');
    canvas.style.visibility = '';
    panelsMod.disposePanels(panels);
    links.dispose();
    scene.environment?.dispose();
    composer.dispose();
    target.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    delete window.__map;
  }

  // ---- wire up ----
  resize();
  let resizeTimer = 0;
  on(window, 'resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
  cleanups.push(() => clearTimeout(resizeTimer));
  on(window, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  on(document, 'visibilitychange', syncLoop);
  on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); stop(); });
  on(reduced, 'change', () => { if (reduced.matches) stop(); });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; syncLoop(); });
  io.observe(root);
  cleanups.push(() => io.disconnect());
  // fonts and the language toggle change text height, which moves the section offsets
  const ro = new ResizeObserver(measure);
  ro.observe(root);
  cleanups.push(() => ro.disconnect());
  document.fonts?.ready.then(() => { if (!stopped) measure(); });

  try {
    await renderer.compileAsync(scene, camera);
    if (stopped) return null;
    T = timelineAt(tops, heights, window.scrollY, innerHeight);
    last = performance.now();
    frame(0.016);
  } catch (err) {
    stop();
    throw err;
  }
  if (force) {
    window.__map = { get T() { return T; } };
  }
  html.classList.add('map-live');
  // the next frame starts the fade; the stills hide when it has finished (see site.css)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (stopped) return;
    html.classList.add('map-shown');
  }));
  return { stop };
}
