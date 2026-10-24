// The results screen: counting numbers, the WPM chart and the personal-best line.

import { countUp, fadeIn, fadeOut, animate, wait, nextFrame } from './anim.js';
import { renderResultChart } from './chart.js';

const $ = (sel) => document.querySelector(sel);

export class ResultsView {
  constructor() {
    this.root = $('#results-view');
    this.chart = $('#r-chart');
    this.samples = [];
    this.token = 0;

    // Keep the chart crisp when the window changes size.
    let width = 0;
    new ResizeObserver(() => {
      if (this.root.hidden || !this.samples.length || this.chart.clientWidth === width) return;
      width = this.chart.clientWidth;
      renderResultChart(this.chart, this.samples, { animated: false });
    }).observe(this.chart);
  }

  /**
   * @param {object} result  from TypingTest#result()
   * @param {{title:string, detail:string, mode:string, best:{isBest:boolean, previous:object|null}}} info
   */
  async show(result, info) {
    const token = ++this.token;
    const isQuote = info.mode === 'quote';
    const isZen = info.mode === 'zen';

    $('#res-main').dataset.primary = isQuote ? 'acc' : 'wpm';
    $('#r-test').textContent = info.title;
    $('#r-test-sub').textContent = info.detail;
    $('#r-wpm').title = `${result.wpm.toFixed(2)} wpm`;
    $('#r-acc').title = isZen ? '' : `${result.accuracy.toFixed(2)}%`;
    $('#r-raw').title = `${result.raw.toFixed(2)} wpm`;
    $('#r-cons').title = `${result.consistency.toFixed(2)}%`;
    this.#renderBest(info);

    this.root.hidden = false;
    const reveals = [...this.root.querySelectorAll('[data-reveal]')];
    reveals.forEach((el, i) => fadeIn(el, { y: 12, duration: 420, delay: 70 * i }));

    const num = (sel, to, opts = {}) => countUp($(sel), to, { duration: 900, delay: 120, ...opts });
    num('#r-wpm', Math.round(result.wpm), { duration: 1100 });
    if (isZen) $('#r-acc').textContent = '-';
    else num('#r-acc', Math.round(result.accuracy), { suffix: '%' });
    num('#r-raw', Math.round(result.raw));
    num('#r-c-correct', result.chars.correct);
    num('#r-c-incorrect', result.chars.incorrect);
    num('#r-c-extra', result.chars.extra);
    num('#r-c-missed', result.chars.missed);
    num('#r-cons', Math.round(result.consistency), { suffix: '%' });
    const whole = Number.isInteger(result.duration);
    num('#r-time', result.duration, { decimals: whole ? 0 : 1, suffix: 's' });

    this.samples = result.samples;
    await nextFrame();
    await wait(250);
    if (token !== this.token) return;
    renderResultChart(this.chart, this.samples, { animated: true });
  }

  hide() {
    this.token++;
    return fadeOut(this.root, { y: -8, duration: 200 });
  }

  #renderBest({ title, mode, best }) {
    const out = $('#r-best');
    out.replaceChildren();
    if (mode === 'zen') return;
    const describe = (r) => (mode === 'quote' ? `${r.accuracy.toFixed(1)}% accuracy, ${Math.round(r.wpm)} wpm` : `${Math.round(r.wpm)} wpm`);
    const text = document.createElement('span');
    if (best.isBest) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'new best';
      out.append(badge);
      text.textContent = best.previous ? `previous best ${describe(best.previous)}` : `first result for ${title}`;
      animate(badge, [
        { opacity: 0, transform: 'scale(0.7)' },
        { opacity: 1, transform: 'scale(1.08)', offset: 0.7 },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 520, delay: 900, fill: 'backwards' });
    } else {
      text.textContent = best.previous ? `personal best ${describe(best.previous)}` : '';
    }
    out.append(text);
  }
}
