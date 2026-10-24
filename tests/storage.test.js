import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, loadSettings, saveSettings, addHistory, getHistory, clearHistory,
  recordBest, getBest, isBetter,
} from '../js/storage.js';

// No localStorage in node: this exercises the in-memory fallback.

test('settings fall back to defaults and ignore values of the wrong type', () => {
  assert.deepEqual(loadSettings(), DEFAULTS);
  saveSettings({ ...DEFAULTS, mode: 'zen', time: 'nope', theme: 'purple' });
  const s = loadSettings();
  assert.equal(s.mode, 'zen');
  assert.equal(s.time, DEFAULTS.time);
  assert.equal(s.theme, DEFAULTS.theme);
});

test('history keeps only the last 50 results', () => {
  clearHistory();
  for (let i = 0; i < 60; i++) addHistory({ wpm: i });
  const h = getHistory();
  assert.equal(h.length, 50);
  assert.equal(h[0].wpm, 10);
  assert.equal(h.at(-1).wpm, 59);
});

test('personal bests: first result is a best, lower ones are not', () => {
  const a = recordBest('time:30', 'time', { wpm: 80, accuracy: 95 });
  assert.equal(a.isBest, true);
  assert.equal(a.previous, null);
  const b = recordBest('time:30', 'time', { wpm: 70, accuracy: 99 });
  assert.equal(b.isBest, false);
  const c = recordBest('time:30', 'time', { wpm: 90, accuracy: 90 });
  assert.equal(c.isBest, true);
  assert.equal(c.previous.wpm, 80);
  assert.equal(getBest('time:30').wpm, 90);
});

test('quote bests are decided on accuracy first', () => {
  assert.equal(isBetter('quote', { wpm: 50, accuracy: 99 }, { wpm: 120, accuracy: 96 }), true);
  assert.equal(isBetter('quote', { wpm: 130, accuracy: 96 }, { wpm: 120, accuracy: 96 }), true);
  assert.equal(isBetter('quote', { wpm: 130, accuracy: 90 }, { wpm: 120, accuracy: 96 }), false);
});

test('zen and empty results never set a best', () => {
  assert.equal(recordBest('zen', 'zen', { wpm: 100, accuracy: 100 }).isBest, false);
  assert.equal(recordBest('words:10', 'words', { wpm: 0, accuracy: 0 }).isBest, false);
});
