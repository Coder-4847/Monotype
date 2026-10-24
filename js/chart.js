// Tiny SVG line charts: the WPM-over-time chart on the results screen and the
// sparkline in the history panel. No libraries; colours come from CSS classes.

import { animate, EASE_IN_OUT, reducedMotion } from './anim.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent?.append(node);
  return node;
}

/** 1, 2 or 5 times a power of ten that is at least `raw`. */
function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const mult of [1, 2, 5, 10]) if (mult * pow >= raw) return mult * pow;
  return 10 * pow;
}

/**
 * Smooth path through the points that never overshoots (monotone cubic,
 * Fritsch-Carlson), so the line doesn't dip below zero between samples.
 */
export function smoothPath(pts) {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]} ${pts[0][1]}`;
  const dx = [];
  const d = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    d[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[n - 1] = d[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let path = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    path += `C${x0 + dx[i] / 3} ${y0 + (m[i] * dx[i]) / 3} ${x1 - dx[i] / 3} ${y1 - (m[i + 1] * dx[i]) / 3} ${x1} ${y1}`;
  }
  return path;
}

/** Draw a line in from left to right. */
function drawIn(path, { duration = 900, delay = 0 } = {}) {
  if (reducedMotion()) return;
  path.setAttribute('pathLength', '1');
  path.style.strokeDasharray = '1';
  animate(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration, delay, easing: EASE_IN_OUT })
    .then(() => { path.style.strokeDasharray = ''; path.removeAttribute('pathLength'); });
}

function fadeInLate(node, delay) {
  if (reducedMotion()) return;
  animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay });
}

/**
 * WPM over time. `samples` are { t, wpm, raw, errors }. Seconds with mistakes get a red dot.
 * Hovering shows the exact numbers.
 */
export function renderResultChart(container, samples, { animated = true } = {}) {
  container.replaceChildren();
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height || !samples.length) return;

  const peak = Math.max(...samples.flatMap((s) => [s.wpm, s.raw]), 1);
  const yStep = niceStep(peak / 4);
  const yMax = Math.ceil(peak / yStep) * yStep;

  // Leave room for the widest y label (these are 7px-wide characters at 11px).
  const pad = { left: Math.max(34, String(Math.round(yMax)).length * 7 + 14), right: 14, top: 10, bottom: 22 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const svg = el('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Words per minute over time' });
  container.append(svg);

  const tMin = samples[0].t;
  const tMax = samples.at(-1).t;
  const [x0, x1] = tMin === tMax ? [tMin - 1, tMax + 1] : [tMin, tMax];
  const X = (t) => pad.left + ((t - x0) / (x1 - x0)) * plotW;
  const Y = (v) => pad.top + plotH - (v / yMax) * plotH;

  const grid = el('g', {}, svg);
  for (let v = 0; v <= yMax + 1e-9; v += yStep) {
    el('line', { class: 'grid', x1: pad.left, x2: width - pad.right, y1: Y(v), y2: Y(v) }, grid);
    const label = el('text', { x: pad.left - 8, y: Y(v) + 4, 'text-anchor': 'end' }, grid);
    label.textContent = Math.round(v);
  }
  const xStep = niceStep(Math.max(1, (x1 - x0) / 6));
  for (let t = Math.ceil(x0 / xStep) * xStep; t <= x1 + 1e-9; t += xStep) {
    const label = el('text', { x: X(t), y: height - 4, 'text-anchor': 'middle' }, grid);
    label.textContent = `${t}s`;
  }

  const line = (key, cls) => {
    const pts = samples.map((s) => [X(s.t), Y(s[key])]);
    if (pts.length === 1) return el('circle', { class: cls === 'line-raw' ? 'dot-raw' : 'dot-wpm', cx: pts[0][0], cy: pts[0][1], r: 3 }, svg);
    return el('path', { class: `line ${cls}`, d: smoothPath(pts) }, svg);
  };
  const raw = line('raw', 'line-raw');
  const wpm = line('wpm', 'line-wpm');
  if (animated) { drawIn(raw, { delay: 0 }); drawIn(wpm, { delay: 120 }); }

  const errors = el('g', {}, svg);
  for (const s of samples) {
    if (s.errors > 0) el('circle', { class: 'dot-err', cx: X(s.t), cy: Y(s.wpm), r: 3.5 }, errors);
  }
  if (animated) fadeInLate(errors, 800);

  // Hover read-out: a hairline, a dot on the WPM line and a small tooltip.
  const hair = el('line', { class: 'hairline', y1: pad.top, y2: pad.top + plotH }, svg);
  const dot = el('circle', { class: 'focus-dot', r: 4 }, svg);
  hair.style.opacity = dot.style.opacity = 0;
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  container.append(tip);
  const hit = el('rect', { x: pad.left, y: 0, width: plotW, height, fill: 'transparent' }, svg);

  const hide = () => { hair.style.opacity = dot.style.opacity = tip.style.opacity = 0; };
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('pointermove', (e) => {
    const px = e.clientX - svg.getBoundingClientRect().left;
    let best = samples[0];
    for (const s of samples) if (Math.abs(X(s.t) - px) < Math.abs(X(best.t) - px)) best = s;
    const x = X(best.t);
    hair.setAttribute('x1', x); hair.setAttribute('x2', x);
    dot.setAttribute('cx', x); dot.setAttribute('cy', Y(best.wpm));
    hair.style.opacity = 0.5;
    dot.style.opacity = 1;
    const second = Number.isInteger(best.t) ? best.t : best.t.toFixed(1);
    tip.innerHTML = `${second}s &middot; ${Math.round(best.wpm)} wpm<br>raw ${Math.round(best.raw)}` +
      (best.errors ? ` &middot; <span class="bad">${best.errors} error${best.errors > 1 ? 's' : ''}</span>` : '');
    const left = Math.min(Math.max(x - tip.offsetWidth / 2, 0), width - tip.offsetWidth);
    tip.style.transform = `translate3d(${left}px, ${Math.max(0, Y(best.wpm) - tip.offsetHeight - 12)}px, 0)`;
    tip.style.opacity = 1;
  });
}

/** A bare progress line for the history panel: one value per test, oldest first. */
export function renderSparkline(container, values, { animated = true } = {}) {
  container.replaceChildren();
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height || !values.length) return;

  const pad = 6;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const floor = Math.max(0, lo - (hi - lo) * 0.25 - 1);
  const range = Math.max(hi - floor, 1);
  const X = (i) => pad + (values.length === 1 ? (width - pad * 2) / 2 : (i / (values.length - 1)) * (width - pad * 2));
  const Y = (v) => pad + (height - pad * 2) - ((v - floor) / range) * (height - pad * 2);

  const svg = el('svg', { class: 'chart', width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'WPM over your last tests' });
  container.append(svg);

  const average = values.reduce((a, b) => a + b, 0) / values.length;
  el('line', { class: 'grid', x1: pad, x2: width - pad, y1: Y(average), y2: Y(average), 'stroke-dasharray': '3 4' }, svg);

  const pts = values.map((v, i) => [X(i), Y(v)]);
  if (pts.length > 1) {
    const path = el('path', { class: 'line line-wpm', d: smoothPath(pts), 'stroke-width': 1.75 }, svg);
    if (animated) drawIn(path, { duration: 700 });
  }
  const last = pts.at(-1);
  const end = el('circle', { class: 'dot-wpm', cx: last[0], cy: last[1], r: 3.5 }, svg);
  if (animated) fadeInLate(end, 600);
}
