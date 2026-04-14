// ============================================================
// DATA LOADER — Inline CSV parser + fetch/file-picker loading
// Populates globals: pipelineData, normalityMap (declared in app.js)
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

// ── File picker (fallback for file:// protocol) ──────────────

function onFileChosen() { /* no-op — files read on Load Data click */ }

function loadFromFiles() {
  var pInput = document.getElementById('fp-pipeline');
  var nInput = document.getElementById('fp-normality');
  var sInput = document.getElementById('fp-store');
  var dInput = document.getElementById('fp-daily');

  if (!pInput.files || !pInput.files[0]) { alert('Please select the Pipeline Data CSV file first.'); return; }
  if (!nInput.files || !nInput.files[0]) { alert('Please select the Normality Results CSV file first.'); return; }
  if (!sInput.files || !sInput.files[0]) { alert('Please select the Store Data CSV file first.'); return; }
  if (!dInput.files || !dInput.files[0]) { alert('Please select the Daily Sales CSV file first.'); return; }

  var results = {};

  function tryProcess() {
    if (results.pipeline !== undefined && results.normality !== undefined &&
        results.store !== undefined && results.daily !== undefined) {
      processData(results.pipeline, results.normality, results.store, results.daily);
    }
  }

  var r1 = new FileReader();
  r1.onload = function(e) { results.pipeline = e.target.result; tryProcess(); };
  r1.onerror = function() { alert('Could not read pipeline CSV.'); };
  r1.readAsText(pInput.files[0]);

  var r2 = new FileReader();
  r2.onload = function(e) { results.normality = e.target.result; tryProcess(); };
  r2.onerror = function() { alert('Could not read normality CSV.'); };
  r2.readAsText(nInput.files[0]);

  var r3 = new FileReader();
  r3.onload = function(e) { results.store = e.target.result; tryProcess(); };
  r3.onerror = function() { alert('Could not read store CSV.'); };
  r3.readAsText(sInput.files[0]);

  var r4 = new FileReader();
  r4.onload = function(e) { results.daily = e.target.result; tryProcess(); };
  r4.onerror = function() { alert('Could not read daily sales CSV.'); };
  r4.readAsText(dInput.files[0]);
}

function showFilePicker() {
  hide('loading-screen');
  show('file-picker');
}

// ── Fetch from server ────────────────────────────────────────

async function loadData() {
  hide('file-picker');
  show('loading-screen');
  document.getElementById('load-msg').textContent = 'Fetching CSV files…';
  try {
    const [pText, nText, sText, dText] = await Promise.all([
      fetch('data/CK_math_pipeline_data.csv').then(r => { if (!r.ok) throw new Error(); return r.text(); }),
      fetch('data/CK_normality_results.csv').then(r => { if (!r.ok) throw new Error(); return r.text(); }),
      fetch('data/CK_store_data.csv').then(r => { if (!r.ok) throw new Error(); return r.text(); }),
      fetch('data/CK_daily_sales.csv').then(r => { if (!r.ok) throw new Error(); return r.text(); })
    ]);
    processData(pText, nText, sText, dText);
  } catch (_) {
    showFilePicker();
  }
}

function processData(pText, nText, sText, dText) {
  hide('file-picker');
  show('loading-screen');
  document.getElementById('load-msg').textContent = 'Parsing data…';

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

      dailySalesIndex = {};
      dailySalesData.forEach(row => {
        const key = (row.ITEM_NO || '').trim();
        if (!dailySalesIndex[key]) dailySalesIndex[key] = [];
        dailySalesIndex[key].push(row);
      });

      dataReady = true;

      const subcatCount = new Set(pipelineData.map(i => `${i.CATEG_COD}|${i.SUBCAT_COD}`)).size;
      const normCount   = Object.keys(normalityMap).length;

      document.getElementById('sb-items').textContent   = `Items: ${pipelineData.length.toLocaleString()}`;
      document.getElementById('sb-subcats').textContent = `Sub-categories: ${subcatCount}`;
      document.getElementById('sb-norm').textContent    = `Normality records: ${normCount}`;
      document.getElementById('toolbar-status').textContent = `${pipelineData.length.toLocaleString()} items loaded`;
      document.getElementById('welcome-data-msg').textContent =
        `${pipelineData.length.toLocaleString()} items · ${subcatCount} sub-categories · ${normCount} normality records loaded.`;

      // Show main app then auto-load item 4000
      hide('loading-screen');
      document.getElementById('app-content').style.display = 'flex';
      doSearch('4000');

    } catch (err) {
      document.getElementById('load-msg').textContent = '❌ Error: ' + err.message;
      document.getElementById('load-msg').style.color = '#dc2626';
    }
  }, 20);
}
