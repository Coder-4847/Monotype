// Small animation toolkit. Everything goes through the Web Animations API on
// opacity/transform, and collapses to nothing when the user prefers reduced motion.

const query = window.matchMedia('(prefers-reduced-motion: reduce)');

export const reducedMotion = () => query.matches;
export const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';

const running = new WeakMap();

/**
 * Play keyframes on an element. Resolves with the animation when it finishes,
 * or null when something else cancelled it. A newer animation on the same
 * element replaces the old one, so rapid state changes never pile up.
 */
export async function animate(el, frames, { duration = 240, delay = 0, easing = EASE, fill = 'none' } = {}) {
  if (!el) return null;
  running.get(el)?.cancel();
  const quiet = reducedMotion();
  const anim = el.animate(frames, { duration: quiet ? 0 : duration, delay: quiet ? 0 : delay, easing, fill });
  running.set(el, anim);
  try {
    await anim.finished;
    return anim;
  } catch {
    return null;
  }
}

/** Reveal an element: unhide it and fade/slide it into place. */
export function fadeIn(el, { y = 8, duration = 260, delay = 0 } = {}) {
  el.hidden = false;
  return animate(el, [
    { opacity: 0, transform: `translate3d(0, ${y}px, 0)` },
    { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  ], { duration, delay });
}

/** Fade an element out and hide it. If interrupted it is left alone. */
export async function fadeOut(el, { y = -6, duration = 180 } = {}) {
  if (el.hidden) return;
  const anim = await animate(el, [
    { opacity: 1, transform: 'translate3d(0, 0, 0)' },
    { opacity: 0, transform: `translate3d(0, ${y}px, 0)` },
  ], { duration, fill: 'forwards' });
  if (!anim) return;
  el.hidden = true; // same microtask as the finish, so no frame is painted between
  anim.cancel();
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const counters = new WeakMap();

/** Count a number up from `from` to `to` with rAF. Text is always the final value if motion is reduced. */
export function countUp(el, to, { from = 0, duration = 900, decimals = 0, suffix = '', delay = 0 } = {}) {
  const format = (v) => v.toFixed(decimals) + suffix;
  counters.get(el)?.();
  if (reducedMotion() || duration <= 0) {
    el.textContent = format(to);
    return Promise.resolve();
  }
  el.textContent = format(from);
  return new Promise((resolve) => {
    let raf = 0;
    let start = 0;
    const stop = () => { cancelAnimationFrame(raf); resolve(); };
    counters.set(el, stop);
    const step = (now) => {
      start ||= now + delay;
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      el.textContent = format(from + (to - from) * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(step);
      else { counters.delete(el); resolve(); }
    };
    raf = requestAnimationFrame(step);
  });
}

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));
