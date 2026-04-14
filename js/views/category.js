// ============================================================
// CATEGORY PERFORMANCE VIEW
// Uses globals: pipelineData, normalityMap, dataReady
// ============================================================

let catSortCol = 'revenue', catSortDir = 'desc';
let subcatSortCol = 'revenue', subcatSortDir = 'desc';

// ── Data aggregation ─────────────────────────────────────────

function buildCategoryMap() {
  const catMap = {};
  pipelineData.forEach(item => {
    const cat = item.CATEG_COD || 'UNKNOWN';
    const sub = item.SUBCAT_COD || 'UNKNOWN';
    if (!catMap[cat]) catMap[cat] = { name: cat, subcats: {}, items: [] };
    catMap[cat].items.push(item);
    if (!catMap[cat].subcats[sub]) catMap[cat].subcats[sub] = { name: sub, items: [] };
    catMap[cat].subcats[sub].items.push(item);
  });
  return catMap;
}

// ── Entry point ───────────────────────────────────────────────

function renderCategoryView() {
  if (!dataReady) return;
  renderCatOverview();
}

// ── Category overview table ───────────────────────────────────

function renderCatOverview() {
  const catMap  = buildCategoryMap();
  const catList = Object.values(catMap).map(cat => {
    const rev     = cat.items.reduce((s, i) => s + (parseFloat(i.RAW_AMT_90D) || 0), 0);
    const qty     = cat.items.reduce((s, i) => s + (parseFloat(i.RAW_QTY_90D) || 0), 0);
    const vel     = cat.items.reduce((s, i) => s + (parseFloat(i.PCT_RECENT)  || 0), 0) / cat.items.length;
    const trendUp = cat.items.filter(i => (parseFloat(i.PCT_RECENT) || 0) >= 30).length;
    const oos     = cat.items.filter(i => (i.STATUS || '').toUpperCase() === 'OUT OF STOCK').length;
    const scCount = Object.keys(cat.subcats).length;
    return { name: cat.name, itemCount: cat.items.length, subcats: scCount, rev, qty, vel, trendUp, oos };
  });

  catList.sort((a, b) => {
    const dir = catSortDir === 'asc' ? 1 : -1;
    switch (catSortCol) {
      case 'name':     return dir * a.name.localeCompare(b.name);
      case 'items':    return dir * (a.itemCount - b.itemCount);
      case 'subcats':  return dir * (a.subcats - b.subcats);
      case 'qty':      return dir * (a.qty - b.qty);
      case 'revenue':  return dir * (a.rev - b.rev);
      case 'vel':      return dir * (a.vel - b.vel);
      case 'trending': return dir * (a.trendUp - b.trendUp);
      default:         return dir * (a.rev - b.rev);
    }
  });

  const totalRev   = catList.reduce((s, c) => s + c.rev, 0);
  const totalItems = pipelineData.length;
  const totalCats  = catList.length;

  const cols = [
    { key: 'name',     label: 'Category' },
    { key: 'items',    label: 'Items',       cls: 'num' },
    { key: 'subcats',  label: 'Sub-cats',    cls: 'num' },
    { key: 'qty',      label: '90D Qty',     cls: 'num' },
    { key: 'revenue',  label: '90D Revenue', cls: 'num' },
    { key: 'vel',      label: 'Avg Velocity',cls: 'num' },
    { key: 'trending', label: 'Trending Up', cls: 'num' },
  ];

  const thead = cols.map(c => {
    const active = catSortCol === c.key;
    const icon   = active ? (catSortDir === 'asc' ? '▲' : '▼') : '⇅';
    const cls    = [c.cls || '', 'sort-th', active ? 'sort-active' : ''].filter(Boolean).join(' ');
    return `<th class="${cls}" onclick="catSortBy('${c.key}')">${c.label}<span class="sort-icon">${icon}</span></th>`;
  }).join('');

  const tbody = catList.map(c => {
    const velCls   = c.vel >= 30 ? 'vel-up' : c.vel < 20 ? 'vel-down' : 'vel-ss';
    const velArrow = c.vel >= 30 ? '↑'      : c.vel < 20 ? '↓'        : '→';
    return `<tr onclick="showCategoryDetail('${c.name.replace(/'/g, "\\'")}')">
      <td><strong>${c.name}</strong></td>
      <td class="num">${c.itemCount.toLocaleString()}</td>
      <td class="num">${c.subcats}</td>
      <td class="num">${fmtQty(c.qty)}</td>
      <td class="num">${fmtRevMM(c.rev)}</td>
      <td class="num"><span class="${velCls}">${velArrow}</span> ${c.vel.toFixed(1)}%</td>
      <td class="num">${c.trendUp} <span style="color:#9ca3af;font-size:10px">of ${c.itemCount}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('cat-view-content').innerHTML = `
    <div class="cat-summary-bar">
      <div class="cat-summary-stat"><div class="cat-summary-lbl">Categories</div><div class="cat-summary-val">${totalCats}</div></div>
      <div class="cat-summary-stat"><div class="cat-summary-lbl">Total Items</div><div class="cat-summary-val">${totalItems.toLocaleString()}</div></div>
      <div class="cat-summary-stat"><div class="cat-summary-lbl">90D Revenue</div><div class="cat-summary-val">${fmtRevMM(totalRev)}</div></div>
    </div>
    <div class="inv-wrap">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

function catSortBy(col) {
  if (catSortCol === col) {
    catSortDir = catSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    catSortCol = col;
    catSortDir = col === 'name' ? 'asc' : 'desc';
  }
  renderCatOverview();
}

// ── Category detail (sub-categories) ─────────────────────────

function showCategoryDetail(catName) {
  const catMap = buildCategoryMap();
  const cat    = catMap[catName];
  if (!cat) return;

  const subcatList = Object.values(cat.subcats).map(sub => {
    const rev     = sub.items.reduce((s, i) => s + (parseFloat(i.RAW_AMT_90D) || 0), 0);
    const qty     = sub.items.reduce((s, i) => s + (parseFloat(i.RAW_QTY_90D) || 0), 0);
    const vel     = sub.items.reduce((s, i) => s + (parseFloat(i.PCT_RECENT)  || 0), 0) / sub.items.length;
    const normKey = `${catName}|${sub.name}`;
    const norm    = normalityMap[normKey];
    return { name: sub.name, items: sub.itemList || sub.items, itemCount: sub.items.length, rev, qty, vel, norm };
  });

  const catRev = subcatList.reduce((s, c) => s + c.rev, 0);

  subcatList.sort((a, b) => {
    const dir = subcatSortDir === 'asc' ? 1 : -1;
    switch (subcatSortCol) {
      case 'name':    return dir * a.name.localeCompare(b.name);
      case 'items':   return dir * (a.itemCount - b.itemCount);
      case 'qty':     return dir * (a.qty - b.qty);
      case 'revenue': return dir * (a.rev - b.rev);
      case 'vel':     return dir * (a.vel - b.vel);
      default:        return dir * (a.rev - b.rev);
    }
  });

  const cols = [
    { key: '',        label: '' },   // accordion toggle
    { key: 'name',    label: 'Sub-Category' },
    { key: 'items',   label: 'Items',       cls: 'num' },
    { key: 'qty',     label: '90D Qty',     cls: 'num' },
    { key: 'revenue', label: '90D Revenue', cls: 'num' },
    { key: 'vel',     label: 'Avg Velocity',cls: 'num' },
    { key: '',        label: 'Normal?',     cls: 'num' },
  ];

  const thead = cols.map(c => {
    if (!c.key) return `<th${c.cls ? ` class="${c.cls}"` : ''}>${c.label}</th>`;
    const active = subcatSortCol === c.key;
    const icon   = active ? (subcatSortDir === 'asc' ? '▲' : '▼') : '⇅';
    const cls    = [c.cls || '', 'sort-th', active ? 'sort-active' : ''].filter(Boolean).join(' ');
    return `<th class="${cls}" onclick="subcatDetailSortBy('${catName.replace(/'/g, "\\'")}','${c.key}')">${c.label}<span class="sort-icon">${icon}</span></th>`;
  }).join('');

  const tbody = subcatList.map((sub, idx) => {
    const velCls    = sub.vel >= 30 ? 'vel-up' : sub.vel < 20 ? 'vel-down' : 'vel-ss';
    const velArrow  = sub.vel >= 30 ? '↑' : sub.vel < 20 ? '↓' : '→';
    const normBadge = sub.norm
      ? (sub.norm.NORMAL === 'Yes'
        ? '<span class="norm-badge norm-yes">Normal</span>'
        : '<span class="norm-badge norm-no">Non-normal</span>')
      : '<span style="color:#9ca3af;font-size:10px">—</span>';
    const safeId = (catName + '_' + sub.name).replace(/[^a-zA-Z0-9_]/g, '_');
    return `
      <tr class="subcat-header-row" onclick="toggleSubcatAccordion('${safeId}', '${catName.replace(/'/g, "\\'")}', '${sub.name.replace(/'/g, "\\'")}')">
        <td style="width:28px;text-align:center"><span class="acc-toggle-btn" id="acc-btn-${safeId}">▶</span></td>
        <td><strong>${sub.name}</strong></td>
        <td class="num">${sub.itemCount}</td>
        <td class="num">${fmtQty(sub.qty)}</td>
        <td class="num">${fmtRevMM(sub.rev)}</td>
        <td class="num"><span class="${velCls}">${velArrow}</span> ${sub.vel.toFixed(1)}%</td>
        <td class="num">${normBadge}</td>
      </tr>
      <tr class="acc-expand-row" id="acc-row-${safeId}" style="display:none">
        <td colspan="7"><div class="acc-content" id="acc-content-${safeId}"></div></td>
      </tr>`;
  }).join('');

  document.getElementById('cat-view-content').innerHTML = `
    <div class="cat-nav-breadcrumb">
      <a class="cat-back-link" onclick="renderCatOverview()">← All Categories</a>
      <span style="color:#9ca3af;margin:0 8px">/</span>
      <span style="color:#1a2332;font-weight:600">${catName}</span>
    </div>
    <div class="cat-section-heading">${catName} — Sub-categories</div>
    <div class="cat-summary-bar">
      <div class="cat-summary-stat"><div class="cat-summary-lbl">Sub-categories</div><div class="cat-summary-val">${subcatList.length}</div></div>
      <div class="cat-summary-stat"><div class="cat-summary-lbl">Total Items</div><div class="cat-summary-val">${cat.items.length.toLocaleString()}</div></div>
      <div class="cat-summary-stat"><div class="cat-summary-lbl">90D Revenue</div><div class="cat-summary-val">${fmtRevMM(catRev)}</div></div>
    </div>
    <div class="inv-wrap">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

function subcatDetailSortBy(catName, col) {
  if (subcatSortCol === col) {
    subcatSortDir = subcatSortDir === 'desc' ? 'asc' : 'desc';
  } else {
    subcatSortCol = col;
    subcatSortDir = col === 'name' ? 'asc' : 'desc';
  }
  showCategoryDetail(catName);
}

// ── Accordion: items within a sub-category ────────────────────

function toggleSubcatAccordion(safeId, catName, subcatName) {
  const row     = document.getElementById('acc-row-' + safeId);
  const btn     = document.getElementById('acc-btn-' + safeId);
  const content = document.getElementById('acc-content-' + safeId);
  if (!row) return;

  const isOpen = row.style.display !== 'none';
  if (isOpen) {
    row.style.display = 'none';
    btn.classList.remove('open');
  } else {
    row.style.display = '';
    btn.classList.add('open');
    if (!content.dataset.built) {
      buildAccordionItems(content, catName, subcatName);
      content.dataset.built = '1';
    }
  }
}

function buildAccordionItems(container, catName, subcatName) {
  const items = pipelineData.filter(
    i => i.CATEG_COD === catName && i.SUBCAT_COD === subcatName
  );

  // Pre-compute percentiles
  const withPct = items.map(item => {
    const { pct } = computePercentile(item);
    return { item, pct };
  });

  // Sort by percentile desc
  withPct.sort((a, b) => b.pct - a.pct);

  const rows = withPct.map(({ item, pct }) => {
    const pctR    = Math.round(pct * 10) / 10;
    const pctCls  = pct >= 75 ? 'pct-green' : pct >= 25 ? 'pct-yellow' : 'pct-red';
    const velCls  = (parseFloat(item.PCT_RECENT) || 0) >= 30 ? 'vel-up'
                  : (parseFloat(item.PCT_RECENT) || 0) < 20   ? 'vel-down' : 'vel-ss';
    const velArrow = (parseFloat(item.PCT_RECENT) || 0) >= 30 ? '↑'
                   : (parseFloat(item.PCT_RECENT) || 0) < 20  ? '↓' : '→';
    const status   = (item.STATUS || '').trim().toUpperCase();
    const stsCls   = status === 'ACTIVE' ? 'sts-active' : status === 'OUT OF STOCK' ? 'sts-oos' : 'sts-ns';
    const stsLbl   = status === 'ACTIVE' ? 'Active' : status === 'OUT OF STOCK' ? 'OOS' : 'Not Selling';

    return `<tr onclick="zoomToItem('${(item.ITEM_NO||'').replace(/'/g,"\\'")}')">
      <td><a class="item-link">${item.ITEM_NO || '—'}</a></td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">${item.ITEM_NAME || '—'}</td>
      <td class="num"><span class="pct-badge ${pctCls}">${pctR}th</span></td>
      <td class="num">${fmtQty(item.RAW_QTY_90D)}</td>
      <td class="num">${fmt$(item.RAW_AMT_90D)}</td>
      <td class="num"><span class="${velCls}">${velArrow}</span> ${parseFloat(item.PCT_RECENT)||0}%</td>
      <td><span class="${stsCls}">${stsLbl}</span></td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="items-inner-table">
      <thead>
        <tr>
          <th>Item #</th>
          <th>Name</th>
          <th class="num">Percentile</th>
          <th class="num">90D Qty</th>
          <th class="num">90D Revenue</th>
          <th class="num">Velocity</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Navigate to item zoom from category ───────────────────────

function zoomToItem(itemNo) {
  switchTab('item');
  document.getElementById('item-search').value = itemNo;
  doSearch();
}
