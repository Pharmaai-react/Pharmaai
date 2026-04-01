import { useState } from 'react';

// ─── CSV / download utilities ─────────────────────────────────────────────────

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowToCSV(row) {
  return row.map(escapeCSV).join(',');
}

function downloadCSV(filename, headers, rows) {
  const lines = [headers, ...rows].map(rowToCSV).join('\n');
  const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

function today() { return new Date().toISOString().split('T')[0]; }

function fmtDate(d) {
  if (!d) return 'N/A';
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

function daysUntil(d) {
  if (!d) return '—';
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

// ─── Report builders ─────────────────────────────────────────────────────────

function buildInventoryReport(inventoryData) {
  const headers = ['Name', 'Category', 'Quantity', 'Unit', 'Price (₹)', 'Stock %', 'Status', 'Expiry Date', 'Days Until Expiry', 'Total Value (₹)'];
  const rows = inventoryData.map(item => [
    item.name,
    item.category,
    item.quantity,
    item.unit || 'Unit',
    (item.price || 0).toFixed(2),
    item.stock,
    item.status,
    fmtDate(item.expiry),
    daysUntil(item.expiry),
    ((item.price || 0) * item.quantity).toFixed(2),
  ]);
  return { headers, rows };
}

function buildExpiryReport(inventoryData) {
  const headers = ['Name', 'Category', 'Quantity', 'Expiry Date', 'Days Until Expiry', 'Status', 'Risk Level'];
  const now = new Date();
  const sorted = [...inventoryData]
    .filter(i => i.expiry)
    .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
  const rows = sorted.map(item => {
    const days = Math.ceil((new Date(item.expiry) - now) / 86400000);
    const risk = days < 0 ? 'EXPIRED' : days <= 30 ? 'HIGH' : days <= 60 ? 'MEDIUM' : 'LOW';
    return [item.name, item.category, item.quantity, fmtDate(item.expiry), days, item.status, risk];
  });
  return { headers, rows };
}

function buildLowStockReport(inventoryData) {
  const headers = ['Name', 'Category', 'Current Quantity', 'Stock %', 'Status', 'Price (₹)', 'Estimated Reorder Value (₹)'];
  const rows = inventoryData
    .filter(i => i.status === 'critical' || i.status === 'low-stock')
    .sort((a, b) => a.stock - b.stock)
    .map(item => {
      // Estimate reorder as bringing stock target of 500 units
      const reorderQty = Math.max(0, 500 - item.quantity);
      return [
        item.name, item.category, item.quantity, item.stock + '%',
        item.status, (item.price || 0).toFixed(2),
        ((item.price || 0) * reorderQty).toFixed(2),
      ];
    });
  return { headers, rows };
}

function buildValuationReport(inventoryData) {
  const headers = ['Category', 'Items', 'Total Units', 'Total Value (₹)', 'Avg Stock %'];
  const byCategory = {};
  inventoryData.forEach(item => {
    if (!byCategory[item.category]) byCategory[item.category] = { items: 0, units: 0, value: 0, stockSum: 0 };
    byCategory[item.category].items++;
    byCategory[item.category].units += item.quantity;
    byCategory[item.category].value += (item.price || 0) * item.quantity;
    byCategory[item.category].stockSum += item.stock;
  });
  const rows = Object.entries(byCategory)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([cat, d]) => [
      cat, d.items, d.units.toLocaleString('en-IN'),
      d.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      Math.round(d.stockSum / d.items) + '%',
    ]);
  return { headers, rows };
}

function buildSummaryJSON(inventoryData) {
  const totalValue = inventoryData.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
  const byStatus = {};
  inventoryData.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
  const expiringSoon = inventoryData.filter(i => {
    const d = daysUntil(i.expiry);
    return typeof d === 'number' && d >= 0 && d <= 60;
  });
  return {
    generatedAt: new Date().toISOString(),
    totalMedications: inventoryData.length,
    totalInventoryValue: '₹' + totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    byStatus,
    expiringSoon: expiringSoon.map(i => ({ name: i.name, expiry: i.expiry, daysLeft: daysUntil(i.expiry), quantity: i.quantity })),
    topValueItems: [...inventoryData]
      .sort((a, b) => (b.price || 0) * b.quantity - (a.price || 0) * a.quantity)
      .slice(0, 5)
      .map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.price, totalValue: ((i.price || 0) * i.quantity).toFixed(2) })),
  };
}

// ─── Report definitions ───────────────────────────────────────────────────────

const REPORTS = [
  {
    id: 'inventory',
    bg: '#dbeafe', color: '#3b82f6',
    title: 'Full Inventory Report',
    desc: 'Complete list of all medications with quantities, prices, expiry dates, and stock levels.',
    meta: '📅 Live data · CSV',
    format: 'CSV',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    id: 'expiry',
    bg: '#ede9fe', color: '#8b5cf6',
    title: 'Expiry & Wastage Report',
    desc: 'All medications sorted by expiry date — highlights expired, high-risk, and safe batches.',
    meta: '📅 Live data · CSV',
    format: 'CSV',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
  {
    id: 'lowstock',
    bg: '#fee2e2', color: '#ef4444',
    title: 'Low Stock & Reorder Report',
    desc: 'All critical and low-stock items with estimated reorder quantities and values.',
    meta: '📅 Live data · CSV',
    format: 'CSV',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    id: 'valuation',
    bg: '#ccfbf1', color: '#0d9488',
    title: 'Inventory Valuation by Category',
    desc: 'Total inventory value broken down by drug category, for financial reporting.',
    meta: '📅 Live data · CSV',
    format: 'CSV',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  },
  {
    id: 'summary',
    bg: '#fef3c7', color: '#f59e0b',
    title: 'Inventory Summary (JSON)',
    desc: 'Machine-readable JSON snapshot — total value, status breakdown, top items, expiry alerts.',
    meta: '📅 Live data · JSON',
    format: 'JSON',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  },
  {
    id: 'all',
    bg: '#f0fdfa', color: '#0d9488',
    title: 'Export All Reports',
    desc: 'Download all 4 CSV reports + the JSON summary in one click.',
    meta: '📅 Live data · CSV + JSON',
    format: 'ALL',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsPage({ inventoryData = [], showNotification }) {
  const [downloading, setDownloading] = useState(null);

  const runDownload = (id) => {
    if (!inventoryData.length) {
      showNotification('⚠️ No inventory data found — add medications first');
      return;
    }
    setDownloading(id);
    setTimeout(() => {
      try {
        const prefix = `pharmaai_${today()}`;

        const dl = (reportId) => {
          const { headers, rows } = buildReport(reportId, inventoryData);
          downloadCSV(`${prefix}_${reportId}.csv`, headers, rows);
        };

        if (id === 'summary') {
          downloadJSON(`${prefix}_summary.json`, buildSummaryJSON(inventoryData));
          showNotification('✅ Summary JSON downloaded!');
        } else if (id === 'all') {
          ['inventory', 'expiry', 'lowstock', 'valuation'].forEach(rId => dl(rId));
          downloadJSON(`${prefix}_summary.json`, buildSummaryJSON(inventoryData));
          showNotification('✅ All 5 reports downloaded!');
        } else {
          dl(id);
          const r = REPORTS.find(r => r.id === id);
          showNotification(`✅ ${r?.title || 'Report'} downloaded!`);
        }
      } catch (err) {
        showNotification('❌ Download failed: ' + err.message);
      } finally {
        setDownloading(null);
      }
    }, 300);
  };

  // Inline total value summary
  const totalValue = inventoryData.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
  const critical = inventoryData.filter(i => i.status === 'critical').length;
  const expiring = inventoryData.filter(i => {
    const d = daysUntil(i.expiry);
    return typeof d === 'number' && d >= 0 && d <= 60;
  }).length;

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Reports &amp; Analytics</h1>
          <p>Download live reports directly from your inventory data</p>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={() => runDownload('all')}>
            ⬇ Export All
          </button>
        </div>
      </header>

      {/* Live data summary bar */}
      {inventoryData.length > 0 && (
        <div style={{
          display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24,
          padding: '16px 20px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}>
          <Stat label="Total Medications" value={inventoryData.length} color="#0d9488" />
          <Stat label="Inventory Value" value={`₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="#3b82f6" />
          <Stat label="Critical Stock" value={critical} color="#ef4444" />
          <Stat label="Expiring ≤60d" value={expiring} color="#f59e0b" />
        </div>
      )}

      <div className="reports-grid">
        {REPORTS.map(r => {
          const isLoading = downloading === r.id;
          return (
            <div
              key={r.id}
              className="report-card"
              onClick={() => !isLoading && runDownload(r.id)}
              style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'wait' : 'pointer' }}
            >
              <div className="report-icon" style={{ background: r.bg, color: r.color }}>
                {isLoading
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="30 60" /></svg>
                  : r.icon
                }
              </div>
              <div className="report-title">{r.title}</div>
              <div className="report-desc">{r.desc}</div>
              <div className="report-meta">
                {r.meta}
                {inventoryData.length > 0 && (
                  <span style={{ marginLeft: 8, color: '#0d9488', fontWeight: 600, fontSize: 11 }}>
                    · {inventoryData.length} records
                  </span>
                )}
              </div>
              <div style={{
                marginTop: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: r.color,
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {isLoading ? 'Generating...' : `Download ${r.format}`}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
    </div>
  );
}

function buildReport(id, inventoryData) {
  switch (id) {
    case 'inventory':  return buildInventoryReport(inventoryData);
    case 'expiry':     return buildExpiryReport(inventoryData);
    case 'lowstock':   return buildLowStockReport(inventoryData);
    case 'valuation':  return buildValuationReport(inventoryData);
    default: return buildInventoryReport(inventoryData);
  }
}
