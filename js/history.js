// History panel: the last 50 results, a small progress chart and a few summary numbers.

import { openOverlay, closeOverlay } from './overlay.js';
import { renderSparkline } from './chart.js';
import { getHistory, clearHistory } from './storage.js';
import { fadeIn, nextFrame } from './anim.js';

const $ = (sel) => document.querySelector(sel);

const formatDate = (ms) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function createHistory({ onClose }) {
  const root = $('#history');
  const chart = $('#history-chart');
  const list = $('#history-list');
  const summary = $('#history-summary');
  const clearBtn = $('#history-clear');
  let armTimer = 0;

  const stat = (label, value) => `<div class="stat"><span class="label">${label}</span><span class="val">${value}</span></div>`;

  function render({ animated }) {
    const items = getHistory();
    const wpms = items.map((r) => r.wpm);
    const recent = wpms.slice(-10);
    const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : '-';
    summary.innerHTML =
      stat('tests', items.length) + stat('best wpm', wpms.length ? Math.round(Math.max(...wpms)) : '-') + stat('avg last 10', avg);

    list.replaceChildren(
      ...(items.length
        ? [...items].reverse().map((r) => {
            const li = document.createElement('li');
            const parts = [formatDate(r.date), r.label, `${Math.round(r.wpm)}`, `${Math.round(r.accuracy)}%`];
            li.innerHTML = '<span></span><span></span><b></b><span></span>';
            [...li.children].forEach((node, i) => { node.textContent = parts[i]; });
            return li;
          })
        : [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'no tests yet' })]),
    );
    renderSparkline(chart, wpms, { animated });
    chart.hidden = items.length === 0;
  }

  function disarm() {
    clearTimeout(armTimer);
    clearBtn.classList.remove('armed');
    clearBtn.textContent = 'clear history';
  }

  clearBtn.addEventListener('click', () => {
    if (!clearBtn.classList.contains('armed')) {
      clearBtn.classList.add('armed');
      clearBtn.textContent = 'click again to confirm';
      armTimer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    clearHistory();
    render({ animated: false });
  });

  $('#history-close').addEventListener('click', () => closeOverlay());

  return {
    async open() {
      disarm();
      await openOverlay(root, { onClose });
      await nextFrame(); // the chart needs the panel to have a size
      render({ animated: true });
      fadeIn(list, { y: 6, duration: 300 });
    },
  };
}
