// ─────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────
function doSearch(itemNo) {
  var q = (itemNo ? String(itemNo) : document.getElementById('item-search').value).trim().toUpperCase();
  if (itemNo) document.getElementById('item-search').value = q;
  if (!q) return;
  if (!pipelineData.length) { alert('Data is still loading — please wait.'); return; }
  var item = pipelineData.find(function(i){ return (i.ITEM_NO || '').trim().toUpperCase() === q; });
  if (!item) {
    document.getElementById('error-msg').textContent =
      'No item found for "' + q + '". Check the number and try again.';
    showScreen('error-screen');
    return;
  }
  renderItem(item);
}

function clearView() {
  document.getElementById('item-search').value = '';
  Object.values(activeCharts).forEach(function(c){ c.destroy(); });
  activeCharts = {};
  if (pipelineData.length) showScreen('welcome-screen');
}

// ─────────────────────────────────────────────────────────
// RENDER ITEM
// ─────────────────────────────────────────────────────────
function renderItem(item) {
  var qty90     = parseFloat(item.RAW_QTY_90D)      || 0;
  var amt90     = parseFloat(item.RAW_AMT_90D)      || 0;
  var qty12m    = parseFloat(item.RAW_QTY_12M_TOTAL) || 0;
  var amt12m    = parseFloat(item.RAW_AMT_12M_TOTAL) || 0;
  var pctRecent = parseFloat(item.PCT_RECENT)        || 0;
  var txnCount  = parseInt(item.TXN_COUNT)           || 0;
  var rankNum   = parseInt(item.SUBCAT_RANK)         || 0;
  var rankTotal = parseInt(item.SUBCAT_TOTAL)  || parseInt(item.PEER_COUNT) || 0;

  // Percentile
  var pResult    = computePercentile(item, pipelineData, normalityMap);
  var pctR       = pResult.pct;
  var method     = pResult.method;
  var topPct     = Math.round((100 - pctR) * 10) / 10;
  var topPctHdr  = rankTotal > 0 ? Math.round((1 - (rankNum - 1) / rankTotal) * 100) : 0;

  // ── Header ──
  document.getElementById('h-name').textContent   = item.ITEM_NAME || item.ITEM_NO;
  document.getElementById('h-itemno').textContent = '# ' + item.ITEM_NO;
  document.getElementById('h-rank').textContent   = 'Rank ' + rankNum + ' of ' + rankTotal + '  (top ' + topPctHdr + '%)';
  document.getElementById('h-categ').textContent  = item.CATEG_COD;
  document.getElementById('h-subcat').textContent = item.SUBCAT_COD;
  document.getElementById('h-method').textContent = item.RANK_METHOD || '—';
  document.getElementById('h-peers').textContent  = item.PEER_COUNT  || '—';

  // ── KPI: 90-day ──
  document.getElementById('k-qty90').textContent = fmtQty(qty90);
  document.getElementById('k-amt90').textContent = fmtAmt(amt90);
  document.getElementById('k-txn').textContent   = txnCount.toLocaleString() + ' transactions';

  // ── KPI: 30-day (est) ──
  document.getElementById('k-qty30').textContent = fmtQty(qty90 / 3);
  document.getElementById('k-amt30').textContent = fmtAmt(amt90 / 3);

  // ── KPI: 7-day (est) ──
  document.getElementById('k-qty7').textContent  = fmtQty(qty90 / (90 / 7));
  document.getElementById('k-amt7').textContent  = fmtAmt(amt90 / (90 / 7));

  // ── KPI: Velocity ──
  var velCls = 'vel-ss', velLbl = 'Steady';
  if (pctRecent > 30)      { velCls = 'vel-up';   velLbl = 'Trending Up ↑'; }
  else if (pctRecent < 20) { velCls = 'vel-down'; velLbl = 'Trending Down ↓'; }
  document.getElementById('k-vel').innerHTML  = '<span class="' + velCls + '">' + velLbl + '</span>';
  document.getElementById('k-pct').textContent = pctRecent.toFixed(1) + '% of 12M sales in last 90D';

  // ── KPI: Status ──
  var status = (item.STATUS || '').trim();
  var stsCls = status === 'ACTIVE' ? 'sts-active' : status === 'OUT OF STOCK' ? 'sts-oos' : 'sts-ns';
  document.getElementById('k-status').innerHTML    = '<span class="' + stsCls + '">' + (status || '—') + '</span>';
  document.getElementById('k-stock').textContent   = fmtQty(item.QTY_AVAIL_ALL_STORES) + ' units available';
  document.getElementById('k-stock-note').textContent = (item.STORES_WITH_STOCK || 0) + ' stores with stock';

  // ── Rank Strip ──
  document.getElementById('rank-main').innerHTML =
    'Sub-category rank: <strong>' + rankNum + '</strong> of <strong>' + rankTotal + '</strong>' +
    ' — <span class="rank-pct">Top ' + topPct + '%</span> of ' + item.SUBCAT_COD + ' items';
  document.getElementById('rank-method').textContent = 'Percentile method: ' + method;
  document.getElementById('rank-bar').style.width    = Math.min(100, pctR) + '%';
  document.getElementById('rank-bar-lbl').textContent = 'Top ' + topPct + '%';

  // ── Inventory Table ──
  var invBody = document.getElementById('inv-body');
  invBody.innerHTML = '';
  var aggRow = invBody.insertRow();
  aggRow.className = 'agg-row';
  var aggCols = [
    { v: 'All Stores', cls: '' },
    { v: fmtQty(item.QTY_ON_HND_ALL_STORES), cls: 'num' },
    { v: fmtQty(item.QTY_AVAIL_ALL_STORES),  cls: 'num' },
    { v: item.STORES_WITH_STOCK || '—', cls: 'num' },
    { v: fmtQty(qty12m), cls: 'num' },
    { v: fmtAmt(amt12m), cls: 'num' },
    { v: '<span class="' + stsCls + '">' + (status || '—') + '</span>', cls: '', html: true }
  ];
  aggCols.forEach(function(col) {
    var td = aggRow.insertCell();
    if (col.cls) td.className = col.cls;
    if (col.html) td.innerHTML = col.v; else td.textContent = col.v;
  });
  var noteRow = invBody.insertRow();
  noteRow.className = 'note-row';
  var ntd = noteRow.insertCell();
  ntd.colSpan = 7;
  ntd.textContent = 'Per-store detail requires IM_INV join — not yet available in this POC.';

  // ── Show & Charts ──
  document.getElementById('item-screen').dataset.loaded = 'true';
  showScreen('item-screen');
  destroyCharts();
  renderCharts(item, qty90, amt90);
}

// ─────────────────────────────────────────────────────────
// CROSS-VIEW: jump to item zoom
// ─────────────────────────────────────────────────────────
function zoomToItem(itemNo) {
  switchTab('item');
  document.getElementById('item-search').value = itemNo;
  doSearch();
  window.scrollTo(0, 0);
}
