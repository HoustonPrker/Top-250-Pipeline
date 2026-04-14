// ============================================================
// STORE PERFORMANCE VIEW
// Uses globals: storeData, dataReady
// ============================================================

let storeSortCol = 'annual', storeSortDir = 'desc';
let storeTierFilter = 'ALL';
let storeViewCharts = {};

function destroyStoreCharts() {
  Object.values(storeViewCharts).forEach(c => { try { c.destroy(); } catch (_) {} });
  storeViewCharts = {};
}

const TIER_COLORS = { HIGH: '#16a34a', MEDIUM: '#3d5a80', LOW: '#6b7280' };
const TIER_DIM    = '#d1d5db';

const storeTooltipDefaults = {
  backgroundColor: '#fff',
  titleColor: '#1a2332',
  bodyColor: '#374151',
  borderColor: '#e5e7eb',
  borderWidth: 1,
  padding: 10,
  titleFont: { family: 'Inter, sans-serif', size: 12, weight: '600' },
  bodyFont:  { family: 'Inter, sans-serif', size: 12 }
};

// ── Entry point ───────────────────────────────────────────────

function renderStoreView() {
  if (!dataReady) return;
  const hash  = window.location.hash;
  const match = hash.match(/^#store\/(.+)$/);
  if (match) {
    const store = storeData.find(s => String(s.STR_ID).trim() === match[1]);
    if (store) { renderStoreDetail(store); return; }
  }
  renderStoreOverview();
}

// ── Overview ──────────────────────────────────────────────────

function renderStoreOverview() {
  destroyStoreCharts();
  window.location.hash = '#store';

  const high       = storeData.filter(s => s.STORE_TIER === 'HIGH');
  const medium     = storeData.filter(s => s.STORE_TIER === 'MEDIUM');
  const low        = storeData.filter(s => s.STORE_TIER === 'LOW');
  const total90Rev = storeData.reduce((s, r) => s + (parseFloat(r.AMT_90D) || 0), 0);

  let list = storeTierFilter === 'ALL' ? storeData
           : storeData.filter(s => s.STORE_TIER === storeTierFilter);

  list = [...list].sort((a, b) => {
    const dir = storeSortDir === 'asc' ? 1 : -1;
    switch (storeSortCol) {
      case 'storeno': return dir * ((parseFloat(a.STR_ID) || 0) - (parseFloat(b.STR_ID) || 0));
      case 'store':   return dir * ((a.STORE_NAME || '').localeCompare(b.STORE_NAME || ''));
      case 'city':    return dir * ((a.CITY || '').localeCompare(b.CITY || ''));
      case 'state':   return dir * ((a.STATE || '').localeCompare(b.STATE || ''));
      case 'tier':    return dir * ((a.STORE_TIER || '').localeCompare(b.STORE_TIER || ''));
      case 'annual':  return dir * ((parseFloat(a.ANNUAL_REVENUE) || 0) - (parseFloat(b.ANNUAL_REVENUE) || 0));
      case 'qty90':   return dir * ((parseFloat(a.QTY_90D) || 0) - (parseFloat(b.QTY_90D) || 0));
      case 'amt90':   return dir * ((parseFloat(a.AMT_90D) || 0) - (parseFloat(b.AMT_90D) || 0));
      case 'vel':     return dir * ((parseFloat(a.PCT_RECENT) || 0) - (parseFloat(b.PCT_RECENT) || 0));
      case 'txn':     return dir * ((parseFloat(a.TXN_90D) || 0) - (parseFloat(b.TXN_90D) || 0));
      case 'stocked': return dir * ((parseFloat(a.ITEMS_STOCKED) || 0) - (parseFloat(b.ITEMS_STOCKED) || 0));
      default:        return dir * ((parseFloat(a.ANNUAL_REVENUE) || 0) - (parseFloat(b.ANNUAL_REVENUE) || 0));
    }
  });

  const cols = [
    { key: 'storeno', label: 'Store #',       cls: 'num-ctr' },
    { key: 'store',   label: 'Store Name' },
    { key: 'city',    label: 'City' },
    { key: 'state',   label: 'State',         cls: 'num-ctr' },
    { key: 'tier',    label: 'Tier',           cls: 'num-ctr' },
    { key: 'annual',  label: 'Annual Revenue', cls: 'num-ctr' },
    { key: 'qty90',   label: '90D Qty',        cls: 'num-ctr' },
    { key: 'amt90',   label: '90D Revenue',    cls: 'num-ctr' },
    { key: 'vel',     label: 'Velocity',       cls: 'num-ctr' },
    { key: 'txn',     label: 'Txns (90D)',     cls: 'num-ctr' },
    { key: 'stocked', label: 'Items Stocked',  cls: 'num-ctr' },
  ];

  const thead = cols.map(c => {
    const active = storeSortCol === c.key;
    const icon   = active ? (storeSortDir === 'asc' ? '▲' : '▼') : '⇅';
    const cls    = [c.cls || '', 'sort-th', active ? 'sort-active' : ''].filter(Boolean).join(' ');
    return `<th class="${cls}" onclick="storeSortBy('${c.key}')">${c.label}<span class="sort-icon">${icon}</span></th>`;
  }).join('');

  const tbody = list.map(s => {
    const vel    = parseFloat(s.PCT_RECENT) || 0;
    const velCls = vel >= 30 ? 'vel-up' : vel < 20 ? 'vel-down' : 'vel-ss';
    const velArr = vel >= 30 ? '↑' : vel < 20 ? '↓' : '→';
    const tier   = (s.STORE_TIER || '').toUpperCase();
    const tierBadge = `<span class="tier-badge tier-${tier.toLowerCase()}">${tier}</span>`;
    const cleanName = (s.STORE_NAME || '').replace(/^\d+\s*[-–—]+\s*/, '').trim();
    return `<tr onclick="storeZoom('${String(s.STR_ID).trim()}')">
      <td class="num-ctr" style="font-weight:600">${s.STR_ID || '—'}</td>
      <td class="store-name-cell"><strong>${cleanName || s.STORE_NAME}</strong></td>
      <td>${s.CITY || '—'}</td>
      <td class="num-ctr">${s.STATE || '—'}</td>
      <td class="num-ctr">${tierBadge}</td>
      <td class="num-ctr">${fmt$(parseFloat(s.ANNUAL_REVENUE) || 0)}</td>
      <td class="num-ctr">${fmtQty(s.QTY_90D)}</td>
      <td class="num-ctr">${fmt$(parseFloat(s.AMT_90D) || 0)}</td>
      <td class="num-ctr"><span class="${velCls}">${velArr}</span> ${vel.toFixed(1)}%</td>
      <td class="num-ctr">${parseInt(s.TXN_90D || 0).toLocaleString()}</td>
      <td class="num-ctr">${parseInt(s.ITEMS_STOCKED || 0).toLocaleString()}</td>
    </tr>`;
  }).join('');

  const tierBtn = tier => {
    const active = storeTierFilter === tier;
    const count  = tier === 'ALL' ? storeData.length
                 : storeData.filter(s => s.STORE_TIER === tier).length;
    const label  = tier === 'ALL' ? `All (${count})` : `${tier.charAt(0) + tier.slice(1).toLowerCase()} (${count})`;
    return `<button class="tier-filter-btn${active ? ' active' : ''}" onclick="setStoreTierFilter('${tier}')">${label}</button>`;
  };

  document.getElementById('store-view-content').innerHTML = `
    <div class="cat-stat-bar">
      <div class="cat-stat-item"><span class="cat-stat-lbl">Stores:</span><span class="cat-stat-val">${storeData.length}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">High Volume:</span><span class="cat-stat-val">${high.length}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">Medium Volume:</span><span class="cat-stat-val">${medium.length}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">Low Volume:</span><span class="cat-stat-val">${low.length}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">90D Revenue:</span><span class="cat-stat-val">${fmtRevMM(total90Rev)}</span></div>
    </div>
    <div class="tier-filter-bar">
      ${tierBtn('ALL')}${tierBtn('HIGH')}${tierBtn('MEDIUM')}${tierBtn('LOW')}
    </div>
    <div class="chart-row-3">
      <div class="chart-panel">
        <div class="chart-panel-title">Top 15 Stores — 90D Revenue</div>
        <div class="chart-container" style="height:350px"><canvas id="store-bar-chart"></canvas></div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">Revenue by Tier</div>
        <div class="chart-container" style="height:350px"><canvas id="store-donut-chart"></canvas></div>
      </div>
      <div class="chart-panel">
        <div class="chart-panel-title">Annual Revenue vs Velocity</div>
        <div class="chart-container" style="height:350px"><canvas id="store-scatter-chart"></canvas></div>
      </div>
    </div>
    <div class="inv-wrap">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;

  setTimeout(() => renderStoreCharts(), 0);
}

function renderStoreCharts() {
  const filter  = storeTierFilter;
  const top15   = [...storeData].sort((a, b) => (parseFloat(b.AMT_90D) || 0) - (parseFloat(a.AMT_90D) || 0)).slice(0, 15);
  const maxQty  = Math.max(...storeData.map(s => parseFloat(s.QTY_90D) || 0)) || 1;

  const barColors = top15.map(s =>
    filter === 'ALL' || s.STORE_TIER === filter ? TIER_COLORS[s.STORE_TIER] || '#6b7280' : TIER_DIM
  );

  // ── Bar chart: top 15 stores ──────────────────────────────────
  const barCtx = document.getElementById('store-bar-chart');
  if (barCtx) {
    storeViewCharts.bar = new Chart(barCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: top15.map(s => `${s.STR_ID}`),
        datasets: [{
          data: top15.map(s => parseFloat(s.AMT_90D) || 0),
          backgroundColor: barColors,
          borderWidth: 0,
          borderRadius: 3
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...storeTooltipDefaults,
            callbacks: {
              title: ctx => {
                const s = top15[ctx[0].dataIndex];
                return s ? s.STORE_NAME : '';
              },
              label: ctx => ` 90D Revenue: ${fmt$(ctx.parsed.x)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280', callback: v => fmtRevMM(v) },
            grid: { color: 'rgba(0,0,0,0.04)' }
          },
          y: {
            ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#374151' },
            grid: { display: false }
          }
        }
      }
    });
  }

  // ── Doughnut: revenue by tier ─────────────────────────────────
  const donutCtx = document.getElementById('store-donut-chart');
  if (donutCtx) {
    const tiers     = ['HIGH', 'MEDIUM', 'LOW'];
    const tierRevs  = tiers.map(t => storeData.filter(s => s.STORE_TIER === t).reduce((sum, s) => sum + (parseFloat(s.AMT_90D) || 0), 0));
    const tierPalette = tiers.map(t => TIER_COLORS[t]);

    storeViewCharts.donut = new Chart(donutCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['High', 'Medium', 'Low'],
        datasets: [{
          data: tierRevs,
          backgroundColor: tierPalette,
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: { size: 11, family: 'Inter, sans-serif' },
              color: '#374151',
              boxWidth: 12,
              padding: 10
            }
          },
          tooltip: {
            ...storeTooltipDefaults,
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                return ` ${fmtRevMM(ctx.parsed)} (${((ctx.parsed / total) * 100).toFixed(1)}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ── Bubble/scatter: annual revenue vs velocity ────────────────
  const scatterCtx = document.getElementById('store-scatter-chart');
  if (scatterCtx) {
    const datasets = ['HIGH', 'MEDIUM', 'LOW'].map(tier => ({
      label: tier.charAt(0) + tier.slice(1).toLowerCase(),
      data: storeData.filter(s => s.STORE_TIER === tier).map(s => ({
        x: parseFloat(s.ANNUAL_REVENUE) || 0,
        y: parseFloat(s.PCT_RECENT) || 0,
        r: 5 + ((parseFloat(s.QTY_90D) || 0) / maxQty) * 13,
        storeName: s.STORE_NAME,
        storeId: s.STR_ID
      })),
      backgroundColor: filter === 'ALL' || filter === tier
        ? TIER_COLORS[tier] + 'cc'
        : TIER_DIM + '66',
      borderColor: filter === 'ALL' || filter === tier
        ? TIER_COLORS[tier]
        : TIER_DIM,
      borderWidth: 1
    }));

    storeViewCharts.scatter = new Chart(scatterCtx.getContext('2d'), {
      type: 'bubble',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#374151', boxWidth: 12, padding: 10 }
          },
          tooltip: {
            ...storeTooltipDefaults,
            callbacks: {
              label: ctx => {
                const d = ctx.raw;
                return [`  ${d.storeName}`, `  Revenue: ${fmtRevMM(d.x)}`, `  Velocity: ${d.y.toFixed(1)}%`];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280', callback: v => fmtRevMM(v) },
            grid: { color: 'rgba(0,0,0,0.04)' },
            title: { display: true, text: 'Annual Revenue', font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280' }
          },
          y: {
            ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280', callback: v => v + '%' },
            grid: { color: 'rgba(0,0,0,0.04)' },
            title: { display: true, text: 'Velocity (%)', font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280' }
          }
        }
      }
    });
  }
}

function storeSortBy(col) {
  if (storeSortCol === col) {
    storeSortDir = storeSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    storeSortCol = col;
    storeSortDir = (col === 'store' || col === 'city' || col === 'state' || col === 'tier') ? 'asc' : 'desc';
  }
  renderStoreOverview();
}

function setStoreTierFilter(tier) {
  storeTierFilter = tier;
  renderStoreOverview();
}

// ── Store detail ──────────────────────────────────────────────

function storeZoom(strId) {
  const store = storeData.find(s => String(s.STR_ID).trim() === String(strId));
  if (!store) return;
  window.location.hash = `#store/${strId}`;
  renderStoreDetail(store);
}

function renderStoreDetail(s) {
  destroyStoreCharts();

  const cleanStoreName = (s.STORE_NAME || '').replace(/^\d+\s*[-–—]+\s*/, '').trim() || s.STORE_NAME;
  const vel    = parseFloat(s.PCT_RECENT) || 0;
  const velCls = vel >= 30 ? 'vel-up' : vel < 20 ? 'vel-down' : 'vel-ss';
  const velArr = vel >= 30 ? '↑' : vel < 20 ? '↓' : '→';
  const tier   = (s.STORE_TIER || '').toUpperCase();

  const metrics = [
    { label: 'Qty On Hand',        val: fmtQty(s.QTY_ON_HND) },
    { label: 'Qty Available',      val: fmtQty(s.QTY_AVAIL) },
    { label: 'Items Stocked',      val: parseInt(s.ITEMS_STOCKED || 0).toLocaleString() },
    { label: 'Unique Items (90D)', val: parseInt(s.UNIQUE_ITEMS_90D || 0).toLocaleString() },
    { label: 'Categories Sold',    val: s.CATEGORIES_SOLD || '—' },
    { label: 'Transactions (90D)', val: parseInt(s.TXN_90D || 0).toLocaleString() },
  ];

  const metricCards = metrics.map(m => `
    <div class="kpi-card">
      <div class="kpi-lbl">${m.label}</div>
      <div class="kpi-val" style="font-size:24px">${m.val}</div>
    </div>`).join('');

  document.getElementById('store-view-content').innerHTML = `
    <div class="cat-nav-breadcrumb">
      <a class="cat-back-link" onclick="renderStoreOverview()">← Back to all stores</a>
      <span style="color:#9ca3af;margin:0 8px">/</span>
      <span style="color:#1a2332;font-weight:600">${cleanStoreName}</span>
    </div>
    <div class="item-header-card">
      <div class="hdr-row1">
        <div class="hdr-name">${cleanStoreName}</div>
        <span class="hdr-badge">#${s.STR_ID}</span>
        <span class="tier-badge tier-${tier.toLowerCase()}" style="font-size:13px;padding:4px 12px">${tier}</span>
      </div>
      <div class="hdr-row2">
        <div class="hdr-field"><span class="hdr-lbl">City</span><span class="hdr-val">${s.CITY || '—'}</span></div>
        <div class="hdr-field"><span class="hdr-lbl">State</span><span class="hdr-val">${s.STATE || '—'}</span></div>
        <div class="hdr-field"><span class="hdr-lbl">Annual Revenue</span><span class="hdr-val">${fmt$(parseFloat(s.ANNUAL_REVENUE) || 0)}</span></div>
        <div class="hdr-field"><span class="hdr-lbl">90D Revenue</span><span class="hdr-val">${fmt$(parseFloat(s.AMT_90D) || 0)}</span></div>
        <div class="hdr-field"><span class="hdr-lbl">Velocity</span><span class="hdr-val ${velCls}">${velArr} ${vel.toFixed(1)}%</span></div>
      </div>
    </div>
    <div class="kpi-row">${metricCards}</div>
    <div class="chart-panel" style="margin-top:16px;margin-bottom:16px">
      <div class="chart-panel-title">90D Revenue vs Tier Average</div>
      <div class="chart-container" style="height:180px"><canvas id="store-compare-chart"></canvas></div>
    </div>
    <div class="card" style="margin-top:0">
      <div class="card-title">Category Breakdown</div>
      <div style="padding:16px;color:#6b7280;font-size:14px">
        ℹ Per-store category breakdown requires the store_detail.sql query (not yet available in POC dataset).
        The metrics above are aggregated from CK_store_data.csv.
      </div>
    </div>`;

  setTimeout(() => renderStoreDetailChart(s, tier), 0);
}

function renderStoreDetailChart(s, tier) {
  const ctx = document.getElementById('store-compare-chart');
  if (!ctx) return;

  const tierStores = storeData.filter(st => st.STORE_TIER === tier);
  const tierAvg    = tierStores.reduce((sum, st) => sum + (parseFloat(st.AMT_90D) || 0), 0) / (tierStores.length || 1);
  const thisRev    = parseFloat(s.AMT_90D) || 0;
  const tierColor  = TIER_COLORS[tier] || '#6b7280';

  storeViewCharts.compare = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['This Store', 'Tier Average'],
      datasets: [{
        data: [thisRev, tierAvg],
        backgroundColor: [tierColor, '#d1d5db'],
        borderColor: [tierColor, '#9ca3af'],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...storeTooltipDefaults,
          callbacks: { label: ctx => ` ${fmt$(ctx.parsed.y)}` }
        }
      },
      scales: {
        x: {
          ticks: { font: { size: 12, family: 'Inter, sans-serif' }, color: '#374151' },
          grid: { display: false }
        },
        y: {
          ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280', callback: v => fmtRevMM(v) },
          grid: { color: 'rgba(0,0,0,0.04)' },
          beginAtZero: true
        }
      }
    }
  });
}
