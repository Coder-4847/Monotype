// Typing engine: a DOM-free state machine plus all of the scoring maths.
// Times are millisecond timestamps (performance.now()); pass `now` explicitly to test.

export const MAX_EXTRA = 19; // extra letters allowed past the end of a word
const MIN_LIVE_MS = 500; // don't show a live WPM before this, it's just noise

// Slots of the per-word score vector.
const C = 0, INC = 1, EX = 2, MISS = 3, SPACE = 4, SPACE_OK = 5;
const ZERO = Object.freeze([0, 0, 0, 0, 0, 0]);

// Smart-punctuation keyboards produce curly quotes; treat them as the plain ones.
const NORMALIZE = { '‘': "'", '’': "'", '“': '"', '”': '"', ' ': ' ' };
export const normalizeChar = (ch) => NORMALIZE[ch] ?? ch;

/** Monkeytype-style consistency: 100 means perfectly even raw speed. */
export function consistencyOf(values) {
  if (values.length < 2) return 100;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const cov = Math.sqrt(variance) / mean;
  const score = 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
  return Math.max(0, Math.min(100, score));
}

export class TypingTest {
  /**
   * @param {object} o
   * @param {'time'|'words'|'zen'|'quote'} o.mode
   * @param {string[]} o.words      target words (zen starts with a single empty word)
   * @param {number} [o.timeLimit]  seconds, time mode only
   * @param {{next(n:number):string[]}} [o.source] endless word supply for time mode
   */
  constructor({ mode, words, timeLimit = 0, source = null }) {
    this.mode = mode;
    this.zen = mode === 'zen';
    this.words = words.slice();
    this.typed = this.words.map(() => '');
    this.limitMs = timeLimit * 1000;
    this.source = source;

    this.index = 0;
    this.startedAt = null;
    this.pausedAt = null;
    this.duration = 0; // ms, set when the test finishes
    this.finished = false;

    this.parts = this.words.map(() => ZERO); // per-word score vectors
    this.sum = [0, 0, 0, 0, 0, 0]; // running totals of the vectors
    this.keys = 0; // insertion keystrokes (accuracy denominator)
    this.keysOk = 0;
    this.log = []; // { t, c, ins, ok } for every edit, used to build per-second samples
    this.dirty = new Set(); // word indices whose rendering is stale
  }

  // ---- derived counts ------------------------------------------------------

  get correctChars() { return this.sum[C] + this.sum[SPACE_OK]; }
  get rawChars() { return this.sum[C] + this.sum[INC] + this.sum[EX] + this.sum[SPACE]; }
  get started() { return this.startedAt !== null; }
  get paused() { return this.pausedAt !== null; }
  get isLastWord() { return !this.zen && !this.source && this.index === this.words.length - 1; }

  takeDirty() {
    const out = this.dirty;
    this.dirty = new Set();
    return out;
  }

  // ---- input ---------------------------------------------------------------

  /**
   * Type one character. Returns true/false for a correct/incorrect keystroke,
   * or null when the key was ignored. Check `finished` afterwards either way.
   */
  type(ch, now = performance.now()) {
    ch = normalizeChar(ch);
    if (this.finished || this.paused || ch.length === 0 || /[\u0000-\u001f\u007f]/.test(ch)) return null;
    const w = this.index;
    const cur = this.typed[w];
    if (ch === ' ' && cur === '') return null; // leading spaces never start a word
    if (this.startedAt === null) this.startedAt = now;
    else if (this.#expired(now)) return null;

    if (ch === ' ') return this.#commit(now);

    const target = this.zen ? '' : this.words[w];
    if (!this.zen && cur.length >= target.length + MAX_EXTRA) return null;
    const ok = this.zen || (cur.length < target.length && target[cur.length] === ch);
    this.typed[w] = cur + ch;
    this.#recount(w);
    this.#record(now, true, ok);
    this.dirty.add(w);

    // Words and quote tests end the moment the final word has been fully typed.
    if (this.isLastWord && this.typed[w].length >= target.length) this.finish(now);
    return ok;
  }

  /** Delete a letter, or the whole word. Returns whether anything changed. */
  backspace(now = performance.now(), whole = false) {
    if (this.finished || this.paused || this.startedAt === null) return false;
    if (this.#expired(now)) return false;
    const w = this.index;
    const cur = this.typed[w];
    if (cur.length) {
      this.typed[w] = whole ? '' : cur.slice(0, -1);
      this.#recount(w);
    } else if (w > 0 && !this.#locked(w - 1)) {
      // Step back into the previous word, but only while it still has a mistake.
      this.index = w - 1;
      if (whole) this.typed[w - 1] = '';
      this.#recount(w);
      this.#recount(w - 1);
      this.dirty.add(w);
      this.dirty.add(w - 1);
      this.#trimZen();
      this.#record(now, false, true);
      return true;
    } else {
      return false;
    }
    this.dirty.add(w);
    this.#record(now, false, true);
    return true;
  }

  /** Advance the clock; ends a time test once its limit has passed. */
  tick(now = performance.now()) {
    if (!this.finished && !this.paused) this.#expired(now);
    return this.finished;
  }

  pause(now = performance.now()) {
    if (this.startedAt !== null && !this.finished && this.pausedAt === null) this.pausedAt = now;
  }

  resume(now = performance.now()) {
    if (this.pausedAt === null) return;
    this.startedAt += now - this.pausedAt; // the pause doesn't count towards the test
    this.pausedAt = null;
  }

  finish(now = performance.now()) {
    if (this.finished) return;
    this.finished = true;
    if (this.startedAt === null) return;
    const lastT = this.log.length ? this.log[this.log.length - 1].t : 0;
    const elapsed = (this.pausedAt ?? now) - this.startedAt;
    // Timed tests run for exactly the limit; the others end at the last keystroke.
    this.duration = Math.max(1, this.limitMs ? Math.min(elapsed, this.limitMs) : lastT);
  }

  append(words) {
    for (const w of words) {
      this.words.push(w);
      this.typed.push('');
      this.parts.push(ZERO);
    }
  }

  // ---- live numbers --------------------------------------------------------

  elapsed(now = performance.now()) {
    if (this.finished) return this.duration;
    if (this.startedAt === null) return 0;
    return (this.pausedAt ?? now) - this.startedAt;
  }

  liveWpm(now = performance.now()) {
    const ms = this.elapsed(now);
    return ms < MIN_LIVE_MS ? 0 : this.correctChars / 5 / (ms / 60000);
  }

  // ---- final result --------------------------------------------------------

  result() {
    const ms = Math.max(1, this.duration);
    const minutes = ms / 60000;
    const samples = this.#samples();
    const whole = samples.filter((s) => Number.isInteger(s.t));
    const consistency = consistencyOf((whole.length >= 2 ? whole : samples).map((s) => s.raw));
    return {
      mode: this.mode,
      duration: ms / 1000,
      wpm: this.correctChars / 5 / minutes,
      raw: this.rawChars / 5 / minutes,
      accuracy: this.zen ? 100 : this.keys ? (this.keysOk / this.keys) * 100 : 0,
      consistency,
      chars: {
        correct: this.correctChars,
        incorrect: this.sum[INC],
        extra: this.sum[EX],
        missed: this.sum[MISS],
      },
      keys: this.keys,
      samples,
    };
  }

  // ---- internals -----------------------------------------------------------

  #expired(now) {
    if (this.limitMs && this.startedAt !== null && now - this.startedAt >= this.limitMs) {
      this.finish(now);
      return true;
    }
    return false;
  }

  /** Correct words behind the cursor are locked, as in Monkeytype. */
  #locked(i) {
    return !this.zen && this.typed[i] === this.words[i];
  }

  #commit(now) {
    const w = this.index;
    const ok = this.zen || this.typed[w] === this.words[w];
    this.index = w + 1;
    if (this.zen && this.index >= this.words.length) this.append(['']);
    this.#recount(w);
    this.#record(now, true, ok);
    this.dirty.add(w);
    this.dirty.add(this.index);

    if (this.source && this.words.length - this.index < 40) this.append(this.source.next(50));
    if (!this.zen && this.index >= this.words.length) this.finish(now);
    return ok;
  }

  /** In zen mode the words array only ever holds what has been typed plus one blank. */
  #trimZen() {
    if (!this.zen) return;
    while (this.words.length > this.index + 1 && this.typed[this.words.length - 1] === '') {
      this.words.pop();
      this.typed.pop();
      this.parts.pop();
    }
  }

  #record(now, ins, ok) {
    if (ins) {
      this.keys++;
      if (ok) this.keysOk++;
    }
    this.log.push({ t: now - this.startedAt, c: this.correctChars, ins, ok });
  }

  /** Re-score word i and fold the difference into the running totals. */
  #recount(i) {
    const typed = this.typed[i];
    const target = this.zen ? typed : this.words[i];
    const done = i < this.index;
    const n = Math.min(target.length, typed.length);
    let correct = 0;
    for (let k = 0; k < n; k++) if (typed[k] === target[k]) correct++;
    const next = [
      correct,
      n - correct,
      Math.max(0, typed.length - target.length),
      done ? Math.max(0, target.length - typed.length) : 0,
      done ? 1 : 0,
      done && typed === target ? 1 : 0,
    ];
    const prev = this.parts[i];
    for (let k = 0; k < 6; k++) this.sum[k] += next[k] - prev[k];
    this.parts[i] = next;
  }

  /**
   * Per-second samples built from the edit log, so they are exact even if the
   * tab was throttled. wpm is cumulative; raw and errors cover that second only.
   */
  #samples() {
    const dur = this.duration;
    const out = [];
    const log = this.log;
    const whole = Math.floor(dur / 1000);
    let i = 0;
    let c = 0;

    const collect = (edge) => {
      let ins = 0;
      let errors = 0;
      while (i < log.length && log[i].t <= edge) {
        const e = log[i++];
        c = e.c;
        if (e.ins) {
          ins++;
          if (!e.ok) errors++;
        }
      }
      return { ins, errors };
    };

    for (let s = 1; s <= whole; s++) {
      const { ins, errors } = collect(s * 1000);
      out.push({ t: s, wpm: c / 5 / (s / 60), raw: ins * 12, errors });
    }
    const tail = dur - whole * 1000;
    if (tail >= 500 || out.length === 0) {
      const { ins, errors } = collect(dur);
      const seconds = tail / 1000;
      out.push({ t: dur / 1000, wpm: c / 5 / (dur / 60000), raw: seconds ? (ins * 12) / seconds : 0, errors });
    }
    return out;
  }
}
