import { useState, useEffect, useRef, useMemo } from 'react';
import { Chart } from 'chart.js/auto';
import { formatDate, formatStatus, CHART_DATA } from '../data.js';
import { SearchIcon, BellIcon, WarningIcon, InfoIcon, BoltIcon, ArrowRightIcon, BoxIcon, HeartbeatIcon, CheckIcon, PillIcon, EditIcon } from '../Icons.jsx';

function StatCard({ icon, iconClass, trend, trendClass, value, label, onClick }) {
  return (
    <div className="stat-card" onClick={onClick}>
      <div className="stat-header">
        <div className={`stat-icon ${iconClass}`}>{icon}</div>
        <span className={`stat-trend ${trendClass}`}>{trend}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function InventoryRow({ item }) {
  const stockClass = item.stock > 70 ? 'high' : item.stock > 30 ? 'medium' : 'low';
  return (
    <tr>
      <td>
        <div className="drug-info">
          <div className="drug-icon"><PillIcon size={18} stroke="var(--accent-teal)" /></div>
          <div>
            <div className="drug-name">{item.name}</div>
            <div className="drug-category">{item.category}</div>
          </div>
        </div>
      </td>
      <td>
        <div className="stock-bar">
          <div className={`stock-fill ${stockClass}`} style={{ width: `${item.stock}%` }} />
        </div>
      </td>
      <td>{item.quantity.toLocaleString()} units</td>
      <td>{formatDate(item.expiry)}</td>
      <td><span className={`status-badge ${item.status}`}>{formatStatus(item.status)}</span></td>
      <td>
        <button className="action-btn" title="Edit"><EditIcon size={14} /></button>
        <button className="action-btn" title="Reorder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

function InventoryChart() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [activePeriod, setActivePeriod] = useState('week');

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const data = CHART_DATA[activePeriod];
    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Dispensed', data: data.dispensed,
            borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,0.1)',
            borderWidth: 2, fill: true, tension: 0.4,
            pointBackgroundColor: '#0d9488', pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
          },
          {
            label: 'Received', data: data.received,
            borderColor: '#3b82f6', backgroundColor: 'transparent',
            borderWidth: 2, fill: false, tension: 0.4,
            pointBackgroundColor: '#3b82f6', pointBorderColor: '#fff',
            pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top', align: 'end', labels: { color: '#64748b', usePointStyle: true, padding: 20, font: { size: 12 } } } },
        scales: {
          x: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
          y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
        },
        interaction: { intersect: false, mode: 'index' },
      },
    });
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [activePeriod]);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Inventory Trends</h3>
        <div className="tabs">
          {['week', 'month', 'year'].map(p => (
            <button key={p} className={`tab${activePeriod === p ? ' active' : ''}`} onClick={() => setActivePeriod(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body">
        <div className="chart-container"><canvas ref={chartRef} /></div>
      </div>
    </div>
  );
}

function ClockIcon({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default function Dashboard({ user, inventoryData, onNavigate, onOpenModal, onExport }) {
  const [displayStats, setDisplayStats] = useState({ totalMeds: 0, totalUnits: 0, lowStock: 0, expiringSoon: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  // Compute real stats from live inventory
  const realStats = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    return {
      totalMeds: inventoryData.length,
      totalUnits: inventoryData.reduce((s, i) => s + (i.quantity || 0), 0),
      lowStock: inventoryData.filter(i => i.status === 'critical' || i.status === 'low-stock').length,
      expiringSoon: inventoryData.filter(i => {
        if (!i.expiry) return false;
        const d = new Date(i.expiry);
        return d >= now && d <= in30;
      }).length,
    };
  }, [inventoryData]);

  // Find worst critical stock item
  const criticalItem = useMemo(() =>
    inventoryData.filter(i => i.status === 'critical').sort((a, b) => a.quantity - b.quantity)[0] || null,
    [inventoryData]);

  // Find soonest expiring item
  const expiringItem = useMemo(() => {
    const now = new Date();
    return inventoryData
      .filter(i => i.expiry && new Date(i.expiry) >= now)
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry))[0] || null;
  }, [inventoryData]);

  // Animated counters targeting real values
  useEffect(() => {
    let frame;
    let start = null;
    const duration = 1200;
    const targets = realStats;
    const animate = (ts) => {
      if (!start) start = ts;
      const ease = Math.min((ts - start) / duration, 1);
      const t = 1 - Math.pow(1 - ease, 3);
      setDisplayStats({
        totalMeds:   Math.floor(targets.totalMeds * t),
        totalUnits:  Math.floor(targets.totalUnits * t),
        lowStock:    Math.floor(targets.lowStock * t),
        expiringSoon: Math.floor(targets.expiringSoon * t),
      });
      if (ease < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [realStats]);

  function daysToExpiry(expiry) {
    return Math.ceil((new Date(expiry) - new Date()) / 86400000);
  }

  const filteredInventory = inventoryData.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEmpty = inventoryData.length === 0;

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Pharmacy Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p>Welcome back, {user?.name}. Live inventory overview.</p>
            <span className="live-indicator"><span className="live-dot" />LIVE</span>
          </div>
        </div>
        <div className="header-right">
          <div className="search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Search medications..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="header-btn" onClick={() => onNavigate('notifications')} title="Notifications">
            <BellIcon size={18} />
            <span className="notification-dot" />
          </button>
          <button className="user-avatar" title="User">{user?.initials}</button>
        </div>
      </header>

      {/* ── Empty state for brand-new pharmacies ── */}
      {isEmpty && (
        <div className="dashboard-empty-state">
          <div className="dashboard-empty-icon">🏥</div>
          <h2>Welcome to your new pharmacy!</h2>
          <p>
            Your inventory is currently empty. Start by adding your first medications
            to unlock the full dashboard, analytics, and reporting features.
          </p>
          <div className="dashboard-empty-actions">
            <button className="btn btn-primary" style={{ fontSize: 15, padding: '12px 28px' }} onClick={() => onOpenModal('add')}>
              + Add First Medication
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 15, padding: '12px 28px' }} onClick={() => onNavigate('inventory')}>
              Go to Inventory
            </button>
          </div>
          <div className="dashboard-empty-tips">
            <div className="tip-card">
              <span className="tip-icon">📦</span>
              <div>
                <strong>Add medications</strong>
                <p>Use the Inventory page or the button above to add your stock.</p>
              </div>
            </div>
            <div className="tip-card">
              <span className="tip-icon">🛒</span>
              <div>
                <strong>Sell medicines</strong>
                <p>Once stock is added, use Sell Medicines to process transactions.</p>
              </div>
            </div>
            <div className="tip-card">
              <span className="tip-icon">📊</span>
              <div>
                <strong>Live analytics</strong>
                <p>Charts and alerts appear automatically as your inventory grows.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isEmpty && <>
        <div className="stats-grid">
          <StatCard
            iconClass="teal" icon={<BoxIcon size={20} />}
            trend={`${realStats.totalMeds} types`} trendClass="up"
            value={displayStats.totalMeds.toLocaleString()} label="Medication Types"
            onClick={() => onNavigate('inventory')}
          />
          <StatCard
            iconClass="blue" icon={<HeartbeatIcon size={20} />}
            trend="Live data" trendClass="up"
            value={displayStats.totalUnits.toLocaleString()} label="Total Units in Stock"
            onClick={() => onNavigate('inventory')}
          />
          <StatCard
            iconClass="orange" icon={<WarningIcon size={20} />}
            trend={realStats.lowStock > 0 ? 'Needs attention' : 'All good'} trendClass={realStats.lowStock > 0 ? 'down' : 'up'}
            value={displayStats.lowStock.toLocaleString()} label="Low / Critical Items"
            onClick={() => onNavigate('inventory')}
          />
          <StatCard
            iconClass="purple" icon={<ClockIcon />}
            trend={realStats.expiringSoon > 0 ? 'Action needed' : 'All clear'} trendClass={realStats.expiringSoon > 0 ? 'down' : 'up'}
            value={displayStats.expiringSoon.toLocaleString()} label="Expiring in 30 Days"
            onClick={() => onNavigate('notifications')}
          />
        </div>

        <div className="alerts-grid">
          {criticalItem ? (
            <div className="alert-card">
              <div className="alert-icon critical"><WarningIcon size={20} /></div>
              <div className="alert-content">
                <h4>Critical Stock Alert</h4>
                <p>{criticalItem.name} is below critical threshold. Only {criticalItem.quantity.toLocaleString()} units remaining.</p>
                <button className="alert-action" onClick={() => onOpenModal('reorder')}>
                  Reorder Now <ArrowRightIcon size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="alert-card alert-card-ok">
              <div className="alert-icon alert-icon-ok"><CheckIcon size={20} /></div>
              <div className="alert-content">
                <h4>All Stock Levels Healthy</h4>
                <p>No critical stock alerts. All medications are above minimum thresholds.</p>
                <button className="alert-action alert-action-ok" onClick={() => onNavigate('inventory')}>
                  View Inventory <ArrowRightIcon size={12} />
                </button>
              </div>
            </div>
          )}

          {expiringItem ? (
            <div className="alert-card">
              <div className="alert-icon warning"><InfoIcon size={20} /></div>
              <div className="alert-content">
                <h4>Expiry Warning</h4>
                <p>
                  {expiringItem.name} expires in {daysToExpiry(expiringItem.expiry)} day{daysToExpiry(expiringItem.expiry) !== 1 ? 's' : ''}.{' '}
                  {expiringItem.quantity.toLocaleString()} units in stock.
                </p>
                <button className="alert-action" onClick={() => onNavigate('inventory')}>
                  View Details <ArrowRightIcon size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="alert-card alert-card-ok">
              <div className="alert-icon alert-icon-ok"><CheckIcon size={20} /></div>
              <div className="alert-content">
                <h4>No Expiry Alerts</h4>
                <p>No medications expiring soon. All batches are well within date.</p>
                <button className="alert-action alert-action-ok" onClick={() => onNavigate('inventory')}>
                  View Inventory <ArrowRightIcon size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="main-grid">
          <InventoryChart />
          <div className="card ai-panel">
            <div className="ai-header">
              <div className="ai-badge"><BoltIcon size={12} /> AI Insights</div>
            </div>
            <div className="insight-list">
              <div className="insight-item" onClick={() => onNavigate('predictions')}>
                <div className="insight-icon alert"><WarningIcon size={16} /></div>
                <div className="insight-content">
                  <h4>Stock Prediction</h4>
                  <p>Metformin demand expected to increase 23% next week.</p>
                  <div className="insight-time">2 min ago</div>
                </div>
              </div>
              <div className="insight-item" onClick={() => onNavigate('notifications')}>
                <div className="insight-icon warning"><ClockIcon size={16} /></div>
                <div className="insight-content">
                  <h4>Expiry Alert</h4>
                  <p>
                    {expiringItem
                      ? `${expiringItem.name} expires in ${daysToExpiry(expiringItem.expiry)} days.`
                      : 'No critical expiry alerts at this time.'}
                  </p>
                  <div className="insight-time">Just now</div>
                </div>
              </div>
              <div className="insight-item" onClick={() => onNavigate('suppliers')}>
                <div className="insight-icon success"><CheckIcon size={16} /></div>
                <div className="insight-content">
                  <h4>Reorder Optimized</h4>
                  <p>Consolidating orders could save ₹2,340 this quarter.</p>
                  <div className="insight-time">1 hr ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Current Inventory</h3>
            <div className="card-actions">
              <button className="btn btn-secondary" onClick={onExport}>Export</button>
              <button className="btn btn-primary" onClick={() => onOpenModal('add')}>Add Medication</button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Medication</th><th>Stock Level</th><th>Quantity</th>
                  <th>Expiry</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.slice(0, 8).map((item, idx) => (
                  <InventoryRow key={idx} item={item} />
                ))}
              </tbody>
            </table>
            {filteredInventory.length > 8 && (
              <div style={{ padding: '12px 20px', textAlign: 'center' }}>
                <button className="btn btn-secondary" onClick={() => onNavigate('inventory')}>
                  View all {filteredInventory.length} medications →
                </button>
              </div>
            )}
            {filteredInventory.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No medications match your search.
              </div>
            )}
          </div>
        </div>
      </>}
    </>
  );
}
