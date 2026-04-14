// ============================================================
// CHARTS — Chart.js rendering
// Uses globals: activeCharts, pipelineData
// ============================================================

function destroyCharts() {
  Object.values(activeCharts).forEach(c => { try { c.destroy(); } catch (_) {} });
  activeCharts = {};
}

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      bodyFont: { family: 'SF Mono, Fira Code, monospace' },
      titleFont: { family: 'SF Mono, Fira Code, monospace' }
    }
  }
};

function syntheticTrend(total90, days) {
  const today = new Date();
  const daily = total90 / days;
  const raw = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = d.getDay();
    const boost = (dow === 0 || dow === 6) ? 1.28 : 1.0;
    raw.push(Math.max(0, daily * boost * (0.45 + Math.random() * 1.10)));
  }

  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const scale = total90 / sum;

  const labels = [], data = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    data.push(Math.round(raw[days - 1 - i] * scale));
  }
  return { labels, data };
}

function renderCharts(item, qty90, amt90) {
  const qty12m    = parseFloat(item.RAW_QTY_12M_TOTAL) || 0;
  const stksW     = parseInt(item.STORES_WITH_STOCK)   || 0;
  const maxStores = Math.max(
    pipelineData.reduce((m, i) => Math.max(m, parseInt(i.STORE_COUNT) || 0), 0),
    stksW
  );
  const stksOut  = Math.max(0, maxStores - stksW);
  const expected = qty12m / 4;

  // ── 1. 90-Day Trend Line ─────────────────────────────────────
  const { labels, data } = syntheticTrend(qty90, 90);
  activeCharts.trend = new Chart(
    document.getElementById('chart-trend').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#3d5a80',
        backgroundColor: 'rgba(61,90,128,0.08)',
        borderWidth: 1.5, fill: true,
        tension: 0.35, pointRadius: 0, pointHoverRadius: 3
      }]
    },
    options: {
      ...baseOpts,
      scales: {
        x: {
          ticks: { font: { size: 9, family: 'SF Mono, monospace' }, maxTicksLimit: 13, maxRotation: 0 },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        y: {
          ticks: { font: { size: 9, family: 'SF Mono, monospace' }, maxTicksLimit: 5 },
          grid: { color: 'rgba(0,0,0,0.04)' },
          beginAtZero: true
        }
      }
    }
  });

  // ── 2. Store Stock Doughnut ──────────────────────────────────
  activeCharts.pie = new Chart(
    document.getElementById('chart-stores').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: [`With Stock (${stksW})`, `Without Stock (${stksOut})`],
      datasets: [{
        data: [stksW, stksOut],
        backgroundColor: ['#3d5a80', '#d1d5db'],
        borderColor: ['#fff', '#fff'],
        borderWidth: 2
      }]
    },
    options: {
      ...baseOpts,
      plugins: {
        legend: {
          display: true, position: 'bottom',
          labels: { font: { size: 9, family: 'SF Mono, monospace' }, boxWidth: 12, padding: 6 }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}` } }
      },
      cutout: '50%'
    }
  });

  // ── 3. Actual vs Expected Bar ────────────────────────────────
  const velColor = qty90 >= expected ? '#3d5a80' : '#dc2626';
  activeCharts.compare = new Chart(
    document.getElementById('chart-compare').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Actual 90D', 'Expected (12M÷4)'],
      datasets: [{
        data: [qty90, Math.round(expected)],
        backgroundColor: [velColor, '#d1d5db'],
        borderColor: [velColor === '#3d5a80' ? '#2d4a6e' : '#991b1b', '#9ca3af'],
        borderWidth: 1
      }]
    },
    options: {
      ...baseOpts,
      scales: {
        x: {
          ticks: { font: { size: 10, family: 'SF Mono, monospace' } },
          grid: { display: false }
        },
        y: {
          ticks: { font: { size: 9, family: 'SF Mono, monospace' }, maxTicksLimit: 5 },
          grid: { color: 'rgba(0,0,0,0.04)' },
          beginAtZero: true
        }
      },
      plugins: {
        ...baseOpts.plugins,
        tooltip: {
          callbacks: { label: ctx => ` ${fmtQty(ctx.parsed.y)} units` }
        }
      }
    }
  });
}
