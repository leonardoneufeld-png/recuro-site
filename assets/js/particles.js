// Ink-dot text: the rule sentence is redrawn as fine dots that part under the pointer
// and settle back. The real text stays in the DOM (transparent) for screen readers,
// search and copy. Physics mutates typed arrays in place: allocation-free per frame.

const RADIUS = 70;      // CSS px around the pointer that pushes dots
const PUSH = 5;         // push strength at the pointer centre
const SPRING = 0.045;   // pull back toward home
const DAMP = 0.84;      // velocity kept per frame
const REST = 0.05;      // below this a dot counts as settled
const STEP = 2;         // sample every 2 CSS px
const DOT = 1.5;        // dot size, CSS px
const PAD = 24;         // canvas bleed so pushed dots aren't clipped
const ENTRANCE = 48;    // scatter distance for the first appearance

export const createField = (points) => {
  const n = points.length / 2;
  const hx = new Float32Array(n), hy = new Float32Array(n);
  for (let i = 0; i < n; i++) { hx[i] = points[2 * i]; hy[i] = points[2 * i + 1]; }
  return { n, hx, hy, x: hx.slice(), y: hy.slice(), vx: new Float32Array(n), vy: new Float32Array(n) };
};

export const scatter = (f, dist, rand = Math.random) => {
  for (let i = 0; i < f.n; i++) {
    const a = rand() * Math.PI * 2, r = dist * (0.3 + 0.7 * rand());
    f.x[i] = f.hx[i] + Math.cos(a) * r;
    f.y[i] = f.hy[i] + Math.sin(a) * r;
  }
};

// One frame. Returns true while anything still moves.
export const stepField = (f, pointer) => {
  let moving = false;
  for (let i = 0; i < f.n; i++) {
    let vx = f.vx[i], vy = f.vy[i];
    if (pointer) {
      const dx = f.x[i] - pointer.x, dy = f.y[i] - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < RADIUS) {
        const force = (1 - d / RADIUS) * PUSH;
        vx += (dx / d) * force; vy += (dy / d) * force;
      }
    }
    const ox = f.hx[i] - f.x[i], oy = f.hy[i] - f.y[i];
    vx = (vx + ox * SPRING) * DAMP; vy = (vy + oy * SPRING) * DAMP;
    if (Math.abs(vx) < REST && Math.abs(vy) < REST && Math.abs(ox) < REST * 4 && Math.abs(oy) < REST * 4) {
      f.x[i] = f.hx[i]; f.y[i] = f.hy[i]; f.vx[i] = 0; f.vy[i] = 0;
      continue;
    }
    f.x[i] += vx; f.y[i] += vy; f.vx[i] = vx; f.vy[i] = vy;
    moving = true;
  }
  return moving;
};

// Inked pixels of an RGBA buffer (device px), returned as flat [x, y, ...] in CSS px.
export const samplePoints = (data, w, h, step, scale) => {
  const out = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 127) out.push(x / scale, y / scale);
    }
  }
  return out;
};

// Draw each character where the browser laid it out, so wrapping and letter-spacing match.
const rasterise = (el, w, h, dpr) => {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const cs = getComputedStyle(el);
  ctx.scale(dpr, dpr);
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('H');
  const ascent = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent * 1.25;
  const base = el.getBoundingClientRect();
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let i = 0; i < node.length; i++) {
      const ch = node.data[i];
      if (!ch.trim()) continue;
      range.setStart(node, i); range.setEnd(node, i + 1);
      const r = range.getClientRects()[0];
      if (r) ctx.fillText(ch, r.left - base.left + PAD, r.top - base.top + PAD + ascent);
    }
  }
  return samplePoints(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, Math.round(STEP * dpr), dpr);
};

export const initParticles = (el) => {
  const host = el.parentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'particles';
  canvas.setAttribute('aria-hidden', 'true');
  host.insertBefore(canvas, el.nextSibling);
  const ctx = canvas.getContext('2d');
  let field = null, pointer = null, raf = 0, visible = false, color = '', dpr = 1;

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    for (let i = 0; i < field.n; i++) ctx.fillRect(field.x[i], field.y[i], DOT, DOT);
  };
  const frame = () => {
    raf = 0;
    const moving = stepField(field, pointer);
    draw();
    if (moving || pointer) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (field && visible && !raf) raf = requestAnimationFrame(frame); };

  const build = () => {
    try {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      color = getComputedStyle(host).color;
      const w = el.offsetWidth + PAD * 2, h = el.offsetHeight + PAD * 2;
      Object.assign(canvas.style, { left: `${el.offsetLeft - PAD}px`, top: `${el.offsetTop - PAD}px`, width: `${w}px`, height: `${h}px` });
      canvas.width = Math.ceil(w * dpr); canvas.height = Math.ceil(h * dpr);
      const points = rasterise(el, w, h, dpr);
      if (!points.length) throw new Error('no ink sampled');
      field = createField(points);
      el.classList.add('is-particles');
      if (visible) draw();
    } catch {
      // fall back to the plain sentence
      el.classList.remove('is-particles');
      canvas.remove();
      field = null;
    }
  };

  let queued = 0;
  const rebuild = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; build(); }); };

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    kick();
  };
  const release = () => { pointer = null; kick(); };
  canvas.addEventListener('pointermove', local);
  canvas.addEventListener('pointerdown', local);
  ['pointerleave', 'pointercancel', 'pointerup'].forEach((t) => canvas.addEventListener(t, release));

  // first time on screen: the dots gather into the sentence
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || !field) return;
    io.disconnect();
    visible = true;
    scatter(field, ENTRANCE);
    kick();
  }, { rootMargin: '0px 0px -10% 0px' });

  (document.fonts?.ready ?? Promise.resolve()).then(() => {
    build();
    if (!field) return;
    io.observe(canvas);
    new ResizeObserver(rebuild).observe(el);
    // the language toggle rewrites the sentence
    new MutationObserver(rebuild).observe(el, { childList: true, characterData: true, subtree: true });
  });
};
