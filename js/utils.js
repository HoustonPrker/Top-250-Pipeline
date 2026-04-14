// ============================================================
// UTILS — Formatting helpers and DOM helpers
// ============================================================

function fmt$(v) {
  return '$' + (parseFloat(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(v) {
  return Math.round(parseFloat(v) || 0).toLocaleString('en-US');
}

function fmtRevMM(v) {
  const n = parseFloat(v) || 0;
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + Math.round(n).toLocaleString('en-US');
}

// IDs that use flex display when shown
const _FLEX_IDS = new Set(['welcome-screen', 'loading-screen', 'file-picker', 'error-view']);

function show(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = _FLEX_IDS.has(id) ? 'flex' : 'block';
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
