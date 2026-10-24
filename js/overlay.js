// Modal overlays (command palette, history). One can be open at a time; the
// rest of the app is made inert while it is, and focus goes back afterwards.

import { animate, EASE } from './anim.js';

const app = document.querySelector('.app');
let current = null;

export const isOverlayOpen = () => current !== null;

export async function openOverlay(el, { onOpen, onClose } = {}) {
  if (current) await closeOverlay();
  current = { el, onClose };
  app.inert = true;
  el.hidden = false;
  onOpen?.();
  const panel = el.querySelector('.panel');
  animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  animate(panel, [
    { opacity: 0, transform: 'translate3d(0, -10px, 0) scale(0.98)' },
    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
  ], { duration: 240, easing: EASE });
}

export async function closeOverlay() {
  if (!current) return;
  const { el, onClose } = current;
  current = null;
  app.inert = false;
  const panel = el.querySelector('.panel');
  animate(panel, [
    { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
    { opacity: 0, transform: 'translate3d(0, -6px, 0) scale(0.99)' },
  ], { duration: 140, fill: 'forwards' });
  const anim = await animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  // `anim` is null if this overlay was reopened meanwhile; skip hiding if another one took over.
  if (anim && current?.el !== el) {
    el.hidden = true;
    anim.cancel();
    panel.getAnimations().forEach((a) => a.cancel());
  }
  onClose?.();
}

// Esc and clicks on the backdrop close whatever is open.
document.addEventListener('keydown', (e) => {
  if (current && e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation(); // otherwise the same Esc would reopen the palette
    closeOverlay();
  }
}, true);

document.addEventListener('pointerdown', (e) => {
  if (current && e.target === current.el) closeOverlay();
});
