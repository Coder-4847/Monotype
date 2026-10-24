// Optional key-click sound, synthesised with Web Audio (no audio files).
// Off by default; the context is only created after the first keystroke that wants a sound.

let enabled = false;
let ctx = null;
let clickBuffer = null;
let bus = null; // where every click is routed

export const setSoundEnabled = (on) => { enabled = on; };

function init() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return false;
  ctx = new AudioCtx();

  // A 30 ms burst of exponentially decaying noise sounds like a soft key click.
  const length = Math.floor(ctx.sampleRate * 0.03);
  clickBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = clickBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp((-i / length) * 9);

  bus = ctx.createBiquadFilter();
  bus.type = 'bandpass';
  bus.frequency.value = 2600;
  bus.Q.value = 0.8;
  const master = ctx.createGain();
  master.gain.value = 0.5;
  bus.connect(master).connect(ctx.destination);
  return true;
}

/** @param {'key'|'space'|'error'} kind */
export function playClick(kind = 'key') {
  if (!enabled) return;
  if (!ctx && !init()) { enabled = false; return; }
  if (ctx.state === 'suspended') ctx.resume();

  const src = ctx.createBufferSource();
  src.buffer = clickBuffer;
  const pitch = { key: 1, space: 0.7, error: 0.45 }[kind];
  src.playbackRate.value = pitch * (0.92 + Math.random() * 0.16);
  const gain = ctx.createGain();
  gain.gain.value = kind === 'error' ? 0.5 : 0.35;
  src.connect(gain).connect(bus);
  src.start();
}
