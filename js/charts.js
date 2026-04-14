// ─────────────────────────────────────────────────────────
// CHARTS
// activeCharts is declared in app.js (global state)
// ─────────────────────────────────────────────────────────
function destroyCharts() {
  Object.values(activeCharts).forEach(function(c){ c.destroy(); });
  activeCharts = {};
}

var baseOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index', intersect: false,
      bodyFont:  { family: 'Inter, system-ui, sans-serif', size: 11 },
      titleFont: { family: 'Inter, system-ui, sans-serif', size: 11 }
    }
  }
};

function syntheticTrend(totalQty, days) {
  var dailyAvg = totalQty / days;
  var labels = [], data = [], now = new Date();
  for (var d = days - 1; d >= 0; d--) {
    var date = new Date(now);
    date.setDate(date.getDate() - d);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    var dow = date.getDay();
    var wk  = (dow === 0 || dow === 6) ? 1.25 : 0.92;
    data.push(Math.max(0, Math.round(dailyAvg * wk * (0.65 + Math.random() * 0.7))));
  }
  return { labels: labels, data: data };
}

function renderCharts(item, qty90, amt90) {
  var qty12m  = parseFloat(item.RAW_QTY_12M_TOTAL) || 0;
  var stksW   = parseInt(item.STORES_WITH_STOCK)   || 0;
  var maxSt   = Math.max(
    pipelineData.reduce(function(m,i){ return Math.max(m, parseInt(i.STORE_COUNT)||0); }, 0),
    stksW
  );
  var stksOut  = Math.max(0, maxSt - stksW);
  var expected = qty12m / 4;

  // 1. Trend line
  var trend = syntheticTrend(qty90, 90);
  activeCharts.trend = new Chart(
    document.getElementById('chart-trend').getContext('2d'), {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [{ data: trend.data,
        borderColor: '#3d5a80', backgroundColor: 'rgba(61,90,128,0.07)',
        borderWidth: 1.5, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 3
      }]
    },
    options: Object.assign({}, baseOpts, {
      scales: {
        x: { ticks: { font: { size: 9 }, maxTicksLimit: 13, maxRotation: 0 }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { ticks: { font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true }
      }
    })
  });

  // 2. Doughnut
  activeCharts.pie = new Chart(
    document.getElementById('chart-stores').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['With Stock (' + stksW + ')', 'Without (' + stksOut + ')'],
      datasets: [{ data: [stksW, stksOut],
        backgroundColor: ['#3d5a80', '#d1d5db'], borderColor: ['#fff','#fff'], borderWidth: 2
      }]
    },
    options: Object.assign({}, baseOpts, {
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 9 }, boxWidth: 12, padding: 6 } },
        tooltip: { callbacks: { label: function(ctx){ return ' ' + ctx.label; } } }
      },
      cutout: '50%'
    })
  });

  // 3. Actual vs Expected
  var velColor  = qty90 >= expected ? '#3d5a80' : '#dc2626';
  var velBorder = qty90 >= expected ? '#2d4a6e' : '#991b1b';
  activeCharts.compare = new Chart(
    document.getElementById('chart-compare').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Actual 90D', 'Expected (12M÷4)'],
      datasets: [{ data: [qty90, Math.round(expected)],
        backgroundColor: [velColor, '#d1d5db'], borderColor: [velBorder, '#9ca3af'], borderWidth: 1
      }]
    },
    options: Object.assign({}, baseOpts, {
      scales: {
        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true }
      },
      plugins: Object.assign({}, baseOpts.plugins, {
        tooltip: { callbacks: { label: function(ctx){ return ' ' + fmtQty(ctx.parsed.y) + ' units'; } } }
      })
    })
  });
}
