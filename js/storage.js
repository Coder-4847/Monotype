// Persistence. localStorage can be missing or throw (private windows, blocked
// site data), so every access is guarded and falls back to memory.

const PREFIX = 'monotype.';
const HISTORY_LIMIT = 50;
const memory = new Map();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* fall through to memory */ }
  return memory.has(key) ? structuredClone(memory.get(key)) : fallback;
}

function write(key, value) {
  memory.set(key, structuredClone(value));
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* quota or privacy mode: memory copy still works for this session */ }
}

export const DEFAULTS = {
  mode: 'time',
  time: 30,
  words: 25,
  punctuation: false,
  numbers: false,
  difficulty: 'common',
  theme: 'dark',
  liveWpm: true,
  sound: false,
  blind: false,
};

/** Merge saved settings over the defaults, dropping anything of the wrong type. */
export function loadSettings() {
  const saved = read('settings', {});
  const out = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof saved[key] === typeof DEFAULTS[key]) out[key] = saved[key];
  }
  if (!['time', 'words', 'zen', 'quote'].includes(out.mode)) out.mode = DEFAULTS.mode;
  if (!['common', 'top'].includes(out.difficulty)) out.difficulty = DEFAULTS.difficulty;
  if (!['dark', 'light'].includes(out.theme)) out.theme = DEFAULTS.theme;
  return out;
}

export const saveSettings = (settings) => write('settings', settings);

// ---- history -----------------------------------------------------------------

export const getHistory = () => read('history', []);
export const clearHistory = () => write('history', []);

export function addHistory(entry) {
  const list = [...getHistory(), entry].slice(-HISTORY_LIMIT);
  write('history', list);
  return list;
}

// ---- personal bests -----------------------------------------------------------

/** Quotes are scored on accuracy first, everything else on WPM. */
export function isBetter(mode, candidate, best) {
  if (!best) return true;
  if (mode === 'quote') {
    if (candidate.accuracy !== best.accuracy) return candidate.accuracy > best.accuracy;
    return candidate.wpm > best.wpm;
  }
  return candidate.wpm > best.wpm;
}

export const getBest = (key) => read('bests', {})[key] ?? null;

/**
 * Record a finished test against its personal best.
 * Returns { isBest, previous } where previous is the record that was beaten, if any.
 */
export function recordBest(key, mode, entry) {
  if (mode === 'zen' || !(entry.wpm > 0)) return { isBest: false, previous: getBest(key) };
  const bests = read('bests', {});
  const previous = bests[key] ?? null;
  if (!isBetter(mode, entry, previous)) return { isBest: false, previous };
  bests[key] = entry;
  write('bests', bests);
  return { isBest: true, previous };
}
