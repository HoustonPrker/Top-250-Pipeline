// ============================================================
// DATA LOADER — API + CSV fallback
// Populates globals: pipelineData, normalityMap, storeData
// (declared in app.js)
// ============================================================

const API_BASE = 'http://172.16.20.185:8085';
const API_KEY  = '26G3t29ecBtvmGpbKOoVnql34eNYfUoy';

// ── API helpers ───────────────────────────────────────────────

async function apiGet(path) {
  const r = await fetch(API_BASE + path, {
    headers: { 'X-Api-Key': API_KEY }
  });
  if (!r.ok) throw new Error(`API ${r.status} — ${path}`);
  return r.json();
}

// Fetch all rows from a /tables/ view, loading pages in parallel
// batches of 10 for speed. Calls onProgress(loaded, total) each batch.
async function fetchTableAll(viewName, onProgress) {
  const first = await apiGet(
    `/api/v1/tables/${viewName}/rows?pageSize=200&compact=true&page=1`
  );
  const env        = first.data;
  const total      = env.totalCount   || 0;
  const totalPages = env.totalPages   || 1;
  const rows       = [...(env.data    || [])];

  if (onProgress) onProgress(rows.length, total);
  if (!env.hasNextPage) return rows;

  // Fetch remaining pages in parallel batches of 10
  const BATCH_SIZE = 10;
  for (let start = 2; start <= totalPages; start += BATCH_SIZE) {
    const pageNums = [];
    for (let p = start; p < start + BATCH_SIZE && p <= totalPages; p++) {
      pageNums.push(p);
    }
    const results = await Promise.all(
      pageNums.map(p =>
        apiGet(`/api/v1/tables/${viewName}/rows?pageSize=200&compact=true&page=${p}`)
      )
    );
    results.forEach(r => rows.push(...(r.data?.data || [])));
    if (onProgress) onProgress(rows.length, total);
  }

  return rows;
}

// ── Minimal CSV parser (handles quotes, commas, BOM) ─────────

var Papa = {
  parse: function(text, opts) {
    text = text.replace(/^\uFEFF/, '');
    var lines = text.split(/\r?\n/);
    var headers = null;
    var data = [];
    var transformHeader = (opts && opts.transformHeader) || function(h) { return h; };
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) { if (opts && opts.skipEmptyLines) continue; }
      var row = Papa._parseRow(line);
      if (!headers) { headers = row.map(transformHeader); }
      else {
        var obj = {};
        for (var j = 0; j < headers.length; j++) obj[headers[j]] = row[j] !== undefined ? row[j] : '';
        data.push(obj);
      }
    }
    return { data: data };
  },
  _parseRow: function(line) {
    var result = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
      else cur += c;
    }
    result.push(cur);
    return result;
  }
};

// ── Progress UI helpers ───────────────────────────────────────

function setLoadMsg(msg) {
  const el = document.getElementById('load-msg');
  if (el) el.textContent = msg;
}

function setLoadProgress(pct) {
  const bar = document.querySelector('.load-bar-inner');
  if (bar) bar.style.width = Math.min(100, Math.round(pct)) + '%';
}

// ── Boot: load everything ─────────────────────────────────────

async function loadData() {
  hide('file-picker');
  show('loading-screen');
  setLoadMsg('Connecting to API…');
  setLoadProgress(0);

  try {
    // ── 1. Pipeline data from API ─────────────────────────────
    setLoadMsg('Loading pipeline data…');
    const pipelineRows = await fetchTableAll('USER_VI_CK_Pipeline', (loaded, total) => {
      const pct = total > 0 ? (loaded / total) * 70 : 0;
      setLoadProgress(pct);
      setLoadMsg(`Loading pipeline data… ${loaded.toLocaleString()} / ${total.toLocaleString()} items`);
    });
    pipelineData = pipelineRows;
    setLoadProgress(70);

    // ── 2. Store data from CSV ────────────────────────────────
    setLoadMsg('Loading store data…');
    let sText = '';
    try {
      const sr = await fetch('data/CK_store_data.csv');
      if (sr.ok) sText = await sr.text();
    } catch (_) {}

    if (sText) {
      storeData = Papa.parse(sText, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/^\uFEFF/, '')
      }).data;
    }
    setLoadProgress(80);

    // ── 3. Normality results from CSV ─────────────────────────
    setLoadMsg('Loading normality data…');
    try {
      const nr = await fetch('data/CK_normality_results.csv');
      if (nr.ok) {
        const nText = await nr.text();
        Papa.parse(nText, {
          header: true, skipEmptyLines: true,
          transformHeader: h => h.trim().replace(/^\uFEFF/, '')
        }).data.forEach(r => {
          normalityMap[`${r.CATEG_COD}|${r.SUBCAT_COD}`] = r;
        });
      }
    } catch (_) {}
    setLoadProgress(90);

    // ── 4. Finalize ───────────────────────────────────────────
    dataReady = true;
    setLoadProgress(100);

    const subcatCount = new Set(
      pipelineData.map(i => `${i.CATEG_COD}|${i.SUBCAT_COD}`)
    ).size;

    const ts = new Date().toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
    document.getElementById('dash-footer-ts').textContent   = `Data as of ${ts}`;
    document.getElementById('toolbar-status').textContent   = `${pipelineData.length.toLocaleString()} items loaded`;
    document.getElementById('welcome-data-msg').textContent =
      `${pipelineData.length.toLocaleString()} items · ${subcatCount} sub-categories loaded.`;

    hide('loading-screen');
    document.getElementById('app-content').style.display = 'flex';
    doSearch('4000');

  } catch (err) {
    setLoadMsg('❌ Error: ' + err.message);
    const el = document.getElementById('load-msg');
    if (el) el.style.color = '#dc2626';
    console.error(err);
  }
}

// ── On-demand daily sales fetch (called before rendering an item) ─

async function fetchDailySalesForItem(itemNo) {
  const key = (itemNo || '').trim();
  if (dailySalesIndex[key]) return; // already cached

  try {
    // Item 4000 has 90 rows max — always fits in pageSize=200
    const json = await apiGet(
      `/api/v1/tables/USER_VI_CK_DailySales/rows?pageSize=200&compact=true&filter=ITEM_NO:eq:${encodeURIComponent(key)}`
    );
    const rows = json.data?.data || [];

    // Normalize API fields to match what getDailySalesForItem expects
    dailySalesIndex[key] = rows.map(r => ({
      SALE_DATE:  (r.POST_DATE || '').slice(0, 10),
      DAILY_QTY:  r.QTY_SOLD ?? 0,
      DAILY_AMT:  r.EXT_PRC  ?? 0
    }));
  } catch (_) {
    // If fetch fails, store empty array so we don't retry on every render
    dailySalesIndex[key] = [];
  }
}
