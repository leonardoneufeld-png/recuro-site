// Scroll-driven steel panels on a fixed canvas behind the page. startMap() returns { stop() } or null when the map may not run.
import { mayRun, nextLevel, ladderActive, isLocalHost, estimateRefreshHz, resizeMatters, LAST_LEVEL, LOW_PIXEL_RATIO } from './gate.js';
import { PANEL_IDS, LINKS, SCATTER, layoutFor, timelineAt, shotAt, linkAmount, assembleAmount } from './cues.js';
import { ICONS } from './icons.js';
import { damp, panelPose, focusAmount } from './motion.js';

const INK = '#14110e';
// ACES darkens the background a little; this gain makes the canvas match --ink on the page around it
const BG_GAIN = 1.67;
const EXPOSURE = 1.8;
const PHONE_DPR = 1.75;
const DESKTOP_DPR = 2;
const FPS_WINDOW = 60;
const FPS_GRACE_MS = 2000;
const POINTER_TILT = 0.12;
const RECEDE = 1; // out-of-focus panels fade and shrink a little during a beat: only the plate in focus is lit
const N = PANEL_IDS.length;

const mq = (q) => window.matchMedia(q);

export async function startMap({ root, canvas }) {
  const force = new URLSearchParams(location.search).get('map') === 'force';
  const local = isLocalHost(location.hostname);
  const ladderOn = ladderActive(force, location.hostname);
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
  const coarse = mq('(pointer: coarse)').matches;
  const cleanups = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  // everything below may be half built when stop() runs, so stop() checks each piece
  let renderer = null, composer = null, bloom = null, panels = null, links = null, scene = null, writeTarget = null;
  let stopped = false, raf = 0;

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    raf = 0;
    cleanups.forEach((fn) => fn());
    html.classList.remove('map-live', 'map-shown');
    canvas.style.visibility = '';
    canvas.style.width = canvas.style.height = '';
    if (panels) panelsMod.disposePanels(panels);
    links?.dispose();
    scene?.environment?.dispose();
    composer?.dispose();
    writeTarget?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    if (local) delete window.__map;
  }

  try {
    renderer = new T3.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    const gl = renderer.getContext();
    // a half-float target needs one of these; without it the map falls back to an 8-bit target and no bloom
    const hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    renderer.toneMapping = T3.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE;
    scene = new T3.Scene();
    scene.background = new T3.Color(INK).multiplyScalar(BG_GAIN);
    const camera = new T3.PerspectiveCamera(30, 1, 1, 600);
    // the composer renders the scene into its read buffer; only that one is multisampled
    writeTarget = new T3.WebGLRenderTarget(4, 4, hdr ? { type: T3.HalfFloatType, samples: 0 } : { samples: 0 });
    composer = new T3.EffectComposer(renderer, writeTarget);
    const sceneTarget = composer.readBuffer;
    const samples = coarse ? 2 : 4;
    sceneTarget.samples = samples;
    bloom = new T3.UnrealBloomPass(new T3.Vector2(4, 4), 0.45, 0.5, 1.15);
    bloom.enabled = hdr;
    composer.addPass(new T3.RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(new T3.OutputPass());

    const signal = getComputedStyle(html).getPropertyValue('--signal').trim() || '#f0c987';
    scene.environment = studioMod.buildEnvironment(T3, renderer);
    scene.environmentIntensity = 1;
    panels = panelsMod.buildPanels(T3, PANEL_IDS, ICONS);
    for (const id of PANEL_IDS) for (const m of [panels.byId[id].userData.face, panels.byId[id].userData.bevel]) {
      m.emissive.set(signal); m.emissiveIntensity = 0;
    }
    links = linksMod.buildLinks(T3, LINKS, signal);
    scene.add(panels.group, links.group);

    // ---- state ----
    let size = { width: 1, height: 1 }, aspect = 1, layout = layoutFor(1), tops = [], heights = [];
    let level = 0, pixelRatio = 1, msaa = samples;
    let T = 0, time = 0, last = 0, visible = false;
    let fpsTime = 0, fpsFrames = 0, levelAt = performance.now(), ring = 0, havePrev = false, prevAssembled = false;
    const intervals = [];
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const glint = Object.fromEntries(PANEL_IDS.map((id) => [id, 0]));
    // scratch values reused every frame
    const amounts = LINKS.map(() => 0);
    const prevAmounts = LINKS.map(() => 0);
    const focus = PANEL_IDS.map(() => 0);
    const face = [0, 0];
    const pose = { pos: [0, 0, 0], rot: [0, 0, 0] };
    const positions = Object.fromEntries(PANEL_IDS.map((id) => [id, panels.byId[id].position]));

    const measure = () => {
      const y = window.scrollY;
      tops = sections.map((s) => s.getBoundingClientRect().top + y);
      heights = sections.map((s) => s.offsetHeight);
    };
    const applySize = () => {
      size = { width: Math.max(1, html.clientWidth), height: Math.max(1, html.clientHeight) };
      aspect = size.width / size.height;
      const cap = coarse || size.width < 760 ? PHONE_DPR : DESKTOP_DPR;
      pixelRatio = Math.min(devicePixelRatio || 1, level >= 1 ? LOW_PIXEL_RATIO : cap);
      // fixed pixel size, so a collapsing mobile toolbar never stretches the picture
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(size.width, size.height, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(size.width, size.height);
      camera.aspect = aspect;
      layout = layoutFor(aspect);
      measure();
    };

    function frame(raw) {
      const dt = Math.min(raw, 0.05);
      time += dt;
      const measured = timelineAt(tops, heights, window.scrollY, innerHeight);
      T += (measured - T) * damp(raw, 7); // ease toward the scroll position so jittery scrolling stays smooth
      if (!Number.isFinite(T)) T = Number.isFinite(measured) ? measured : 0;
      pointer.x += (pointer.tx - pointer.x) * damp(raw, 3);
      pointer.y += (pointer.ty - pointer.y) * damp(raw, 3);

      const shot = shotAt(T, aspect);
      face[0] = shot.polar - Math.PI / 2;
      face[1] = shot.azimuth;
      let anyFocus = 0;
      for (let i = 0; i < N; i++) {
        focus[i] = focusAmount(T, i + 1);
        if (focus[i] > anyFocus) anyFocus = focus[i];
      }
      for (let i = 0; i < N; i++) {
        const id = PANEL_IDS[i];
        panelPose({ index: i, T, time, scatter: SCATTER[id], layout: layout[id], face }, pose);
        const obj = panels.byId[id];
        obj.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
        obj.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2]);
      }
      for (let i = 0; i < LINKS.length; i++) amounts[i] = linkAmount(T, LINKS[i].at);
      const assembled = assembleAmount(T) >= 1;
      if (havePrev) {
        for (let i = 0; i < LINKS.length; i++) if (prevAmounts[i] < 1 && amounts[i] >= 1) glint[LINKS[i].to] = 1;
        if (!prevAssembled && assembled) ring = 1;
      }
      for (let i = 0; i < LINKS.length; i++) prevAmounts[i] = amounts[i];
      havePrev = true;
      prevAssembled = assembled;
      ring *= Math.exp(-dt * 1.3);
      for (let i = 0; i < N; i++) {
        const id = PANEL_IDS[i];
        glint[id] *= Math.exp(-dt * 2.4);
        const away = anyFocus * (1 - focus[i]);
        const bright = 1 - RECEDE * away; // opacity: a faded plate melts into the dark room instead of showing as a black slab
        const obj = panels.byId[id];
        obj.scale.setScalar(1 - 0.3 * away);
        const g = Math.max(glint[id], ring * 0.75);
        const { face: f, bevel } = obj.userData;
        bevel.emissiveIntensity = g * 1.4;
        f.emissiveIntensity = g * 0.18;
        f.opacity = bevel.opacity = bright;
        obj.visible = bright > 0.02;
      }
      links.update(positions, amounts, time, ring);

      const sp = Math.sin(shot.polar);
      camera.position.set(
        shot.target[0] + shot.distance * sp * Math.sin(shot.azimuth) + pointer.x * 1.6 + Math.sin(time * 0.17) * 0.5,
        shot.target[1] + shot.distance * Math.cos(shot.polar) - pointer.y * 1.0 + Math.sin(time * 0.13) * 0.3,
        shot.target[2] + shot.distance * sp * Math.cos(shot.azimuth),
      );
      camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
      camera.setViewOffset(size.width, size.height, -shot.shiftX * size.width, 0, size.width, size.height);
      scene.environmentRotation.set(pointer.y * 0.05, pointer.x * POINTER_TILT + Math.sin(time * 0.12) * 0.12 + time * 0.01, 0);
      composer.render(dt);
    }

    // ---- quality ladder: 1 lower resolution, 2 no multisampling, 3 no bloom, 4 stills ----
    function applyLevel() {
      if (level >= LAST_LEVEL) { stop(); return; }
      if (level >= 2 && msaa > 0) {
        msaa = 0;
        sceneTarget.samples = 0;
        sceneTarget.dispose(); // three allocates it again, without multisampling, on the next render
      }
      if (level >= 3) bloom.enabled = false;
      applySize();
    }
    function judgeFrames(now) {
      if (now - levelAt < FPS_GRACE_MS) { fpsTime = 0; fpsFrames = 0; return; } // start-up and resumes are not scored
      if (fpsFrames < FPS_WINDOW) return;
      const next = nextLevel(fpsFrames / fpsTime, level, {
        refreshHz: estimateRefreshHz(intervals), pixelRatio, samples: msaa, bloom: bloom.enabled,
      });
      fpsTime = 0; fpsFrames = 0;
      if (next === level) return;
      level = next;
      levelAt = now;
      applyLevel();
    }

    // ---- loop and visibility ----
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const raw = (now - last) / 1000;
      last = now;
      if (raw > 0.5) return; // first frame after a pause
      try {
        frame(raw);
      } catch {
        stop(); // a frozen canvas with the stills hidden is the worst outcome; give the stills back
        return;
      }
      if (!ladderOn) return;
      fpsTime += raw; fpsFrames += 1;
      intervals.push(raw);
      if (intervals.length > FPS_WINDOW) intervals.shift();
      judgeFrames(now);
    };
    const syncLoop = () => {
      const run = visible && !document.hidden && !stopped;
      canvas.style.visibility = visible ? '' : 'hidden';
      if (run && !raf) { last = performance.now(); levelAt = last; fpsTime = 0; fpsFrames = 0; raf = requestAnimationFrame(tick); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    // ---- wire up ----
    applySize();
    let resizeTimer = 0;
    on(window, 'resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (resizeMatters(size, { width: html.clientWidth, height: html.clientHeight }, coarse)) applySize();
      }, 150);
    });
    cleanups.push(() => clearTimeout(resizeTimer));
    on(window, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
    on(document, 'visibilitychange', syncLoop);
    on(canvas, 'webglcontextlost', (e) => { e.preventDefault(); stop(); });
    on(reduced, 'change', () => { if (reduced.matches) stop(); });
    const io = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; syncLoop(); });
    io.observe(root);
    cleanups.push(() => io.disconnect());
    // fonts and the language toggle change text height, which moves the section offsets
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    cleanups.push(() => ro.disconnect());
    document.fonts?.ready.then(() => { if (!stopped) measure(); });

    await renderer.compileAsync(scene, camera);
    if (stopped) return null;
    T = timelineAt(tops, heights, window.scrollY, innerHeight);
    last = performance.now();
    levelAt = last; // the first two seconds are never scored
    frame(0.016);
    // the frame must really be on the canvas before the stills give way
    const px = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (px[0] + px[1] + px[2] === 0) { stop(); return null; } // alpha is always 255 here, so only the colour counts

    if (force && local) window.__map = { get T() { return T; } };
    html.classList.add('map-live');
    // the next frame starts the fade; the stills fade out with it (see site.css)
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!stopped) html.classList.add('map-shown'); }));
    return { stop };
  } catch {
    stop();
    return null;
  }
}
