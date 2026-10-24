import test from 'node:test';
import assert from 'node:assert/strict';
import { TypingTest, consistencyOf, MAX_EXTRA } from '../js/engine.js';

/** Type a string one key per `gap` ms starting at `t0`; returns the last timestamp. */
function typeString(t, text, t0 = 0, gap = 100) {
  let now = t0;
  for (const ch of text) {
    t.type(ch, now);
    now += gap;
  }
  return now - gap;
}

const make = (words, extra = {}) => new TypingTest({ mode: 'words', words, ...extra });

test('timer starts on the first keystroke, not before', () => {
  const t = make(['hello', 'world']);
  assert.equal(t.started, false);
  assert.equal(t.type(' ', 0), null, 'leading space is ignored');
  assert.equal(t.started, false);
  t.type('h', 500);
  assert.equal(t.startedAt, 500);
});

test('per-letter correctness and extra letters', () => {
  const t = make(['cat', 'dog']);
  assert.equal(t.type('c', 0), true);
  assert.equal(t.type('x', 10), false);
  assert.equal(t.type('t', 20), true);
  assert.equal(t.type('s', 30), false, 'extra letter');
  assert.deepEqual(t.result === undefined, false);
  assert.equal(t.sum[0], 2); // correct letters
  assert.equal(t.sum[1], 1); // incorrect
  assert.equal(t.sum[2], 1); // extra
});

test('extra letters are capped', () => {
  const t = make(['a', 'b']);
  t.type('a', 0);
  for (let i = 0; i < 50; i++) t.type('z', 10 + i);
  assert.equal(t.typed[0].length, 1 + MAX_EXTRA);
});

test('space commits the word and counts skipped letters as missed', () => {
  const t = make(['hello', 'world', 'end']);
  typeString(t, 'he ');
  assert.equal(t.index, 1);
  assert.equal(t.sum[3], 3, 'llo missed');
  assert.equal(t.sum[5], 0, 'space after a wrong word is not a correct char');
});

test('backspace removes letters; ctrl+backspace clears the word', () => {
  const t = make(['hello', 'world']);
  typeString(t, 'hexl');
  t.backspace(1000);
  assert.equal(t.typed[0], 'hex');
  t.backspace(1100, true);
  assert.equal(t.typed[0], '');
  assert.equal(t.sum[0] + t.sum[1], 0, 'totals follow the edits');
});

test('backspace returns to a previous wrong word but never a correct one', () => {
  const t = make(['one', 'two', 'three']);
  typeString(t, 'one ');
  assert.equal(t.index, 1);
  assert.equal(t.backspace(1000), false, 'correct word is locked');
  typeString(t, 'twx ', 1100);
  assert.equal(t.index, 2);
  assert.equal(t.backspace(2000), true);
  assert.equal(t.index, 1);
  assert.equal(t.typed[1], 'twx');
  t.backspace(2100);
  t.type('o', 2200);
  assert.equal(t.typed[1], 'two');
});

test('ctrl+backspace at the start of a word clears the previous wrong word', () => {
  const t = make(['one', 'two', 'three']);
  typeString(t, 'xyz ');
  t.backspace(1000, true);
  assert.equal(t.index, 0);
  assert.equal(t.typed[0], '');
});

test('words mode finishes when the last word is fully typed', () => {
  const t = make(['hi', 'yo']);
  const end = typeString(t, 'hi yo');
  assert.equal(t.finished, true);
  assert.equal(t.duration, end);
  assert.equal(t.type('x', end + 10), null, 'nothing is accepted afterwards');
});

test('words mode also finishes when space is pressed on the last word', () => {
  const t = make(['hi', 'yo']);
  typeString(t, 'hi y ');
  assert.equal(t.finished, true);
});

test('WPM = correct chars / 5 / minutes, spaces included', () => {
  // 60 words of 4 letters + 59 spaces typed in exactly 60s.
  const words = Array.from({ length: 60 }, () => 'abcd');
  const t = make(words);
  // 60*4 letters + 59 spaces = 299 chars in 59.9s -> spread evenly at 200ms/key
  let now = 0;
  for (let w = 0; w < 60; w++) {
    for (const ch of 'abcd') { t.type(ch, now); now += 200; }
    if (w < 59) { t.type(' ', now); now += 200; }
  }
  assert.equal(t.finished, true);
  const r = t.result();
  assert.equal(r.chars.correct, 299);
  const expected = 299 / 5 / (r.duration / 60);
  assert.ok(Math.abs(r.wpm - expected) < 1e-9);
  assert.equal(r.accuracy, 100);
  assert.equal(r.chars.incorrect, 0);
});

test('raw WPM counts every typed character, mistakes included', () => {
  const t = make(['abcd', 'efgh']);
  typeString(t, 'abxd efgh', 0, 100);
  const r = t.result();
  assert.equal(r.chars.incorrect, 1);
  assert.equal(r.chars.correct, 3 + 4, 'the space after a wrong word is not a correct char');
  const minutes = r.duration / 60;
  assert.ok(Math.abs(r.raw - 9 / 5 / minutes) < 1e-9, '8 letters + 1 space');
  assert.ok(r.raw > r.wpm);
});

test('accuracy is keystroke based, so corrected mistakes still count against it', () => {
  const t = make(['abcd', 'efgh']);
  t.type('a', 0);
  t.type('x', 100); // wrong
  t.backspace(200);
  t.type('b', 300);
  t.type('c', 400);
  t.type('d', 500);
  t.type(' ', 600);
  typeString(t, 'efgh', 700);
  const r = t.result();
  assert.equal(r.keys, 10);
  assert.ok(Math.abs(r.accuracy - 90) < 1e-9);
  assert.equal(r.chars.incorrect, 0, 'the final text is clean');
});

test('time mode ends exactly at the limit and ignores late keys', () => {
  const t = new TypingTest({ mode: 'time', words: Array(50).fill('word'), timeLimit: 15 });
  t.type('w', 0);
  assert.equal(t.tick(14999), false);
  assert.equal(t.tick(15000), true);
  assert.equal(t.duration, 15000);
  assert.equal(t.type('o', 15001), null);
});

test('a late keystroke that arrives before the tick still ends the test at the limit', () => {
  const t = new TypingTest({ mode: 'time', words: Array(50).fill('word'), timeLimit: 15 });
  t.type('w', 0);
  assert.equal(t.type('o', 15500), null);
  assert.equal(t.finished, true);
  assert.equal(t.duration, 15000);
  assert.equal(t.typed[0], 'w');
});

test('time mode keeps supplying words', () => {
  let n = 0;
  const source = { next: (k) => Array.from({ length: k }, () => `w${n++}`) };
  const t = new TypingTest({ mode: 'time', words: source.next(45), timeLimit: 60, source });
  const before = t.words.length;
  let now = 0;
  for (let i = 0; i < 10; i++) {
    for (const ch of t.words[t.index]) { t.type(ch, now); now += 50; }
    t.type(' ', now); now += 50;
  }
  assert.ok(t.words.length > before);
});

test('pausing does not count towards the test time', () => {
  const t = new TypingTest({ mode: 'time', words: Array(50).fill('word'), timeLimit: 15 });
  t.type('w', 1000);
  t.pause(2000);
  assert.equal(t.type('o', 5000), null, 'no input while paused');
  t.resume(12000); // 10s away
  assert.equal(t.elapsed(12000), 1000);
  assert.equal(t.tick(25000), false);
  assert.equal(t.tick(26000), true);
  assert.equal(t.duration, 15000);
});

test('per-second samples come from the log and are cumulative for wpm', () => {
  const t = new TypingTest({ mode: 'time', words: ['aaaaaaaaaaaaaaaaaaaaaaaa'], timeLimit: 3 });
  // 5 keys in second 1, 10 in second 2, 5 in second 3
  const burst = (from, n) => { for (let i = 0; i < n; i++) t.type('a', from + (i * 900) / n); };
  burst(0, 5);
  burst(1001, 10);
  burst(2001, 5);
  t.tick(3000);
  const { samples } = t.result();
  assert.equal(samples.length, 3);
  assert.equal(samples[0].raw, 5 * 12);
  assert.equal(samples[1].raw, 10 * 12);
  assert.equal(samples[2].raw, 5 * 12);
  assert.ok(Math.abs(samples[0].wpm - 5 / 5 / (1 / 60)) < 1e-9);
  assert.ok(Math.abs(samples[2].wpm - 20 / 5 / (3 / 60)) < 1e-9);
});

test('errors are attributed to the second they happened in', () => {
  const t = new TypingTest({ mode: 'time', words: ['aaaaaaaaaa'], timeLimit: 2 });
  t.type('a', 0);
  t.type('x', 1200);
  t.type('x', 1300);
  t.tick(2000);
  const { samples } = t.result();
  assert.deepEqual(samples.map((s) => s.errors), [0, 2]);
});

test('consistency: even speed is ~100, erratic speed is low', () => {
  assert.ok(consistencyOf([60, 60, 60, 60]) > 99.9);
  assert.ok(consistencyOf([10, 120, 20, 110, 5, 130]) < 40);
  const steady = consistencyOf([58, 62, 60, 61, 59]);
  assert.ok(steady > 90 && steady < 100);
  assert.equal(consistencyOf([50]), 100);
});

test('zen mode: everything typed is correct, backspace crosses words, Enter-style finish', () => {
  const t = new TypingTest({ mode: 'zen', words: [''] });
  typeString(t, 'free typing');
  assert.equal(t.index, 1);
  assert.equal(t.words.length, 2);
  t.backspace(5000, true); // clear "typing"
  t.backspace(5100); // back into "free"? previous word is committed and unlocked in zen
  assert.equal(t.index, 0);
  assert.equal(t.words.length, 1, 'trailing blank words are trimmed');
  t.finish(6000);
  const r = t.result();
  assert.equal(r.accuracy, 100);
  assert.equal(r.chars.incorrect, 0);
  assert.ok(r.wpm > 0);
});

test('smart quotes and NBSP are normalised', () => {
  const t = make(["it's", 'ok']);
  typeString(t, 'it’s');
  assert.equal(t.typed[0], "it's");
  assert.equal(t.sum[1], 0);
});

test('control characters never reach the text', () => {
  const t = make(['abc']);
  assert.equal(t.type('\n', 0), null);
  assert.equal(t.type('\t', 0), null);
  assert.equal(t.started, false);
});

test('very fast typing: 5000 keystrokes in the same millisecond stay consistent', () => {
  const words = Array.from({ length: 1000 }, () => 'abcde');
  const t = make(words);
  for (let w = 0; w < 1000; w++) {
    for (const ch of 'abcde') t.type(ch, 1000);
    if (w < 999) t.type(' ', 1000);
  }
  assert.equal(t.finished, true);
  const r = t.result();
  assert.equal(r.chars.correct, 1000 * 5 + 999);
  assert.equal(r.keys, 1000 * 5 + 999);
  assert.ok(Number.isFinite(r.wpm));
});

test('live WPM is zero until half a second has passed', () => {
  const t = make(['hello', 'world']);
  t.type('h', 0);
  assert.equal(t.liveWpm(100), 0);
  t.type('e', 600);
  assert.ok(t.liveWpm(600) > 0);
});
