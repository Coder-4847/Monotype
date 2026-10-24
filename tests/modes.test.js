import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMON_200, TOP_1000, QUOTES } from '../js/words.js';
import { createWordSource, createTest, bestKey, describeTest, repeatTest, clampCustom } from '../js/modes.js';

const cfg = (o = {}) => ({ mode: 'time', time: 30, words: 25, punctuation: false, numbers: false, difficulty: 'common', ...o });

// Deterministic generator so failures are reproducible.
function seeded(seed = 1) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test('word lists have the advertised size and only typeable words', () => {
  assert.equal(COMMON_200.length, 200);
  assert.equal(TOP_1000.length, 1000);
  assert.equal(new Set(TOP_1000).size, 1000);
  for (const w of TOP_1000) assert.match(w, /^[a-z]+$/);
  for (const q of QUOTES) assert.match(q.text, /^[\x20-\x7e]+$/);
});

test('plain words come from the chosen pool and never repeat back to back', () => {
  const words = createWordSource(cfg(), seeded()).next(500);
  assert.ok(words.every((w) => COMMON_200.includes(w)));
  for (let i = 1; i < words.length; i++) assert.notEqual(words[i], words[i - 1]);
  const hard = createWordSource(cfg({ difficulty: 'top' }), seeded(7)).next(2000);
  assert.ok(hard.some((w) => !COMMON_200.includes(w)));
  assert.ok(hard.every((w) => TOP_1000.includes(w)));
});

test('numbers option mixes in digit strings', () => {
  const words = createWordSource(cfg({ numbers: true }), seeded(3)).next(500);
  const nums = words.filter((w) => /^\d+$/.test(w));
  assert.ok(nums.length > 20 && nums.length < 120, `got ${nums.length}`);
  assert.ok(nums.every((n) => n.length <= 4 && (n.length === 1 || n[0] !== '0')));
});

test('punctuation option capitalises sentence starts and adds marks', () => {
  const words = createWordSource(cfg({ punctuation: true }), seeded(5)).next(400);
  assert.match(words[0], /^[A-Z]/);
  assert.ok(words.some((w) => /[.,?!;:]$/.test(w)));
  assert.ok(words.some((w) => /^["('].*["')]$/.test(w)));
  for (let i = 1; i < words.length; i++) {
    if (/[.?!]$/.test(words[i - 1])) assert.match(words[i], /^[A-Z"('\d]/);
  }
});

test('createTest builds each mode', () => {
  const time = createTest(cfg({ mode: 'time', time: 15 }));
  assert.equal(time.timeLimit, 15);
  assert.ok(time.words.length >= 100 && time.source);

  const words = createTest(cfg({ mode: 'words', words: 10 }));
  assert.equal(words.words.length, 10);
  assert.equal(words.source, undefined);

  assert.deepEqual(createTest(cfg({ mode: 'zen' })).words, ['']);

  const quote = createTest(cfg({ mode: 'quote' }));
  assert.equal(quote.words.join(' '), quote.quote.text);
});

test('quotes do not repeat back to back', () => {
  let prev = null;
  for (let i = 0; i < 60; i++) {
    const q = createTest(cfg({ mode: 'quote' })).quote.text;
    assert.notEqual(q, prev);
    prev = q;
  }
});

test('repeatTest keeps the words and gives time tests a fresh supply', () => {
  const d = createTest(cfg());
  const again = repeatTest(d, d.words);
  assert.deepEqual(again.words, d.words);
  assert.notEqual(again.source, d.source);
  assert.ok(typeof again.source.next === 'function');
});

test('best keys, descriptions and custom clamping', () => {
  assert.equal(bestKey(cfg({ mode: 'time', time: 45 })), 'time:45');
  assert.equal(bestKey(cfg({ mode: 'words', words: 100 })), 'words:100');
  assert.equal(bestKey(cfg({ mode: 'quote' })), 'quote');
  assert.equal(describeTest(cfg({ punctuation: true, numbers: true })).detail, 'common 200 · punctuation · numbers');
  assert.equal(clampCustom('time', 0), 1);
  assert.equal(clampCustom('time', 99999), 3600);
  assert.equal(clampCustom('words', 12.6), 13);
});
