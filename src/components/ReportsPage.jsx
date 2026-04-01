import { BoltIcon } from '../Icons.jsx';

const reports = [
  {
    bg: '#dbeafe', color: '#3b82f6', title: 'Monthly Inventory Report',
    desc: 'Complete stock levels, movements, and valuations for current month',
    meta: '📅 March 2026 · PDF',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    msg: 'Monthly Inventory Report downloaded!'
  },
  {
    bg: '#ccfbf1', color: '#0d9488', title: 'Dispensing Summary',
    desc: 'Detailed breakdown of medications dispensed by date and category',
    meta: '📅 This Week · CSV',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    msg: 'Dispensing Summary downloaded!'
  },
  {
    bg: '#ede9fe', color: '#8b5cf6', title: 'Expiry & Wastage Report',
    desc: 'Track medications nearing expiry and historical wastage data',
    meta: '📅 Q1 2026 · Excel',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    msg: 'Expiry Report downloaded!'
  },
  {
    bg: '#fef3c7', color: '#f59e0b', title: 'Supplier Performance',
    desc: 'On-time delivery rates, quality scores and pricing comparisons',
    meta: '📅 Last 6 Months · PDF',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
    msg: 'Supplier Performance Report downloaded!'
  },
  {
    bg: '#fee2e2', color: '#ef4444', title: 'Financial Summary',
    desc: 'Procurement costs, revenue from dispensing, and profit margins',
    meta: '📅 FY 2025-26 · Excel',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    msg: 'Financial Summary downloaded!'
  },
  {
    bg: '#ccfbf1', color: '#0d9488', title: 'AI Prediction Accuracy',
    desc: 'How well AI forecasts matched actual demand — model performance',
    meta: '📅 Last 90 Days · PDF',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    msg: 'AI Prediction Report downloaded!'
  },
];

export default function ReportsPage({ onExport, showNotification }) {
  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Reports &amp; Analytics</h1>
          <p>Download and view detailed pharmacy reports</p>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={onExport}>Export All</button>
        </div>
      </header>

      <div className="reports-grid">
        {reports.map((r, idx) => (
          <div key={idx} className="report-card" onClick={() => showNotification(r.msg)}>
            <div className="report-icon" style={{ background: r.bg, color: r.color }}>
              {r.icon}
            </div>
            <div className="report-title">{r.title}</div>
            <div className="report-desc">{r.desc}</div>
            <div className="report-meta">{r.meta}</div>
          </div>
        ))}
      </div>
    </>
  );
}
