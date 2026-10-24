// Test modes: what each mode offers, and how the text for a test is generated.

import { COMMON_200, TOP_1000, QUOTES } from './words.js';

export const MODES = ['time', 'words', 'zen', 'quote'];
export const PRESETS = { time: [15, 30, 60, 120], words: [10, 25, 50, 100] };
export const LIMITS = { time: [1, 3600], words: [1, 1000] };

const poolFor = (difficulty) => (difficulty === 'top' ? TOP_1000 : COMMON_200);
const int = (rng, n) => Math.floor(rng() * n);

function randomNumber(rng) {
  const digits = 1 + int(rng, 4);
  let out = String(digits === 1 ? int(rng, 10) : 1 + int(rng, 9));
  while (out.length < digits) out += int(rng, 10);
  return out;
}

// Suffix punctuation as [cumulative probability, text, ends a sentence].
const SUFFIXES = [
  [0.05, '.', true],
  [0.13, ',', false],
  [0.145, '?', true],
  [0.16, '!', true],
  [0.175, ';', false],
  [0.19, ':', false],
];
const WRAPS = [['"', '"'], ['(', ')'], ["'", "'"]];

function punctuate(word, sentenceStart, rng) {
  if (sentenceStart) word = word[0].toUpperCase() + word.slice(1);
  const r = rng();
  for (const [limit, mark, ends] of SUFFIXES) if (r < limit) return [word + mark, ends];
  if (r < 0.215) {
    const [open, close] = WRAPS[int(rng, WRAPS.length)];
    return [open + word + close, false];
  }
  return [word, false];
}

/** An endless supply of words honouring the punctuation/numbers/difficulty options. */
export function createWordSource(cfg, rng = Math.random) {
  const pool = poolFor(cfg.difficulty);
  let previous = '';
  let sentenceStart = true;

  const pick = () => {
    let word;
    do word = pool[int(rng, pool.length)];
    while (word === previous);
    previous = word;
    return word;
  };

  return {
    next(count) {
      const out = [];
      while (out.length < count) {
        let word = pick();
        if (cfg.numbers && rng() < 0.12) word = randomNumber(rng);
        if (cfg.punctuation) [word, sentenceStart] = punctuate(word, sentenceStart, rng);
        out.push(word);
      }
      return out;
    },
  };
}

let lastQuote = -1;

/** Everything the engine needs to run one test. `cfg` is kept so a test can be repeated. */
export function createTest(settings, rng = Math.random) {
  const cfg = { ...settings }; // a snapshot: later setting changes must not alter this test
  switch (cfg.mode) {
    case 'time': {
      const source = createWordSource(cfg, rng);
      return { mode: 'time', words: source.next(100), timeLimit: cfg.time, source, cfg };
    }
    case 'words': {
      const words = createWordSource(cfg, rng).next(cfg.words);
      return { mode: 'words', words, cfg };
    }
    case 'zen':
      return { mode: 'zen', words: [''], cfg };
    case 'quote': {
      let i;
      do i = int(rng, QUOTES.length);
      while (i === lastQuote && QUOTES.length > 1);
      lastQuote = i;
      return { mode: 'quote', words: QUOTES[i].text.split(' '), quote: QUOTES[i], cfg };
    }
    default:
      throw new Error(`Unknown mode: ${cfg.mode}`);
  }
}

/** The same words again. Time tests keep what was generated and can still grow. */
export function repeatTest(desc, words) {
  return {
    ...desc,
    words: desc.mode === 'zen' ? [''] : words.slice(),
    source: desc.source ? createWordSource(desc.cfg) : null,
  };
}

/** Key under which personal bests are stored. */
export function bestKey(cfg) {
  if (cfg.mode === 'time') return `time:${cfg.time}`;
  if (cfg.mode === 'words') return `words:${cfg.words}`;
  return cfg.mode;
}

/** Human-readable name of a test: a short title and a line of detail. */
export function describeTest(cfg, quote) {
  const flags = [];
  if (cfg.mode === 'time' || cfg.mode === 'words') {
    flags.push(cfg.difficulty === 'top' ? 'top 1000' : 'common 200');
    if (cfg.punctuation) flags.push('punctuation');
    if (cfg.numbers) flags.push('numbers');
  }
  if (cfg.mode === 'time') return { title: `time ${cfg.time}`, detail: flags.join(' · ') };
  if (cfg.mode === 'words') return { title: `words ${cfg.words}`, detail: flags.join(' · ') };
  if (cfg.mode === 'quote') return { title: 'quote', detail: quote ? quote.author.toLowerCase() : '' };
  return { title: 'zen', detail: 'free typing' };
}

export function clampCustom(kind, value) {
  const [min, max] = LIMITS[kind];
  return Math.max(min, Math.min(max, Math.round(value)));
}
