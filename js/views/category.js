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
      case 'qty30':    return dir * (a.qty - b.qty);
      case 'rev30':    return dir * (a.rev - b.rev);
      case 'vel':      return dir * (a.vel - b.vel);
      default:         return dir * (a.rev - b.rev);
    }
  });

  const totalRev   = catList.reduce((s, c) => s + c.rev, 0);
  const totalItems = pipelineData.length;
  const totalCats  = catList.length;

  const cols = [
    { key: 'name',    label: 'Category' },
    { key: 'items',   label: 'Items',                    cls: 'num-ctr' },
    { key: 'subcats', label: 'Sub-cats',                 cls: 'num-ctr' },
    { key: 'qty',     label: '90D Qty',                  cls: 'num-ctr' },
    { key: 'revenue', label: '90D Revenue',               cls: 'num-ctr' },
    { key: 'qty30',   label: '30D Qty',     cls: 'num-ctr' },
    { key: 'rev30',   label: '30D Revenue', cls: 'num-ctr' },
    { key: 'vel',     label: 'Avg Velocity',              cls: 'num-ctr' },
  ];

  const thead = cols.map(c => {
    const active = catSortCol === c.key;
    const icon   = active ? (catSortDir === 'asc' ? '▲' : '▼') : '⇅';
    const cls    = [c.cls || '', 'sort-th', active ? 'sort-active' : ''].filter(Boolean).join(' ');
    return `<th class="${cls}" onclick="catSortBy('${c.key}')">${c.label}<span class="sort-icon">${icon}</span></th>`;
  }).join('');

  const tbody = catList.map((c, idx) => {
    const velCls     = c.vel >= 30 ? 'vel-up' : c.vel < 20 ? 'vel-down' : 'vel-ss';
    const velArrow   = c.vel >= 30 ? '↑'      : c.vel < 20 ? '↓'        : '→';
    const isTop5     = idx < 5;
    const isGroupEnd = (idx + 1) % 5 === 0 && idx !== catList.length - 1;
    const rowCls     = [isTop5 ? 'cat-top5' : '', isGroupEnd ? 'cat-group-end' : ''].filter(Boolean).join(' ');
    return `<tr class="${rowCls}" onclick="showCategoryDetail('${c.name.replace(/'/g, "\\'")}')">
      <td class="cat-name-cell"><strong>${c.name}</strong></td>
      <td class="num-ctr">${c.itemCount.toLocaleString()}</td>
      <td class="num-ctr">${c.subcats}</td>
      <td class="num-ctr">${fmtQty(c.qty)}</td>
      <td class="num-ctr">${fmtRevMM(c.rev)}</td>
      <td class="num-ctr">${fmtQty(c.qty / 3)}</td>
      <td class="num-ctr">${fmtRevMM(c.rev / 3)}</td>
      <td class="num-ctr"><span class="${velCls}">${velArrow}</span> ${c.vel.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  document.getElementById('cat-view-content').innerHTML = `
    <div class="cat-stat-bar">
      <div class="cat-stat-item"><span class="cat-stat-lbl">Categories:</span><span class="cat-stat-val">${totalCats}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">Total Items:</span><span class="cat-stat-val">${totalItems.toLocaleString()}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">90D Revenue:</span><span class="cat-stat-val">${fmtRevMM(totalRev)}</span></div>
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
      case 'qty30':   return dir * (a.qty - b.qty);
      case 'rev30':   return dir * (a.rev - b.rev);
      case 'vel':     return dir * (a.vel - b.vel);
      default:        return dir * (a.rev - b.rev);
    }
  });

  const cols = [
    { key: '',        label: '' },   // accordion toggle
    { key: 'name',    label: 'Sub-Category' },
    { key: 'items',   label: 'Items',        cls: 'num-ctr' },
    { key: 'qty',     label: '90D Qty',      cls: 'num-ctr' },
    { key: 'revenue', label: '90D Revenue',  cls: 'num-ctr' },
    { key: 'qty30',   label: '30D Qty',     cls: 'num-ctr' },
    { key: 'rev30',   label: '30D Revenue', cls: 'num-ctr' },
    { key: 'vel',     label: 'Avg Velocity', cls: 'num-ctr' },
    { key: '',        label: 'Normal?',      cls: 'num-ctr' },
  ];

  const thead = cols.map(c => {
    if (!c.key) return `<th${c.cls ? ` class="${c.cls}"` : ''}>${c.label}</th>`;
    const active = subcatSortCol === c.key;
    const icon   = active ? (subcatSortDir === 'asc' ? '▲' : '▼') : '⇅';
    const cls    = [c.cls || '', 'sort-th', active ? 'sort-active' : ''].filter(Boolean).join(' ');
    return `<th class="${cls}" onclick="subcatDetailSortBy('${catName.replace(/'/g, "\\'")}','${c.key}')">${c.label}<span class="sort-icon">${icon}</span></th>`;
  }).join('');

  const tbody = subcatList.map(sub => {
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
        <td class="num-ctr">${sub.itemCount}</td>
        <td class="num-ctr">${fmtQty(sub.qty)}</td>
        <td class="num-ctr">${fmtRevMM(sub.rev)}</td>
        <td class="num-ctr">${fmtQty(sub.qty / 3)}</td>
        <td class="num-ctr">${fmtRevMM(sub.rev / 3)}</td>
        <td class="num-ctr"><span class="${velCls}">${velArrow}</span> ${sub.vel.toFixed(1)}%</td>
        <td class="num-ctr">${normBadge}</td>
      </tr>
      <tr class="acc-expand-row" id="acc-row-${safeId}" style="display:none">
        <td colspan="9"><div class="acc-content" id="acc-content-${safeId}"></div></td>
      </tr>`;
  }).join('');

  document.getElementById('cat-view-content').innerHTML = `
    <div class="cat-nav-breadcrumb">
      <a class="cat-back-link" onclick="renderCatOverview()">← All Categories</a>
      <span style="color:#9ca3af;margin:0 8px">/</span>
      <span style="color:#1a2332;font-weight:600">${catName}</span>
    </div>
    <div class="cat-section-heading">${catName} — Sub-categories</div>
    <div class="cat-stat-bar">
      <div class="cat-stat-item"><span class="cat-stat-lbl">Sub-categories:</span><span class="cat-stat-val">${subcatList.length}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">Total Items:</span><span class="cat-stat-val">${cat.items.length.toLocaleString()}</span></div>
      <span class="cat-stat-sep">·</span>
      <div class="cat-stat-item"><span class="cat-stat-lbl">90D Revenue:</span><span class="cat-stat-val">${fmtRevMM(catRev)}</span></div>
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
