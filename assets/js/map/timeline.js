// Where the timeline's sections sit in the page: one top and height (CSS px) per stop, hero, six panels, flow.
// The map engine turns scroll into the timeline position with these, and the step arrows aim at the same positions,
// so both always agree. No imports beyond cues.js: the arrows load this without the map.
import { PANEL_IDS } from './cues.js';

const N = PANEL_IDS.length;

// Pure. Desktop: the sections as they are (`hero`, `beats`, `flow`: { top, height }).
// Phone: the panels are pinned frames stacked on each other, so their own boxes sit at the pinned position. Their place
// in the flow is the first frame's top (`base`) plus whole units (`unit`: a frame and its margin); the flow text counts
// as the end of the last unit, and the held map (`hold`, not the text) is the flow stop, so the map assembles while the
// text scrolls away.
export function timelineBoxes({ phone, hero, beats, flow, base, unit, hold }) {
  if (!phone) {
    const all = [hero, ...beats, flow];
    return { tops: all.map((b) => b.top), heights: all.map((b) => b.height) };
  }
  const frames = PANEL_IDS.map((_, i) => base + i * unit);
  return {
    tops: [hero.top, ...frames, hold.top],
    heights: [hero.height, ...frames.map((top, i) => (i === N - 1 ? hold.top - top : unit)), hold.height],
  };
}

// Reads the boxes from the page. `phone`: the phone layout is on (site.css, max-width 759px).
export function measureTimeline(root, phone) {
  const y = window.scrollY;
  const box = (el) => ({ top: el.getBoundingClientRect().top + y, height: el.offsetHeight });
  const hero = root.querySelector('#hero');
  const beats = PANEL_IDS.map((id) => root.querySelector(`.beat[data-panel="${id}"]`));
  const beatsEl = root.querySelector('.beats');
  const holdEl = root.querySelector('.flow-hold');
  if (phone && beatsEl && holdEl) {
    const unit = beats[0].offsetHeight + parseFloat(getComputedStyle(beats[0]).marginBottom);
    return timelineBoxes({ phone, hero: box(hero), base: box(beatsEl).top, unit, hold: box(holdEl) });
  }
  return timelineBoxes({ phone: false, hero: box(hero), beats: beats.map(box), flow: box(root.querySelector('.flow')) });
}
