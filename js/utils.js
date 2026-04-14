// ─────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────
function fmtQty(n) { return Math.round(parseFloat(n) || 0).toLocaleString(); }
function fmtAmt(n) {
  return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtRevMM(n) {
  var v = parseFloat(n) || 0;
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
  return '$' + Math.round(v).toLocaleString();
}

// ─────────────────────────────────────────────────────────
// DISPLAY HELPERS
// ─────────────────────────────────────────────────────────
function show(el) { if (el) el.style.display = ''; }
function hide(el) { if (el) el.style.display = 'none'; }
