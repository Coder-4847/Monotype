// Wiring: settings, input handling, and the ready -> running -> results flow.

import { TypingTest } from './engine.js';
import { createTest, repeatTest, clampCustom, LIMITS } from './modes.js';
import { loadSettings, saveSettings } from './storage.js';
import { TestView, LiveStats, ConfigBar, refreshWords } from './ui.js';
import { fadeIn, fadeOut, reducedMotion } from './anim.js';
import { isOverlayOpen } from './overlay.js';

const $ = (sel) => document.querySelector(sel);

const settings = loadSettings();
const body = document.body;
const testViewEl = $('#test-view');
const input = $('#capture');
const quoteSource = $('#quote-source');

const view = new TestView();
const live = new LiveStats();
const config = new ConfigBar({
  onChange: (key, value) => set(key, value),
  onCustom: (kind) => askCustom(kind),
});

/** 'ready' (waiting for the first key) | 'running' | 'transition' | 'results' */
let phase = 'ready';
let engine = null;
let desc = null;
let testToken = 0;
let tickFrame = 0;
let lastLive = 0;
let tabArmed = false;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const TEST_KEYS = new Set(['mode', 'time', 'words', 'punctuation', 'numbers', 'difficulty']);

function set(key, value) {
  if (settings[key] === value) return;
  settings[key] = value;
  saveSettings(settings);
  applySetting(key);
  if (TEST_KEYS.has(key)) {
    config.sync(settings);
    newTest();
  }
  focusInput();
}

function applySetting(key) {
  if (key === 'blind') body.classList.toggle('blind', settings.blind);
  if (key === 'liveWpm') live.setWpmVisible(settings.liveWpm);
  for (const btn of document.querySelectorAll('[data-setting]')) {
    const on = settings[btn.dataset.setting];
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('em').textContent = on ? 'on' : 'off';
  }
}

async function askCustom(kind) {
  // Replaced by the command palette's prompt once it exists.
  void kind;
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

async function newTest({ repeat = false } = {}) {
  const token = ++testToken;
  const fromResults = phase === 'results' || phase === 'transition';
  stopTicker();
  body.classList.remove('typing');
  live.show(false);
  view.setPaused(false);

  desc = repeat && desc ? repeatTest(desc, engine.words) : createTest(settings);
  engine = new TypingTest(desc);
  phase = fromResults ? 'transition' : 'ready';

  if (fromResults) {
    testViewEl.hidden = false;
    view.setTest(engine);
    renderMeta();
    await fadeIn(testViewEl, { y: 8 });
    if (token !== testToken) return;
    phase = 'ready';
  } else {
    view.setTest(engine);
    renderMeta();
    refreshWords(view.viewport);
  }
  focusInput();
}

/** Things that belong to the freshly created test: quote credit and the live readout's start value. */
function renderMeta() {
  quoteSource.textContent = desc.quote ? `- ${desc.quote.author.toLowerCase()}` : '';
  quoteSource.classList.toggle('on', Boolean(desc.quote));
  live.update(liveCount(0), '0');
}

function liveCount(now) {
  if (engine.mode === 'time') return String(Math.max(0, Math.ceil((engine.limitMs - engine.elapsed(now)) / 1000)));
  if (engine.zen) return String(engine.index);
  return `${engine.index}/${engine.words.length}`;
}

function updateLive(now) {
  live.update(liveCount(now), String(Math.round(engine.liveWpm(now))));
}

function beginRun() {
  phase = 'running';
  live.show(true);
  startTicker();
}

function startTicker() {
  const loop = (now) => {
    if (phase !== 'running') return;
    if (engine.tick(now)) { finishTest(); return; }
    if (now - lastLive > 100) { updateLive(now); lastLive = now; }
    tickFrame = requestAnimationFrame(loop);
  };
  tickFrame = requestAnimationFrame(loop);
}

function stopTicker() {
  cancelAnimationFrame(tickFrame);
  tickFrame = 0;
}

async function finishTest() {
  if (phase !== 'running' && phase !== 'ready') return;
  phase = 'transition';
  stopTicker();
  engine.finish();
  view.flush();
  body.classList.remove('typing');
  live.show(false);
  await fadeOut(testViewEl, { y: -8, duration: 220 });
  phase = 'results';
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function focusInput() {
  if (isOverlayOpen() || testViewEl.hidden) return;
  input.focus({ preventScroll: true });
}

/** After any accepted edit: repaint, keep the UI out of the way, and end the test if it is over. */
function afterEdit(accepted) {
  if (accepted) {
    if (phase === 'ready') beginRun();
    body.classList.add('typing');
    view.activity();
  }
  view.invalidate(engine.takeDirty());
  if (engine.finished) finishTest();
}

function typeChar(ch) {
  if (phase !== 'ready' && phase !== 'running') return;
  const res = engine.type(ch, performance.now());
  afterEdit(res !== null);
}

function backspace(whole) {
  if (phase !== 'running') return;
  afterEdit(engine.backspace(performance.now(), whole));
}

function pause() {
  if (phase !== 'running') return;
  engine.pause(performance.now());
  view.setPaused(true);
}

function resume() {
  if (!engine.paused) return false;
  engine.resume(performance.now());
  view.setPaused(false);
  return true;
}

const isFormField = (el) => el instanceof HTMLElement && el !== input && el.matches('input, textarea, select, [contenteditable]');

document.addEventListener('keydown', (e) => {
  if (isOverlayOpen() || isFormField(e.target)) return;

  if (e.key === 'Tab') {
    e.preventDefault();
    tabArmed = true;
    return;
  }
  const armed = tabArmed;
  tabArmed = false;
  if (e.key === 'Enter' && armed) {
    e.preventDefault();
    newTest();
    return;
  }

  if (phase === 'results') {
    if (e.key === 'Enter') { e.preventDefault(); newTest(); }
    return;
  }
  if (phase === 'transition') return;

  if (engine.paused) {
    if (!e.metaKey && !e.ctrlKey && e.key !== 'Escape') { e.preventDefault(); resume(); }
    return;
  }

  // Dead keys, IME and mobile keyboards report these; the input events below deal with them.
  if (e.isComposing || e.key === 'Process' || e.key === 'Unidentified' || e.key === 'Dead') return;

  const altGr = e.getModifierState?.('AltGraph');
  const shortcut = (e.ctrlKey || e.metaKey || e.altKey) && !altGr;

  if (e.key === 'Backspace') {
    e.preventDefault();
    backspace(shortcut);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (engine.zen && phase === 'running') { engine.finish(performance.now()); afterEdit(false); }
  } else if (!shortcut && e.key.length === 1) {
    e.preventDefault();
    typeChar(e.key);
  }
});

// Mobile keyboards, dead keys and IMEs: text arrives through the hidden textarea.
// It always holds one sentinel character so that Backspace has something to delete.
const SENTINEL = ' ';
let composing = false;
let composed = '';

function resetInput() {
  input.value = SENTINEL;
  input.setSelectionRange(SENTINEL.length, SENTINEL.length);
}

/** Apply the difference between what a composition held before and what it holds now. */
function syncComposition(text) {
  let common = 0;
  while (common < composed.length && common < text.length && composed[common] === text[common]) common++;
  for (let i = composed.length; i > common; i--) backspace(false);
  for (const ch of text.slice(common)) typeChar(ch);
  composed = text;
}

input.addEventListener('focus', resetInput);
input.addEventListener('beforeinput', (e) => {
  if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') e.preventDefault();
});
input.addEventListener('compositionstart', () => { composing = true; composed = ''; });
input.addEventListener('compositionend', () => {
  syncComposition(input.value.slice(SENTINEL.length));
  composing = false;
  composed = '';
  resetInput();
});
input.addEventListener('input', (e) => {
  if (isOverlayOpen()) return;
  if (phase === 'results' || phase === 'transition') { resetInput(); return; }
  if (engine.paused) resume();
  const text = input.value.slice(SENTINEL.length);
  if (composing || e.isComposing) { syncComposition(text); return; }
  if (input.value.length < SENTINEL.length) backspace(e.inputType === 'deleteWordBackward');
  else for (const ch of text) typeChar(ch);
  resetInput();
});

// Losing the window (or the tab) pauses a running test instead of silently eating the clock.
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('#typing').addEventListener('pointerdown', () => { if (resume()) focusInput(); });
document.addEventListener('pointerup', (e) => {
  if (!e.target.closest('button, a, input, textarea, .overlay')) focusInput();
});

// Moving the mouse brings the hidden UI back.
let lastMouse = null;
document.addEventListener('mousemove', (e) => {
  const moved = !lastMouse || Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y) > 3;
  lastMouse = { x: e.clientX, y: e.clientY };
  if (moved) body.classList.remove('typing');
});

// ---------------------------------------------------------------------------
// Buttons & start-up
// ---------------------------------------------------------------------------

$('#btn-restart').addEventListener('click', () => { newTest(); });
$('#btn-restart-2').addEventListener('click', () => { newTest(); });
$('#btn-next').addEventListener('click', () => { newTest(); });
$('#btn-repeat').addEventListener('click', () => { newTest({ repeat: true }); });

for (const btn of document.querySelectorAll('[data-setting]')) {
  btn.addEventListener('click', () => set(btn.dataset.setting, !settings[btn.dataset.setting]));
}

document.documentElement.dataset.theme = settings.theme;
applySetting('blind');
applySetting('liveWpm');
config.sync(settings, { animate: false });
newTest();

// Exposed for debugging and the browser tests.
window.monotype = { get engine() { return engine; }, get phase() { return phase; }, settings };
void clampCustom; void LIMITS; void reducedMotion;
