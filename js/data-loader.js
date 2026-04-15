// ============================================================
// DATA LOADER — CSV files (written nightly by scripts/export_data.py)
// Populates globals: pipelineData, normalityMap, storeData,
//                    dailySalesData, dailySalesIndex (declared in app.js)
// ============================================================

// Minimal CSV parser (handles quotes, commas in values, BOM)
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

// ── Main load ─────────────────────────────────────────────────

async function loadData() {
  hide('file-picker');
  show('loading-screen');
  setLoadMsg('Fetching CSV files…');
  setLoadProgress(0);

  try {
    const [pRes, nRes, sRes, dRes] = await Promise.all([
      fetch('data/CK_math_pipeline_data.csv'),
      fetch('data/CK_normality_results.csv'),
      fetch('data/CK_store_data.csv'),
      fetch('data/CK_daily_sales.csv'),
    ]);

    if (!pRes.ok) throw new Error('Could not load CK_math_pipeline_data.csv');
    if (!nRes.ok) throw new Error('Could not load CK_normality_results.csv');
    if (!sRes.ok) throw new Error('Could not load CK_store_data.csv');
    if (!dRes.ok) throw new Error('Could not load CK_daily_sales.csv');

    setLoadMsg('Parsing data…');
    setLoadProgress(40);

    const [pText, nText, sText, dText] = await Promise.all([
      pRes.text(), nRes.text(), sRes.text(), dRes.text()
    ]);

    setLoadProgress(60);
    processData(pText, nText, sText, dText);

  } catch (err) {
    setLoadMsg('❌ ' + err.message);
    const el = document.getElementById('load-msg');
    if (el) el.style.color = '#dc2626';
    console.error(err);
  }
}

function processData(pText, nText, sText, dText) {
  setLoadMsg('Parsing data…');
  setLoadProgress(70);

  setTimeout(() => {
    try {
      pipelineData = Papa.parse(pText, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/^\uFEFF/, '')
      }).data;

      Papa.parse(nText, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/^\uFEFF/, '')
      }).data.forEach(r => {
        normalityMap[`${r.CATEG_COD}|${r.SUBCAT_COD}`] = r;
      });

      storeData = Papa.parse(sText, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/^\uFEFF/, '')
      }).data;

      dailySalesData = Papa.parse(dText, {
        header: true, skipEmptyLines: true,
        transformHeader: h => h.trim().replace(/^\uFEFF/, '')
      }).data;

      // Build daily sales index keyed by ITEM_NO
      dailySalesIndex = {};
      dailySalesData.forEach(row => {
        const key = (row.ITEM_NO || '').trim();
        if (!dailySalesIndex[key]) dailySalesIndex[key] = [];
        dailySalesIndex[key].push(row);
      });

      setLoadProgress(100);
      dataReady = true;

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
  }, 20);
}
