// ============================================================
// STORE PERFORMANCE VIEW — Placeholder
// ============================================================

function renderStoreView() {
  document.getElementById('store-view-content').innerHTML = `
    <div class="coming-soon-wrapper">
      <div class="coming-soon-card card">
        <div class="cs-icon">🏪</div>
        <div class="cs-title">Store Performance</div>
        <div class="cs-desc">
          Per-store analytics are coming soon. This view will show how each
          Cloverkey location is performing across all inventory categories.
        </div>
        <div class="cs-features">
          <div class="cs-feature">📊 Per-store revenue and units sold</div>
          <div class="cs-feature">🏆 Store tier rankings (A / B / C)</div>
          <div class="cs-feature">📍 Location group analysis</div>
          <div class="cs-feature">⚠️ Underperforming store alerts</div>
          <div class="cs-feature">📦 Out-of-stock by store</div>
        </div>
        <div class="cs-note">
          Requires <code>IM_INV</code> join to get per-store inventory data.
        </div>
      </div>
    </div>`;
}
