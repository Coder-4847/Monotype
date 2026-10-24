// Test-screen UI: the word block, the gliding caret, line scrolling, the live
// readout and the config bar. Nothing here knows about scoring; it just renders
// whatever the engine holds.

import { animate, fadeIn, fadeOut, reducedMotion, nextFrame } from './anim.js';

const CARET_TAU = 55; // ms; time constant of the caret's exponential glide
const CARET_IDLE_MS = 650; // how long after a keystroke before the caret blinks again

const $ = (sel, root = document) => root.querySelector(sel);

// ---------------------------------------------------------------------------
// Word block
// ---------------------------------------------------------------------------

export class TestView {
  constructor() {
    this.typing = $('#typing');
    this.viewport = $('#viewport');
    this.words = $('#words');
    this.caret = $('#caret');
    this.engine = null;
    this.wordEls = [];
    this.dirty = new Set();
    this.lineH = 0;
    this.line = -1;
    this.frame = 0;
    this.idleTimer = 0;

    // Caret position (current and target) in px, relative to the word block.
    this.cx = this.cy = this.tx = this.ty = 0;
    this.caretFrame = 0;
    this.caretLast = 0;

    new ResizeObserver(() => this.#relayout()).observe(this.viewport);
  }

  /** Render a fresh engine: build every word and park the caret on the first one. */
  setTest(engine) {
    this.engine = engine;
    this.wordEls = [];
    this.dirty.clear();
    const frag = document.createDocumentFragment();
    engine.words.forEach((_, i) => frag.append(this.#createWord(i)));
    this.words.replaceChildren(this.caret, frag);
    this.viewport.classList.remove('scrolled');
    this.line = -1;
    this.flush(true);
  }

  /** Queue a repaint of these words; work is batched to one pass per frame. */
  invalidate(indices) {
    for (const i of indices) this.dirty.add(i);
    if (!this.frame) this.frame = requestAnimationFrame(() => this.flush());
  }

  /** Apply pending changes now. `snap` jumps the caret and scroll instead of easing. */
  flush(snap = false) {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const engine = this.engine;
    if (!engine) return;

    this.#syncWordCount();
    for (const i of this.dirty) this.#paint(i);
    this.dirty.clear();

    const word = this.wordEls[engine.index];
    if (!word) return;
    if (!this.lineH) this.lineH = word.offsetHeight;

    // Keep the active line in the middle of the three visible lines.
    const line = Math.round(word.offsetTop / this.lineH);
    if (line !== this.line) {
      this.line = line;
      this.#scrollTo(Math.max(0, line - 1), snap);
      this.viewport.classList.toggle('scrolled', line > 1);
    }

    const typed = engine.typed[engine.index] ?? '';
    const letters = word.children;
    let x = word.offsetLeft;
    if (typed.length < letters.length) x += letters[typed.length].offsetLeft;
    else if (letters.length) x += letters[letters.length - 1].offsetLeft + letters[letters.length - 1].offsetWidth;
    this.#moveCaret(x, word.offsetTop, snap);
  }

  /** Called on every keystroke: the caret stays solid while you type, then blinks again. */
  activity() {
    this.caret.classList.remove('idle');
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.caret.classList.add('idle'), CARET_IDLE_MS);
  }

  setPaused(paused) {
    this.typing.classList.toggle('is-paused', paused);
  }

  // ---- words ----

  #createWord(i) {
    const el = document.createElement('div');
    el.className = 'word';
    for (const ch of this.engine.words[i]) {
      const span = document.createElement('span');
      span.className = 'letter';
      span.textContent = ch;
      el.append(span);
    }
    this.wordEls[i] = el;
    return el;
  }

  /** The engine may have grown (time mode) or shrunk (zen backspace). Mirror that. */
  #syncWordCount() {
    const { words } = this.engine;
    if (words.length > this.wordEls.length) {
      const frag = document.createDocumentFragment();
      for (let i = this.wordEls.length; i < words.length; i++) {
        frag.append(this.#createWord(i));
        this.dirty.add(i);
      }
      this.words.append(frag);
    }
    while (this.wordEls.length > words.length) this.wordEls.pop().remove();
  }

  #paint(i) {
    const el = this.wordEls[i];
    if (!el) return;
    const { zen, typed: all, words, index } = this.engine;
    const typed = all[i] ?? '';
    const target = zen ? '' : words[i];
    const letters = el.children;

    for (let j = 0; j < target.length; j++) {
      const cls = j >= typed.length ? 'letter' : typed[j] === target[j] ? 'letter correct' : 'letter incorrect';
      if (letters[j].className !== cls) letters[j].className = cls;
    }

    // Anything typed beyond the target: extra letters (or, in zen, all of the text).
    const want = Math.max(0, typed.length - target.length);
    let have = letters.length - target.length;
    while (have > want) { el.lastChild.remove(); have--; }
    while (have < want) { el.append(document.createElement('span')); have++; }
    const cls = zen ? 'letter correct' : 'letter extra';
    for (let k = 0; k < want; k++) {
      const span = letters[target.length + k];
      const ch = typed[target.length + k];
      if (span.textContent !== ch) span.textContent = ch;
      if (span.className !== cls) span.className = cls;
    }

    el.classList.toggle('error', !zen && i < index && typed !== target);
  }

  // ---- scroll & caret ----

  #scrollTo(lines, snap) {
    if (snap) this.words.classList.add('snap');
    this.words.style.transform = `translate3d(0, ${-lines * this.lineH}px, 0)`;
    if (snap) {
      void this.words.offsetWidth;
      this.words.classList.remove('snap');
    }
  }

  #moveCaret(x, y, snap) {
    this.tx = x;
    this.ty = y;
    if (snap || reducedMotion()) {
      this.cx = x;
      this.cy = y;
      this.#drawCaret();
    } else if (!this.caretFrame) {
      this.caretLast = performance.now();
      this.caretFrame = requestAnimationFrame((t) => this.#glide(t));
    }
  }

  /** Exponential easing towards the target; frame-rate independent. */
  #glide(now) {
    const dt = Math.min(64, now - this.caretLast);
    this.caretLast = now;
    const k = 1 - Math.exp(-dt / CARET_TAU);
    this.cx += (this.tx - this.cx) * k;
    this.cy += (this.ty - this.cy) * k;
    const settled = Math.abs(this.tx - this.cx) < 0.05 && Math.abs(this.ty - this.cy) < 0.05;
    if (settled) {
      this.cx = this.tx;
      this.cy = this.ty;
    }
    this.#drawCaret();
    this.caretFrame = settled ? 0 : requestAnimationFrame((t) => this.#glide(t));
  }

  #drawCaret() {
    this.caret.style.transform = `translate3d(${this.cx}px, ${this.cy}px, 0)`;
  }

  /** The font size changes with the viewport, so line height has to be re-measured. */
  #relayout() {
    const first = this.wordEls[0];
    if (!first) return;
    const h = first.offsetHeight;
    if (h === this.lineH) return;
    this.lineH = h;
    this.line = -1;
    this.flush(true);
  }
}

// ---------------------------------------------------------------------------
// Live readout (time left / progress, and WPM)
// ---------------------------------------------------------------------------

export class LiveStats {
  constructor() {
    this.root = $('#live');
    this.count = $('#live-count');
    this.wpm = $('#live-wpm');
    this.last = { count: null, wpm: null };
  }

  show(on) { this.root.classList.toggle('on', on); }
  setWpmVisible(on) { this.wpm.classList.toggle('off', !on); }

  update(count, wpm) {
    if (count !== this.last.count) { this.count.textContent = count; this.last.count = count; }
    if (wpm !== this.last.wpm) { this.wpm.textContent = wpm; this.last.wpm = wpm; }
  }
}

// ---------------------------------------------------------------------------
// Config bar
// ---------------------------------------------------------------------------

export class ConfigBar {
  /**
   * @param {object} handlers
   * @param {(key:string, value:any)=>void} handlers.onChange
   * @param {(kind:'time'|'words')=>void} handlers.onCustom
   */
  constructor({ onChange, onCustom }) {
    this.root = $('#config');
    this.modeRow = $('.cfg-modes', this.root);
    this.indicator = $('.indicator', this.root);
    this.groups = [...$('#cfg-opts').children];
    this.settings = null;
    this.swapToken = 0;

    this.root.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const d = btn.dataset;
      if (d.mode) onChange('mode', d.mode);
      else if (d.toggle) onChange(d.toggle, !this.settings[d.toggle]);
      else if (d.difficulty) onChange('difficulty', d.difficulty);
      else if (d.time) onChange('time', Number(d.time));
      else if (d.words) onChange('words', Number(d.words));
      else if (d.custom) onCustom(d.custom);
    });

    new ResizeObserver(() => this.#placeIndicator(false)).observe(this.modeRow);
  }

  /** Reflect settings in the buttons; groups for other modes fade out and the right ones in. */
  sync(settings, { animate: animated = true } = {}) {
    const modeChanged = !this.settings || this.settings.mode !== settings.mode;
    this.settings = settings;

    for (const btn of this.root.querySelectorAll('button')) {
      const d = btn.dataset;
      let on = false;
      if (d.mode) on = d.mode === settings.mode;
      else if (d.toggle) on = settings[d.toggle];
      else if (d.difficulty) on = d.difficulty === settings.difficulty;
      else if (d.time) on = Number(d.time) === settings.time;
      else if (d.words) on = Number(d.words) === settings.words;
      else if (d.custom) {
        const presets = [...this.root.querySelectorAll(`[data-${d.custom}]`)].map((b) => Number(b.dataset[d.custom]));
        const value = settings[d.custom];
        on = settings.mode === d.custom && !presets.includes(value);
        btn.textContent = on ? `custom ${value}` : 'custom';
      }
      btn.classList.toggle('active', on);
      if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(on));
    }

    this.#placeIndicator(animated && modeChanged);
    if (modeChanged) this.#swapGroups(settings.mode, animated);
  }

  #placeIndicator(animated) {
    const active = $('.cfg-modes .active', this.root);
    if (!active) return;
    const el = this.indicator;
    if (!animated) el.style.transition = 'none';
    el.style.transform = `translate3d(${active.offsetLeft + 12}px, 0, 0) scaleX(${active.offsetWidth - 24})`;
    if (!animated) { void el.offsetWidth; el.style.transition = ''; }
  }

  async #swapGroups(mode, animated) {
    const token = ++this.swapToken;
    const wanted = (g) => g.dataset.modes.split(' ').includes(mode);
    const leaving = this.groups.filter((g) => !g.hidden && !wanted(g));
    const arriving = this.groups.filter((g) => g.hidden && wanted(g));

    if (!animated) {
      leaving.forEach((g) => { g.hidden = true; });
      arriving.forEach((g) => { g.hidden = false; });
      return;
    }
    await Promise.all(leaving.map((g) => fadeOut(g, { y: -4, duration: 140 })));
    if (token !== this.swapToken) return;
    await Promise.all(arriving.map((g, i) => fadeIn(g, { y: 5, duration: 240, delay: i * 40 })));
    this.#placeIndicator(false);
  }
}

// ---------------------------------------------------------------------------
// Small transitions shared by main.js
// ---------------------------------------------------------------------------

/** A quick fade/slide of the word block, used when a new test replaces the old one. */
export function refreshWords(viewport) {
  return animate(viewport, [
    { opacity: 0, transform: 'translate3d(0, 6px, 0)' },
    { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  ], { duration: 220 });
}

export { nextFrame };
