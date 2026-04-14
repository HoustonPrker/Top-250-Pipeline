
// ═══════════════════════════════════════════════════════════
// CATEGORY AGGREGATION
// ═══════════════════════════════════════════════════════════
function buildCategoryMap() {
  var cats = {};
  pipelineData.forEach(function(item) {
    var cat = item.CATEG_COD;
    if (!cat) return;
    if (!cats[cat]) cats[cat] = { name: cat, items: [], subcats: {} };
    cats[cat].items.push(item);
    var sc = item.SUBCAT_COD;
    if (sc) {
      if (!cats[cat].subcats[sc]) cats[cat].subcats[sc] = [];
      cats[cat].subcats[sc].push(item);
    }
  });
  return cats;
}

function renderCategorySummary() {
  var totalSubcats = new Set(pipelineData.map(function(i){ return i.CATEG_COD + '|' + i.SUBCAT_COD; })).size;
  var cats = buildCategoryMap();
  var catCount = Object.keys(cats).length;
  var totalActive = pipelineData.filter(function(i){ return i.STATUS === 'ACTIVE'; }).length;
  var totalRev = pipelineData.reduce(function(s,i){ return s + (parseFloat(i.RAW_AMT_90D)||0); }, 0);
  var notSelling = pipelineData.filter(function(i){ return i.STATUS === 'NOT SELLING'; }).length;

  function setTxt(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  setTxt('cat-stat-cats',       catCount.toLocaleString());
  setTxt('cat-stat-subcats',    totalSubcats.toLocaleString());
  setTxt('cat-stat-active',     totalActive.toLocaleString());
  setTxt('cat-stat-revenue',    fmtRevMM(totalRev));
  setTxt('cat-stat-notselling', notSelling.toLocaleString());
}

function buildCatOverviewThead() {
  var thead = document.getElementById('cat-overview-thead');
  if (!thead) return;
  var cols = [
    { key: 'name',     label: 'Category',    cls: '' },
    { key: 'items',    label: 'Items',       cls: 'num' },
    { key: 'subcats',  label: 'Sub-cats',    cls: 'num' },
    { key: 'qty',      label: '90D Qty Sold',cls: 'num' },
    { key: 'revenue',  label: '90D Revenue', cls: 'num' },
    { key: 'vel',      label: 'Avg Velocity',cls: 'num' },
    { key: 'trending', label: 'Trending Up', cls: '' },
    { key: 'status',   label: 'Status',      cls: '' }
  ];
  var tr = document.createElement('tr');
  cols.forEach(function(col) {
    var th = document.createElement('th');
    var isActive = catOverviewSort.col === col.key;
    th.className = (col.cls ? col.cls + ' ' : '') + 'sort-th' + (isActive ? ' sort-active' : '');
    var icon = isActive ? (catOverviewSort.dir === 'asc' ? '▲' : '▼') : '↕';
    th.innerHTML = col.label + '<span class="sort-icon">' + icon + '</span>';
    th.dataset.col = col.key;
    th.onclick = (function(k){ return function(){ sortCatOverviewBy(k); }; })(col.key);
    tr.appendChild(th);
  });
  thead.innerHTML = '';
  thead.appendChild(tr);
}

function sortCatOverviewBy(col) {
  if (catOverviewSort.col === col) {
    catOverviewSort.dir = catOverviewSort.dir === 'desc' ? 'asc' : 'desc';
  } else {
    catOverviewSort.col = col;
    catOverviewSort.dir = (col === 'name') ? 'asc' : 'desc';
  }
  renderCategoryOverview();
}

function renderCategoryOverview() {
  if (!pipelineData.length) return;
  renderCategorySummary();
  var cats = buildCategoryMap();

  var catList = Object.values(cats).map(function(cat) {
    var rev     = cat.items.reduce(function(s,i){ return s+(parseFloat(i.RAW_AMT_90D)||0); },0);
    var qty     = cat.items.reduce(function(s,i){ return s+(parseFloat(i.RAW_QTY_90D)||0); },0);
    var vel     = cat.items.reduce(function(s,i){ return s+(parseFloat(i.PCT_RECENT)||0); },0) / cat.items.length;
    var trendUp = cat.items.filter(function(i){ return (parseFloat(i.PCT_RECENT)||0) > 30; }).length;
    var ns      = cat.items.filter(function(i){ return i.STATUS === 'NOT SELLING'; }).length;
    var scCount = Object.keys(cat.subcats).length;
    return { cat: cat, rev: rev, qty: qty, vel: vel, trendUp: trendUp, ns: ns, scCount: scCount };
  });

  catList.sort(function(a, b) {
    var dir = catOverviewSort.dir === 'asc' ? 1 : -1;
    switch (catOverviewSort.col) {
      case 'name':     return dir * a.cat.name.localeCompare(b.cat.name);
      case 'items':    return dir * (a.cat.items.length - b.cat.items.length);
      case 'subcats':  return dir * (a.scCount - b.scCount);
      case 'qty':      return dir * (a.qty - b.qty);
      case 'revenue':  return dir * (a.rev - b.rev);
      case 'vel':      return dir * (a.vel - b.vel);
      case 'trending': return dir * (a.trendUp - b.trendUp);
      case 'status':   return dir * (a.ns - b.ns);
      default:         return dir * (a.rev - b.rev);
    }
  });

  buildCatOverviewThead();

  var tbody = document.getElementById('cat-overview-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  catList.forEach(function(entry) {
    var cat      = entry.cat;
    var velCls   = entry.vel > 30 ? 'vel-up' : entry.vel < 20 ? 'vel-down' : 'vel-ss';
    var velArrow = entry.vel > 30 ? '↑' : entry.vel < 20 ? '↓' : '→';
    var stsHtml  = entry.ns > 0
      ? '<span class="status-pill sts-ns">' + entry.ns + ' not selling</span>'
      : '<span class="status-pill sts-active">all active</span>';

    var tr = document.createElement('tr');
    tr.onclick = (function(n){ return function(){ showCategoryDetail(n); }; })(cat.name);
    tr.innerHTML =
      '<td><a class="cat-link" href="#" data-cat="' + cat.name + '" onclick="showCategoryDetail(this.dataset.cat); return false;">' + cat.name + '</a></td>' +
      '<td class="num">' + cat.items.length.toLocaleString() + '</td>' +
      '<td class="num">' + entry.scCount + '</td>' +
      '<td class="num">' + Math.round(entry.qty).toLocaleString() + '</td>' +
      '<td class="num">' + fmtAmt(entry.rev) + '</td>' +
      '<td class="num"><span class="' + velCls + '">' + velArrow + '</span> ' + entry.vel.toFixed(1) + '%</td>' +
      '<td>' + entry.trendUp + ' of ' + cat.items.length + '</td>' +
      '<td>' + stsHtml + '</td>';
    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────────────────
// CATEGORY DRILL-DOWN: show sub-categories
// ─────────────────────────────────────────────────────────
function showCatOverview() {
  catState.selectedCat    = null;
  catState.selectedSubcat = null;
  renderCategoryOverview();
  var o = document.getElementById('cat-overview-section');
  var s = document.getElementById('subcat-section');
  var i = document.getElementById('items-section');
  if (o) o.style.display = '';
  if (s) s.style.display = 'none';
  if (i) i.style.display = 'none';
  location.hash = 'category';
}

// Rebuild sortable subcat table header based on current sort state
function buildSubcatThead() {
  var thead = document.getElementById('subcat-thead');
  if (!thead) return;
  var cols = [
    { key: 'name',    label: 'Sub-Category',  cls: '' },
    { key: 'items',   label: 'Items',          cls: 'num' },
    { key: 'qty',     label: '90D Qty',        cls: 'num' },
    { key: 'revenue', label: '90D Revenue',    cls: 'num' },
    { key: 'pctcat',  label: '% of Cat Rev',   cls: 'num' },
    { key: 'avgz',    label: 'Avg Z-Score',    cls: 'num' },
    { key: 'normal',  label: 'Normality',      cls: '' },
    { key: '_exp',    label: '',               cls: 'acc-toggle-cell' }
  ];
  var tr = document.createElement('tr');
  cols.forEach(function(col) {
    var th = document.createElement('th');
    if (col.cls) th.className = col.cls;
    if (col.key !== '_exp' && col.key !== 'normal') {
      var isActive = subcatSortState.col === col.key;
      th.className += ' sort-th' + (isActive ? ' sort-active' : '');
      var icon = isActive ? (subcatSortState.dir === 'asc' ? '▲' : '▼') : '↕';
      th.innerHTML = col.label + '<span class="sort-icon">' + icon + '</span>';
      th.dataset.col = col.key;
      th.onclick = (function(k){ return function(){ sortSubcatBy(k); }; })(col.key);
    } else {
      th.textContent = col.label;
    }
    tr.appendChild(th);
  });
  thead.innerHTML = '';
  thead.appendChild(tr);
}

function sortSubcatBy(col) {
  if (subcatSortState.col === col) {
    subcatSortState.dir = subcatSortState.dir === 'desc' ? 'asc' : 'desc';
  } else {
    subcatSortState.col = col;
    subcatSortState.dir = (col === 'name') ? 'asc' : 'desc';
  }
  showCategoryDetail(catState.selectedCat);
}

function showCategoryDetail(catName) {
  if (!pipelineData.length) return;
  catState.selectedCat    = catName;
  catState.selectedSubcat = null;

  var cats = buildCategoryMap();
  var cat  = cats[catName];
  if (!cat) return;

  var catTotalRev = cat.items.reduce(function(s,i){ return s+(parseFloat(i.RAW_AMT_90D)||0); },0);

  var el = document.getElementById('subcat-heading');
  if (el) el.textContent = catName + ' — Sub-Categories (' + Object.keys(cat.subcats).length + ')';

  buildSubcatThead();

  // Build subcat list with pre-computed aggregates
  var subcatList = Object.keys(cat.subcats).map(function(sc) {
    var its = cat.subcats[sc];
    var rev = its.reduce(function(s,i){ return s+(parseFloat(i.RAW_AMT_90D)||0); },0);
    var qty = its.reduce(function(s,i){ return s+(parseFloat(i.RAW_QTY_90D)||0); },0);
    var zIt = its.filter(function(i){ return !isNaN(parseFloat(i.Z_SCORE)); });
    var avgZ = zIt.length > 0
      ? zIt.reduce(function(s,i){ return s+parseFloat(i.Z_SCORE); },0) / zIt.length
      : null;
    return { name: sc, items: its, rev: rev, qty: qty, avgZ: avgZ };
  });

  subcatList.sort(function(a, b) {
    var dir = subcatSortState.dir === 'asc' ? 1 : -1;
    switch (subcatSortState.col) {
      case 'name':   return dir * a.name.localeCompare(b.name);
      case 'items':  return dir * (a.items.length - b.items.length);
      case 'qty':    return dir * (a.qty - b.qty);
      case 'pctcat':
      case 'revenue':return dir * (a.rev - b.rev);
      case 'avgz':   return dir * ((a.avgZ||0) - (b.avgZ||0));
      default:       return dir * (a.rev - b.rev);
    }
  });

  var tbody = document.getElementById('subcat-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  subcatList.forEach(function(sc, idx) {
    var isTop3   = idx < 3;
    var scPctNum = catTotalRev > 0 ? (sc.rev / catTotalRev * 100) : 0;
    var scPct    = scPctNum.toFixed(1);
    var barW     = Math.min(100, Math.round(scPctNum));
    var avgZStr  = sc.avgZ !== null ? sc.avgZ.toFixed(2) : '—';
    var normKey  = catName + '|' + sc.name;
    var norm     = normalityMap[normKey];
    var isNormal = norm && norm.NORMAL === 'Yes';
    var normBadge = isNormal
      ? '<span class="norm-badge norm-yes">Normal</span>'
      : '<span class="norm-badge norm-no">Non-Normal</span>';
    var safeId   = sc.name.replace(/[^a-zA-Z0-9]/g, '_');

    // Main sub-category row
    var tr = document.createElement('tr');
    tr.className = 'subcat-row' + (isTop3 ? ' subcat-top' : '');
    tr.onclick = (function(sid){ return function(){ toggleSubcatAccordion(sid); }; })(safeId);
    tr.innerHTML =
      '<td><strong>' + sc.name + '</strong></td>' +
      '<td class="num">' + sc.items.length + '</td>' +
      '<td class="num">' + Math.round(sc.qty).toLocaleString() + '</td>' +
      '<td class="num">' + fmtAmt(sc.rev) + '</td>' +
      '<td class="num">' +
        '<div class="sc-pct-wrap">' +
          '<span>' + scPct + '%</span>' +
          '<div class="sc-bar-wrap"><div class="sc-bar-fill" style="width:' + barW + '%"></div></div>' +
        '</div>' +
      '</td>' +
      '<td class="num">' + avgZStr + '</td>' +
      '<td>' + normBadge + '</td>' +
      '<td class="acc-toggle-cell"><span class="acc-toggle-btn" id="acc-btn-' + safeId + '">►</span></td>';
    tbody.appendChild(tr);

    // Accordion expansion row (lazy-built on first open)
    var accTr = document.createElement('tr');
    accTr.className = 'acc-expand-row';
    accTr.id = 'acc-row-' + safeId;
    accTr.style.display = 'none';
    var accTd = document.createElement('td');
    accTd.colSpan = 8;
    var accDiv = document.createElement('div');
    accDiv.className = 'acc-content';
    accDiv.id = 'acc-content-' + safeId;
    accDiv.dataset.subcatName = sc.name;
    accDiv.dataset.built = '';
    accTd.appendChild(accDiv);
    accTr.appendChild(accTd);
    tbody.appendChild(accTr);
  });

  var o = document.getElementById('cat-overview-section');
  var s = document.getElementById('subcat-section');
  var i = document.getElementById('items-section');
  if (o) o.style.display = 'none';
  if (s) s.style.display = '';
  if (i) i.style.display = 'none';
  location.hash = 'category/' + catName;
}

// ─────────────────────────────────────────────────────────
// ACCORDION: toggle + lazy-build items table inside a sub-category row
// ─────────────────────────────────────────────────────────
function toggleSubcatAccordion(safeId) {
  var row     = document.getElementById('acc-row-' + safeId);
  var btn     = document.getElementById('acc-btn-' + safeId);
  var content = document.getElementById('acc-content-' + safeId);
  if (!row) return;

  var isOpen = row.style.display !== 'none';
  if (isOpen) {
    row.style.display = 'none';
    if (btn) { btn.innerHTML = '►'; btn.classList.remove('open'); }
  } else {
    row.style.display = '';
    if (btn) { btn.innerHTML = '▼'; btn.classList.add('open'); }
    if (content && !content.dataset.built) {
      content.dataset.built = '1';
      buildAccordionItems(content, catState.selectedCat, content.dataset.subcatName, 'rank', 'asc');
    }
  }
}

function buildAccordionItems(container, catName, subcatName, sortCol, sortDir) {
  var allItems = pipelineData.filter(function(i){
    return i.CATEG_COD === catName && i.SUBCAT_COD === subcatName;
  });

  // Pre-compute percentiles (avoids calling computePercentile inside sort comparator)
  var withPct = allItems.map(function(item) {
    return { item: item, pct: computePercentile(item, pipelineData, normalityMap).pct };
  });

  withPct.sort(function(a, b) {
    var d = sortDir === 'asc' ? 1 : -1;
    var ai = a.item, bi = b.item;
    switch (sortCol) {
      case 'rank':      return d * ((parseInt(ai.SUBCAT_RANK)||999) - (parseInt(bi.SUBCAT_RANK)||999));
      case 'item_no':   return d * String(ai.ITEM_NO||'').localeCompare(String(bi.ITEM_NO||''));
      case 'item_name': return d * (ai.ITEM_NAME||'').localeCompare(bi.ITEM_NAME||'');
      case 'qty90':     return d * ((parseFloat(ai.RAW_QTY_90D)||0) - (parseFloat(bi.RAW_QTY_90D)||0));
      case 'rev90':     return d * ((parseFloat(ai.RAW_AMT_90D)||0) - (parseFloat(bi.RAW_AMT_90D)||0));
      case 'zscore':    return d * ((parseFloat(ai.Z_SCORE)||0) - (parseFloat(bi.Z_SCORE)||0));
      case 'pct':       return d * (a.pct - b.pct);
      default:          return d * ((parseInt(ai.SUBCAT_RANK)||999) - (parseInt(bi.SUBCAT_RANK)||999));
    }
  });

  function sIcon(col) {
    if (sortCol !== col) return '<span class="sort-icon">↕</span>';
    return '<span class="sort-icon">' + (sortDir === 'asc' ? '▲' : '▼') + '</span>';
  }
  function thCls(col) { return 'sort-th' + (sortCol === col ? ' sort-active' : ''); }

  var rows = withPct.map(function(entry) {
    var item   = entry.item;
    var pctVal = entry.pct;
    var topPct = Math.round((100 - pctVal) * 10) / 10;
    var pctCls = pctVal >= 75 ? 'pct-green' : pctVal >= 25 ? 'pct-yellow' : 'pct-red';
    var qty90  = parseFloat(item.RAW_QTY_90D) || 0;
    var amt90  = parseFloat(item.RAW_AMT_90D) || 0;
    var status = (item.STATUS || '').trim();
    var stsCls = status === 'ACTIVE' ? 'sts-active' : status === 'OUT OF STOCK' ? 'sts-oos' : 'sts-ns';
    var zVal   = !isNaN(parseFloat(item.Z_SCORE)) ? parseFloat(item.Z_SCORE).toFixed(2) : '—';
    var iNo    = item.ITEM_NO || '';
    var iName  = item.ITEM_NAME || '—';
    return '<tr>' +
      '<td class="num">' + (item.SUBCAT_RANK || '—') + '</td>' +
      '<td><a href="#" class="item-link" data-item="' + iNo + '" onclick="zoomToItem(this.dataset.item);return false;">' + iNo + '</a></td>' +
      '<td><a href="#" class="item-link" data-item="' + iNo + '" onclick="zoomToItem(this.dataset.item);return false;">' + iName + '</a></td>' +
      '<td class="num">' + Math.round(qty90).toLocaleString() + '</td>' +
      '<td class="num">' + fmtAmt(amt90) + '</td>' +
      '<td class="num">' + zVal + '</td>' +
      '<td class="num"><span class="pct-badge ' + pctCls + '">Top ' + topPct + '%</span></td>' +
      '<td><span class="' + stsCls + '">' + (status || '—') + '</span></td>' +
    '</tr>';
  }).join('');

  container.innerHTML =
    '<table class="items-inner-table">' +
    '<thead><tr>' +
      '<th class="num '  + thCls('rank')      + '" data-col="rank">Rank '      + sIcon('rank')      + '</th>' +
      '<th class="'      + thCls('item_no')   + '" data-col="item_no">Item # '  + sIcon('item_no')   + '</th>' +
      '<th class="'      + thCls('item_name') + '" data-col="item_name">Item Name ' + sIcon('item_name') + '</th>' +
      '<th class="num '  + thCls('qty90')     + '" data-col="qty90">90D Qty '  + sIcon('qty90')     + '</th>' +
      '<th class="num '  + thCls('rev90')     + '" data-col="rev90">90D Rev '  + sIcon('rev90')     + '</th>' +
      '<th class="num '  + thCls('zscore')    + '" data-col="zscore">Z-Score ' + sIcon('zscore')    + '</th>' +
      '<th class="num '  + thCls('pct')       + '" data-col="pct">Percentile ' + sIcon('pct')       + '</th>' +
      '<th>Status</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>';

  // Wire up sort click handlers after DOM insertion
  container.querySelectorAll('th.sort-th').forEach(function(th) {
    th.onclick = function() {
      var col = th.dataset.col;
      var newDir;
      if (sortCol === col) {
        newDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        newDir = (col === 'rank' || col === 'item_no' || col === 'item_name') ? 'asc' : 'desc';
      }
      container.dataset.built = '1';
      buildAccordionItems(container, catName, subcatName, col, newDir);
    };
  });
}

// ─────────────────────────────────────────────────────────
// CATEGORY NAV: back to sub-category table
// ─────────────────────────────────────────────────────────
function showSubcatDetail() {
  catState.selectedSubcat = null;
  showCategoryDetail(catState.selectedCat);
}

// showSubcatItems: navigate to sub-category table view and open the named accordion
function showSubcatItems(subcatName) {
  if (!pipelineData.length) return;
  // If subcat detail isn't visible, render it first
  var subcatSection = document.getElementById('subcat-section');
  if (!subcatSection || subcatSection.style.display === 'none') {
    showCategoryDetail(catState.selectedCat);
  }
  catState.selectedSubcat = subcatName;
  var safeId = subcatName.replace(/[^a-zA-Z0-9]/g, '_');
  var row = document.getElementById('acc-row-' + safeId);
  if (row && row.style.display === 'none') {
    toggleSubcatAccordion(safeId);
  }
  location.hash = 'category/' + catState.selectedCat + '/' + subcatName;
