// Command palette (Esc or Ctrl+K). Also doubles as the little prompt used to ask
// for a custom time or word count.

import { openOverlay, closeOverlay, isOverlayOpen } from './overlay.js';
import { animate } from './anim.js';

const $ = (sel) => document.querySelector(sel);

export function createPalette({ getCommands, onClose }) {
  const root = $('#palette');
  const input = $('#palette-input');
  const list = $('#palette-list');
  const hint = $('#palette-hint');

  let shown = [];
  let selected = 0;
  let prompt = null; // { min, max, resolve } while asking for a number

  function matches(cmd, terms) {
    const hay = `${cmd.title} ${cmd.group} ${cmd.keywords ?? ''}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  }

  function render() {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    shown = getCommands().filter((c) => matches(c, terms));
    selected = Math.min(selected, Math.max(0, shown.length - 1));
    list.replaceChildren(
      ...(shown.length
        ? shown.map((cmd, i) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.className = (i === selected ? 'selected ' : '') + (cmd.active?.() ? 'on' : '');
            li.innerHTML = '<span><i class="mark">&bull;</i> <span class="t"></span></span><span class="group"></span>';
            li.querySelector('.t').textContent = cmd.title;
            li.querySelector('.group').textContent = cmd.group;
            li.addEventListener('pointermove', () => select(i, false));
            li.addEventListener('click', () => run(cmd));
            return li;
          })
        : [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'no matching commands' })]),
    );
  }

  function select(i, scroll = true) {
    if (!shown.length) return;
    selected = (i + shown.length) % shown.length;
    [...list.children].forEach((li, k) => li.classList.toggle('selected', k === selected));
    if (scroll) list.children[selected].scrollIntoView({ block: 'nearest' });
  }

  function run(cmd) {
    closeOverlay();
    cmd.run();
  }

  function submitPrompt() {
    const value = Number(input.value.trim());
    if (!Number.isInteger(value) || value < prompt.min || value > prompt.max) {
      input.classList.add('invalid');
      animate(input, [
        { transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-6px, 0, 0)' },
        { transform: 'translate3d(5px, 0, 0)' }, { transform: 'translate3d(0, 0, 0)' },
      ], { duration: 220 });
      return;
    }
    const { resolve } = prompt;
    prompt = null;
    resolve(value);
    closeOverlay();
  }

  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    if (!prompt) { selected = 0; render(); }
  });

  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); closeOverlay(); return; }
    if (prompt) {
      if (e.key === 'Enter') { e.preventDefault(); submitPrompt(); }
      return;
    }
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); select(selected + 1); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); select(selected - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[selected]) run(shown[selected]); }
    else if (e.key === 'Tab') e.preventDefault();
  });

  const finish = () => {
    if (prompt) { prompt.resolve(null); prompt = null; }
    onClose?.();
  };

  return {
    open() {
      prompt = null;
      input.value = '';
      input.placeholder = 'Type a command';
      input.inputMode = 'text';
      input.classList.remove('invalid');
      list.hidden = false;
      hint.textContent = '';
      selected = 0;
      render();
      openOverlay(root, { onClose: finish });
      input.focus({ preventScroll: true });
    },

    toggle() {
      if (isOverlayOpen()) closeOverlay();
      else this.open();
    },

    /** Ask for an integer in [min, max]. Resolves with the number, or null if dismissed. */
    ask({ title, min, max, initial = '' }) {
      return new Promise((resolve) => {
        prompt = { min, max, resolve };
        input.value = String(initial);
        input.placeholder = title;
        input.inputMode = 'numeric';
        input.classList.remove('invalid');
        list.hidden = true;
        hint.textContent = `a whole number from ${min} to ${max}, then enter`;
        openOverlay(root, { onClose: finish });
        input.focus({ preventScroll: true });
        input.select();
      });
    },
  };
}
