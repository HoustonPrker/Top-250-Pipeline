// ============================================================
// APP — Global state, init, tab switching, event listeners
// Loads LAST — all other modules must be loaded first
// ============================================================

let pipelineData = [];
let normalityMap = {};
let dataReady    = false;
let activeCharts = {};
let activeTab    = 'item';

// ── Tab switching ─────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;

  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tab-btn-' + tab);
  if (btn) btn.classList.add('active');

  ['item', 'category', 'store'].forEach(t => {
    const panel = document.getElementById('tab-' + t);
    if (panel) panel.style.display = t === tab ? 'flex' : 'none';
  });

  if (tab === 'category' && dataReady) renderCategoryView();
  if (tab === 'store'    && dataReady) renderStoreView();
}

// ── Event listeners ───────────────────────────────────────────

document.getElementById('item-search').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

// ── Boot ──────────────────────────────────────────────────────

loadData();
