# Monotype

A minimalist typing speed test, inspired by Monkeytype. Plain HTML, CSS and JavaScript: no frameworks, no build step, no dependencies. Black, white and grey, with red reserved for mistakes.

## Features

**Typing**
- Wrapped word block with three visible lines that scroll smoothly as you progress
- Per-letter states: untyped (grey), correct (white), incorrect (red), extra letters (dim red); wrong letters stay visible
- Smooth gliding caret that eases between letters and blinks while idle
- Backspace, whole-word backspace (`Ctrl`/`Alt` + `Backspace`), space to advance
- Timer starts on the first keystroke; `Tab` then `Enter` restarts instantly

**Modes**
- **Time**: 15 / 30 / 60 / 120 seconds or a custom value
- **Words**: 10 / 25 / 50 / 100 words or a custom value; ends on the last word
- **Zen**: free typing with no target; press `Enter` to finish
- **Quote**: short quotes, scored on accuracy
- Options: punctuation, numbers, word list (common 200 / top 1000)

**Results**
- WPM, raw WPM, accuracy, consistency, characters (correct / incorrect / extra / missed), time and mode
- WPM-over-time chart drawn in SVG, with errors marked in red and a hover read-out
- Personal best per mode in `localStorage`, with a "new best" badge
- Next test, repeat the same words, restart

**Extras**
- Live WPM while typing (toggleable)
- Optional key-click sound, synthesised with Web Audio (off by default, no audio files)
- History of your last 50 results with a progress chart
- Command palette (`Esc` or `Ctrl`/`Cmd` + `K`) for modes, options and themes
- Dark and light themes; blind mode that hides errors until the end
- Focus mode: the UI fades away while you type and returns when you move the mouse
- Responsive, with a "tap to start" state on touch devices

**Fluidity**
- Animations use `transform` and `opacity` (letter and theme colour fades are paint-only)
- The caret and number counters run on `requestAnimationFrame`
- `prefers-reduced-motion` is respected everywhere
- Theme changes crossfade with the View Transitions API where available

## How scoring works

| Metric | Definition |
| --- | --- |
| WPM | correct characters / 5 / minutes (spaces after correct words count) |
| Raw WPM | every typed character, mistakes included / 5 / minutes |
| Accuracy | correct keystrokes / all keystrokes, so corrected mistakes still count |
| Consistency | derived from the variation of raw speed across per-second samples (100% = perfectly steady) |

Samples are rebuilt from a log of timestamped edits, so they stay accurate even if the browser throttles timers. If you switch tabs or the window loses focus mid-test, the test pauses and the pause does not count towards your time.

## Keyboard

| Keys | Action |
| --- | --- |
| `Tab`, then `Enter` | Restart with new words |
| `Esc` or `Ctrl`/`Cmd` + `K` | Command palette |
| `Ctrl`/`Alt` + `Backspace` | Delete the whole word |
| `Enter` (zen mode) | Finish the test |
| `Enter` (results) | Next test |

## Run locally

ES modules need an HTTP server (opening `index.html` from `file://` will not work):

```sh
python3 -m http.server 8080
# or: npx serve
```

then open <http://localhost:8080>.

## Tests

The engine, mode generators and storage are covered by unit tests using Node's built-in runner (Node 20+):

```sh
npm test
```

## Deploy on GitHub Pages

The repo ships with `.github/workflows/pages.yml`, which runs the unit tests and publishes the site on every push to `main` (or manually from the Actions tab).

1. Push this repository to GitHub.
2. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Merge to `main` (or run the workflow manually). The site goes live at `https://<user>.github.io/<repo>/`.

All paths are relative, so it works from a project sub-path with no configuration. If you would rather not use Actions, choose **Deploy from a branch** with the `/ (root)` folder instead.

## Project layout

```
index.html        markup
style.css         design tokens, layout and animation styles
js/
  main.js         wiring: settings, input, test lifecycle
  engine.js       typing state machine and scoring (no DOM)
  modes.js        modes, word generation, personal-best keys
  words.js        word lists and quotes
  ui.js           word block, caret, scrolling, live readout, config bar
  results.js      results screen
  chart.js        SVG charts
  history.js      history panel
  palette.js      command palette and numeric prompt
  overlay.js      modal handling
  storage.js      localStorage wrapper, history, personal bests
  sound.js        Web Audio key clicks
  anim.js         animation helpers
tests/            unit tests
.github/workflows/pages.yml   test and deploy to GitHub Pages
```

## Notes

- Word lists are original selections of common English words; quotes are public domain.
- Input goes through a hidden textarea as well as key events, so dead keys, IME composition and mobile keyboards work.
- Settings, history and bests live in `localStorage` under the `monotype.` prefix and fall back to memory if storage is unavailable.
