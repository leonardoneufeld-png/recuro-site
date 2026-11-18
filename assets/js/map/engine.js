// Scroll-driven steel panels on a fixed canvas behind the page. startMap() returns { stop() } or null when the map may not run.
import { mayRun, nextLevel, ladderActive, isLocalHost, estimateRefreshHz, resizeMatters, LAST_LEVEL, LEVEL, pixelRatioFor } from './gate.js';
import {
  PANEL_IDS, LINKS, THREADS, scatterFor, stageCentre, STAGE, PHONE_ASPECT, layoutFor, timelineAt, shotAt, assembleAmount, threadAmount, plateLevel,
  threadFade, ringShow, integrationAt, ringCycle, waveAt, WAVE_SECONDS,
} from './cues.js';
import { ICONS } from './icons.js';
import { damp, panelPose, presenceAmount } from './motion.js';
import { createLook } from './look.js';
import { createDynamics } from './dynamics.js';
import { measureTimeline } from './timeline.js';

const INK = '#14110e';
// ACES darkens the background a little; this gain makes the canvas match --ink on the page around it
const BG_GAIN = 1.67;
const EXPOSURE = 1.8;
const FPS_WINDOW = 60;
const FPS_GRACE_MS = 2000;
const POINTER_TILT = 0.12;
const RECEDE = 1; // out-of-focus panels fade and shrink a little during a beat: only the plate in focus is lit
const N = PANEL_IDS.length;
// gold: everything below scales with `gold` (0 at the hero, 1 on the flow map)
const BLOOM_BASE = 0.4;
const BLOOM_GOLD = 0.15;
const ENV_GOLD = 0.12;
const HAZE_GAIN = 0.055;

const mq = (q) => window.matchMedia(q);

export async function startMap({ root, canvas }) {
  const force = new URLSearchParams(location.search).get('map') === 'force';
  const local = isLocalHost(location.hostname);
  const noGrain = local && new URLSearchParams(location.search).get('grain') === '0'; // for flicker measurements: the grain is noise by design
  const ladderOn = ladderActive(force, location.hostname);
  const reduced = mq('(prefers-reduced-motion: reduce)');
  const gate = () => mayRun({
    webgl2: !!window.WebGL2RenderingContext, reducedMotion: reduced.matches,
    saveData: !!navigator.connection?.saveData, deviceMemory: navigator.deviceMemory, force,
  });
  if (!gate()) return null;
  const sections = [root.querySelector('#hero'), ...PANEL_IDS.map((id) => root.querySelector(`.beat[data-panel="${id}"]`)), root.querySelector('.flow')];
  if (sections.some((s) => !s)) return null;

  const [T3, panelsMod, studioMod, linksMod, glowMod, rigMod, maskMod, grainMod, backdropMod] = await Promise.all([
    // (then the text mask, the film grain and the zone video backdrops)
    import('../vendor/three/three.bundle.min.js'), import('./panels.js'), import('./studio.js'), import('./links.js'), import('./glow.js'), import('./hubrig.js'), import('./textmask.js'), import('./grain.js'), import('./backdrop.js'),
  ]);
  if (!gate()) return null; // reduced motion may have flipped while loading

  const html = document.documentElement;
  const coarse = mq('(pointer: coarse)').matches;
  const cleanups = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  // everything below may be half built when stop() runs, so stop() checks each piece
  let grain = null, mask = null, backdrop = null, renderer = null, composer = null, bloom = null, panels = null, links = null, glow = null, rig = null, scene = null, writeTarget = null;
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
    rig?.dispose();
    glow?.dispose();
    backdrop?.dispose();
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
    const samples = 4; // phones too: their native-pixel picture is the sharp top level, the ladder takes it away if needed
    sceneTarget.samples = samples;
    bloom = new T3.UnrealBloomPass(new T3.Vector2(4, 4), BLOOM_BASE, 0.35, 1.1);
    bloom.enabled = hdr;
    composer.addPass(new T3.RenderPass(scene, camera));
    composer.addPass(bloom);
    // OutputPass swaps the composer's two buffers by default; that is one swap per frame, so the multisampled scene target and
    // the plain one traded places every frame and every edge flickered between smooth and aliased.
    const output = new T3.OutputPass();
    output.needsSwap = false;
    composer.addPass(output);
    grain = grainMod.addGrain(output, 1);
    mask = maskMod.createTextMask(T3, root, html);

    const signal = getComputedStyle(html).getPropertyValue('--signal').trim() || '#f0c987';
    scene.environment = studioMod.buildEnvironment(T3, renderer);
    scene.environmentIntensity = 1;
    panels = panelsMod.buildPanels(T3, PANEL_IDS, ICONS, signal);
    glow = glowMod.buildGlow(T3, signal, N, mask.uniforms);
    PANEL_IDS.forEach((id, i) => {
      const { face: f, bevel: b } = panels.byId[id].userData;
      for (const m of [f, b]) { m.emissive.set(signal); m.emissiveIntensity = 0; }
      panels.byId[id].add(glow.halos[i]);
    });
    rig = rigMod.buildHubRig(T3, { root, html, signal });
    links = linksMod.buildLinks(T3, LINKS, THREADS, signal, { ...panels.byId, hub: rig.group }, PANEL_IDS.map((id) => ({ from: 'hub', to: id })), mask.uniforms);
    const warmLight = new T3.DirectionalLight(signal, 0);
    warmLight.position.set(-30, 20, 60);
    backdrop = backdropMod.buildBackdrop(T3, { floor: scene.background, gain: BG_GAIN });
    scene.add(backdrop.mesh, panels.group, rig.group, links.group, glow.haze, warmLight);

    // ---- state ----
    let size = { width: 1, height: 1 }, aspect = 1, layout = layoutFor(1), scatter = scatterFor(1), stageDelta = 0, tops = [], heights = [];
    let level = 0, pixelRatio = 1, msaa = samples;
    let T = 0, time = 0, last = 0, visible = false, gold = 0, waveClock = -1, halosOn = true;
    let fpsTime = 0, fpsFrames = 0, levelAt = performance.now(), havePrev = false, prevAssembled = false;
    const cycle = ringCycle(LINKS);
    const walkAt = {}; // where each plate sits on the finale wave's walk round the ring
    LINKS.forEach((l, i) => { walkAt[cycle[i].reversed ? l.to : l.from] = cycle[i].order; });
    const look = createLook(T3);
    const dynamics = createDynamics();
    let envClock = 0;
    const intervals = [];
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let mouse = false;
    const glint = Object.fromEntries(PANEL_IDS.map((id) => [id, 0]));
    // scratch values reused every frame
    const amounts = THREADS.map(() => 0);
    const prevAmounts = THREADS.map(() => 0);
    const lit = PANEL_IDS.map(() => 0);
    const linkState = { camera, aspect: 1, layout, spokeHead: 0, spokeGain: 0, spokeWave: -9, spokeWaveGain: 0, time: 0, threads: amounts, ringGain: 0, threadGain: 0, wave: -9, waveGain: 0, cycle };
    const presence = PANEL_IDS.map(() => 0);
    const ndc = new T3.Vector3();
    const face = [0, 0];
    const pose = { pos: [0, 0, 0], rot: [0, 0, 0] };
    const positions = { ...Object.fromEntries(PANEL_IDS.map((id) => [id, panels.byId[id].position])), hub: rig.group.position };

    const phoneQuery = mq('(max-width: 759px)');
    const measure = () => {
      ({ tops, heights } = measureTimeline(root, phoneQuery.matches)); // timeline.js, shared with the step arrows
      if (phoneQuery.matches) {
        const header = document.querySelector('.site-header');
        const hh = header ? header.getBoundingClientRect().height : 0;
        stageDelta = stageCentre(hh, innerHeight, parseFloat(getComputedStyle(root).getPropertyValue('--stage-share')) || STAGE.share) - STAGE.centre;
        return;
      }
      stageDelta = 0;
    };
    const applySize = () => {
      size = { width: Math.max(1, html.clientWidth), height: Math.max(1, html.clientHeight) };
      aspect = size.width / size.height;
      pixelRatio = pixelRatioFor(level, devicePixelRatio);
      // fixed pixel size, so a collapsing mobile toolbar never stretches the picture
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(size.width, size.height, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(size.width, size.height);
      camera.aspect = aspect;
      layout = layoutFor(aspect);
      linkState.layout = layout;
      scatter = scatterFor(aspect);
      measure();
    };

    function frame(raw) {
      const dt = Math.min(raw, 0.05);
      time += dt;
      const dyn = dynamics({ dt, scrollY: window.scrollY, vh: innerHeight });
      envClock += dt * dyn.sweep;
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
        presence[i] = presenceAmount(T, i + 1);
        if (presence[i] > anyFocus) anyFocus = presence[i];
      }
      for (let i = 0; i < N; i++) {
        const id = PANEL_IDS[i];
        panelPose({ index: i, T, time, scatter: scatter[id], layout: layout[id], face }, pose);
        const obj = panels.byId[id];
        obj.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
        obj.rotation.set(pose.rot[0] - dyn.lean, pose.rot[1], pose.rot[2]); // plates lean against the direction of travel
      }
      for (let i = 0; i < THREADS.length; i++) amounts[i] = threadAmount(T, i);
      const assembled = assembleAmount(T) >= 1;
      if (havePrev) {
        for (let i = 0; i < THREADS.length; i++) if (prevAmounts[i] < 1 && amounts[i] >= 1) glint[THREADS[i].to] = 1;
        if (!prevAssembled && assembled) waveClock = 0; // finale: one wave round the ring
      }
      for (let i = 0; i < THREADS.length; i++) prevAmounts[i] = amounts[i];
      havePrev = true;
      prevAssembled = assembled;
      if (waveClock >= 0) { waveClock += dt; if (waveClock > WAVE_SECONDS + 0.3) waveClock = -1; }
      const wave = waveClock >= 0 ? waveAt(waveClock) : -9;
      const assembleNow = assembleAmount(T);
      gold += (integrationAt(T) - gold) * damp(raw, 2.2);
      for (let i = 0; i < N; i++) lit[i] += (plateLevel(T, i) - lit[i]) * damp(raw, 3.2);
      for (let i = 0; i < N; i++) {
        const id = PANEL_IDS[i];
        glint[id] *= Math.exp(-dt * 2.4);
        const away = anyFocus * (1 - presence[i]);
        const obj = panels.byId[id];
        obj.scale.setScalar(1 - 0.3 * away);
        // opacity: a faded plate melts into the dark room instead of showing as a black slab
        look(obj, {
          index: i, lit: lit[i], gold, glint: glint[id], wave, walk: walkAt[id], bright: 1 - RECEDE * away, assemble: assembleNow,
          at: layout[id], time, halosOn, glow,
        });
      }
      const gain = 0.8 + 0.4 * gold;
      for (let i = 0; i < N; i++) panels.byId[PANEL_IDS[i]].updateMatrixWorld(true); // links read the plates' real rims
      linkState.time = time;
      linkState.ringGain = gain * ringShow(T);
      linkState.threadGain = gain * threadFade(T);
      linkState.wave = wave;
      linkState.waveGain = wave > -5 ? 1 : 0;
      bloom.strength = BLOOM_BASE + BLOOM_GOLD * gold;
      scene.environmentIntensity = 1 + ENV_GOLD * gold;
      warmLight.intensity = gold * 0.25;

      const sp = Math.sin(shot.polar);
      camera.position.set(
        shot.target[0] + shot.distance * sp * Math.sin(shot.azimuth) + pointer.x * 1.6 + Math.sin(time * 0.17) * 0.5,
        shot.target[1] + shot.distance * Math.cos(shot.polar) - pointer.y * 1.0 + Math.sin(time * 0.13) * 0.3,
        shot.target[2] + shot.distance * sp * Math.cos(shot.azimuth),
      );
      camera.lookAt(shot.target[0], shot.target[1], shot.target[2]);
      camera.setViewOffset(size.width, size.height, -shot.shiftX * size.width, -(shot.shiftY + stageDelta * (aspect < PHONE_ASPECT ? 1 - assembleNow : 0)) * size.height, size.width, size.height);
      camera.updateMatrixWorld();
      // the room glow sits behind whatever is framed: the screen position of the map once assembled
      const asm = assembleNow;
      ndc.set(0, 0, 0).project(camera);
      glow.setHaze(HAZE_GAIN * gold, (ndc.x * 0.5 + 0.5) * asm + (0.5 + shot.shiftX) * (1 - asm), (ndc.y * 0.5 + 0.5) * asm + 0.5 * (1 - asm), aspect);
      scene.environmentRotation.set(pointer.y * 0.05, pointer.x * POINTER_TILT + Math.sin(envClock * 0.12) * 0.12 + envClock * 0.01, 0);
      linkState.aspect = aspect;
      linkState.stretch = dyn.stretch;
      linkState.maskOn = phoneQuery.matches ? 0 : 1;
      mask.update({ T, width: size.width, height: size.height, ratio: pixelRatio, phone: phoneQuery.matches });
      grain.update(dt, level < LEVEL.bloom && !noGrain, pixelRatio);
      const pulse = rig.update({
        T, raw, dt, time, aspect, size, camera, ndc, pointer, mouse, visible, waveBusy: waveClock >= 0, gold, linkState,
      });
      if (pulse.arrived) PANEL_IDS.forEach((id) => { glint[id] = 1; });
      if (pulse.startRing) waveClock = 0;
      rig.group.updateMatrixWorld(true);
      links.update(positions, linkState);
      backdrop.update(T, dt, aspect);
      composer.render(dt);
    }

    // ---- quality ladder: 1 at most 2x, 2 at most 1.5x, 3 no multisampling, 4 no bloom, 5 stills (gate.js) ----
    function applyLevel() {
      if (level >= LAST_LEVEL) { stop(); return; }
      if (level >= LEVEL.msaa && msaa > 0) {
        msaa = 0;
        sceneTarget.samples = 0;
        sceneTarget.dispose(); // three allocates it again, without multisampling, on the next render
      }
      if (level >= LEVEL.msaa) halosOn = false;
      if (level >= LEVEL.bloom) { bloom.enabled = false; links.setBloom(false); backdrop.off(); }
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
      backdrop.setRunning(run);
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
      mouse = true;
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
    // the frame must really be on the canvas before the stills give way. A first read can come back empty (the canvas
    // is off-screen, or the buffer was presented already), so it gets three tries on fresh frames before the map gives up.
    const px = new Uint8Array(4);
    let painted = false;
    for (let attempt = 0; attempt < 3 && !painted; attempt++) {
      if (attempt) await new Promise((r) => requestAnimationFrame(r));
      if (stopped) return null;
      frame(0.016);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      painted = px[0] + px[1] + px[2] > 0; // alpha is always 255 here, so only the colour counts
    }
    if (!painted) { stop(); return null; }

    // dev only. centre(ids): where the plates (or 'hub') sit on screen, in CSS px, for tools/capture-stills.mjs
    const centre = (ids) => ids.map((id) => ndc.setFromMatrixPosition((id === 'hub' ? rig.group : panels.byId[id]).matrixWorld).project(camera))
      .reduce((s, p) => [s[0] + (p.x + 1) / 2 * size.width / ids.length, s[1] + (1 - p.y) / 2 * size.height / ids.length], [0, 0]);
    if (force && local) window.__map = { get T() { return T; }, get wave() { return waveClock; }, centre };
    html.classList.add('map-live');
    // the next frame starts the fade; the stills fade out with it (see site.css)
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!stopped) html.classList.add('map-shown'); }));
    return { stop };
  } catch {
    stop();
    return null;
  }
}
