// ============================================================
// ITEM ZOOM VIEW
// Uses globals: pipelineData, normalityMap, dataReady, activeCharts
// ============================================================

function doSearch(prefill) {
  if (prefill !== undefined) document.getElementById('item-search').value = prefill;
  const q = document.getElementById('item-search').value.trim().toUpperCase();
  if (!q) return;
  if (!dataReady) { alert('Data is still loading — please wait.'); return; }

  // Always switch to Item Zoom tab before showing the result
  switchTab('item');

  const item = pipelineData.find(i => (i.ITEM_NO || '').trim().toUpperCase() === q);

  hide('welcome-screen'); hide('item-view'); hide('error-view');

  if (!item) {
    document.getElementById('error-msg').textContent =
      `No item found for item number "${q}". Check the number and try again.`;
    show('error-view');
    return;
  }

  renderItem(item);
}

function clearView() {
  document.getElementById('item-search').value = '';
  hide('item-view'); hide('error-view');
  destroyCharts();
  show('welcome-screen');
  document.getElementById('item-search').focus();
}

function renderItem(item) {
  destroyCharts();

  const { pct } = computePercentile(item);
  const pctR = Math.round(pct * 10) / 10;

  show('item-view');

  // ── HEADER ──────────────────────────────────────────────────
  document.getElementById('h-name').textContent   = item.ITEM_NAME || '—';
  document.getElementById('h-itemno').textContent = `#${item.ITEM_NO}`;
  document.getElementById('h-categ').textContent  = item.CATEG_COD || '—';
  document.getElementById('h-subcat').textContent = item.SUBCAT_COD || '—';
  document.getElementById('h-method').textContent = item.RANK_METHOD || '—';
  document.getElementById('h-peers').textContent  = item.PEER_COUNT || '—';

  const rankNum   = parseInt(item.SUBCAT_RANK)  || 0;
  const rankTotal = parseInt(item.SUBCAT_TOTAL) || parseInt(item.PEER_COUNT) || 0;
  const topPct    = rankTotal > 0 ? Math.round((1 - (rankNum - 1) / rankTotal) * 100) : 0;
  document.getElementById('h-rank').textContent = `Rank ${rankNum} of ${rankTotal} · Top ${topPct}%`;

  // ── KPI CARDS ───────────────────────────────────────────────
  const qty90 = parseFloat(item.RAW_QTY_90D) || 0;
  const amt90 = parseFloat(item.RAW_AMT_90D) || 0;

  document.getElementById('k-qty90').textContent = fmtQty(qty90);
  document.getElementById('k-amt90').textContent = fmt$(amt90);

  document.getElementById('k-qty30').textContent = fmtQty(qty90 / 3);
  document.getElementById('k-amt30').textContent = fmt$(amt90 / 3);

  document.getElementById('k-qty7').textContent  = fmtQty(qty90 * 7 / 90);
  document.getElementById('k-amt7').textContent  = fmt$(amt90 * 7 / 90);

  // Velocity — PCT_RECENT is already a percentage (26.6 = 26.6%)
  const pctRecent = parseFloat(item.PCT_RECENT) || 0;
  let velLabel, velClass, velArrow;
  if      (pctRecent >= 30) { velLabel = 'Trending Up';   velClass = 'vel-up';   velArrow = '↑'; }
  else if (pctRecent <  20) { velLabel = 'Trending Down'; velClass = 'vel-down'; velArrow = '↓'; }
  else                      { velLabel = 'Steady';        velClass = 'vel-ss';   velArrow = '→'; }
  document.getElementById('k-vel').innerHTML =
    `<span class="${velClass}" style="font-size:28px;line-height:1">${velArrow}</span>&nbsp;<span class="${velClass}" style="font-size:15px">${velLabel}</span>`;
  document.getElementById('k-pct').textContent = `${pctRecent}% of 12M in last 90 days`;

  // Status
  const status = (item.STATUS || '').trim().toUpperCase();
  const [stsCls, stsLbl] =
    status === 'ACTIVE'       ? ['sts-active', '● ACTIVE']       :
    status === 'OUT OF STOCK' ? ['sts-oos',    '● OUT OF STOCK'] :
                                ['sts-ns',     '● NOT SELLING'];
  document.getElementById('k-status').innerHTML =
    `<span class="${stsCls}" style="font-size:14px">${stsLbl}</span>`;
  document.getElementById('k-stock').textContent =
    `${fmtQty(item.QTY_AVAIL_ALL_STORES)} units available`;

  // ── RANK STRIP ───────────────────────────────────────────────
  const topPctStrip = Math.round((100 - pctR) * 10) / 10;
  document.getElementById('rank-main').innerHTML =
    `Sub-category rank: <strong>${rankNum}</strong> of <strong>${rankTotal}</strong>`
    + ` — <span class="rank-pct">Top ${topPctStrip}%</span> of ${item.SUBCAT_COD} items`;
  document.getElementById('rank-bar').style.width     = `${Math.min(100, pctR)}%`;
  document.getElementById('rank-bar-lbl').textContent = `Top ${topPctStrip}%`;

  // ── CHARTS ──────────────────────────────────────────────────
  renderCharts(item, qty90, amt90);

  // ── INVENTORY TABLE ──────────────────────────────────────────
  const tbody = document.getElementById('inv-body');
  tbody.innerHTML = '';

  const aggRow = tbody.insertRow();
  aggRow.className = 'agg-row';
  const qtyOH = parseFloat(item.QTY_ON_HND_ALL_STORES) || 0;
  const qtyAv = parseFloat(item.QTY_AVAIL_ALL_STORES)  || 0;
  const stksN = parseInt(item.STORES_WITH_STOCK)        || 0;
  const q12m  = parseFloat(item.RAW_QTY_12M_TOTAL)      || 0;
  const a12m  = parseFloat(item.RAW_AMT_12M_TOTAL)      || 0;
  aggRow.innerHTML = `
    <td>ALL STORES (Aggregate)</td>
    <td class="num">${fmtQty(qtyOH)}</td>
    <td class="num">${fmtQty(qtyAv)}</td>
    <td class="num">${stksN}</td>
    <td class="num">${fmtQty(q12m)}</td>
    <td class="num">${fmt$(a12m)}</td>
    <td>${item.STATUS || '—'}</td>`;

  const noteRow = tbody.insertRow();
  noteRow.className = 'note-row';
  noteRow.innerHTML = `<td colspan="7" style="cursor:default">
    ℹ Per-store detail requires IM_INV join (not available in POC dataset).
    QTY_ON_HND and QTY_AVAIL are aggregated across all stores in the pipeline query.
  </td>`;
}
