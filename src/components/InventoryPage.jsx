import { useState, useEffect } from 'react';
import { formatDate, formatStatus } from '../data.js';
import { PillIcon, EditIcon, CloseIcon } from '../Icons.jsx';

function TrashIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function timeAgo(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return secs + 's ago';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function daysUntilExpiry(expiryStr) {
  if (!expiryStr) return Infinity;
  return Math.ceil((new Date(expiryStr).getTime() - Date.now()) / 86400000);
}

function ExpiryCell({ expiry }) {
  const days = daysUntilExpiry(expiry);
  let color = 'inherit';
  let badge = null;
  if (days < 0) { color = '#ef4444'; badge = 'EXPIRED'; }
  else if (days <= 30) { color = '#f97316'; badge = days + 'd'; }
  else if (days <= 90) { color = '#eab308'; badge = days + 'd'; }
  return (
    <span style={{ color, fontWeight: badge ? 700 : 400 }}>
      {formatDate(expiry)}
      {badge && (
        <span style={{ marginLeft: 6, fontSize: 10, background: color, color: '#fff', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle' }}>
          {badge}
        </span>
      )}
    </span>
  );
}

function SortIcon({ dir }) {
  if (!dir) return <span style={{ opacity: 0.3, fontSize: 11, marginLeft: 4 }}>⇅</span>;
  return <span style={{ fontSize: 11, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

/* ─── Edit Modal ──────────────────────────────────────────────────────────── */
const CATEGORIES = ['Antibiotics', 'Analgesics', 'Antidiabetics', 'Cardiovascular',
  'Respiratory', 'Gastrointestinal', 'Supplements', 'Antihistamine', 'Other'];
const STATUSES = ['in-stock', 'low-stock', 'critical', 'expiring'];

function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    name:     item.name,
    category: item.category,
    quantity: item.quantity,
    expiry:   item.expiry || '',
    status:   item.status,
  });
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.quantity || isNaN(parseInt(form.quantity)) || parseInt(form.quantity) < 0) {
      setError('Enter a valid quantity.'); return;
    }
    if (!form.expiry) { setError('Expiry date is required.'); return; }
    setError('');
    onSave({
      ...item,
      name:     form.name.trim(),
      category: form.category,
      quantity: parseInt(form.quantity),
      expiry:   form.expiry,
      status:   form.status,
      lastUpdated: new Date().toISOString(),
    });
  };

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3 className="modal-title">✏️ Edit Medication</h3>
          <button className="modal-close" onClick={onClose}><CloseIcon size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: 20 }}>

          <div className="form-group">
            <label className="form-label">Medication Name *</label>
            <input type="text" className="form-input" value={form.name} onChange={update('name')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input form-select" value={form.category} onChange={update('category')}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input form-select" value={form.status} onChange={update('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Quantity in Stock *</label>
              <input type="number" className="form-input" min="0" value={form.quantity} onChange={update('quantity')} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date *</label>
              <input type="date" className="form-input" value={form.expiry} onChange={update('expiry')} />
            </div>
          </div>

          {/* Live preview */}
          <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Preview</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span><b>{form.name || '—'}</b> · {form.category}</span>
              <span className={`status-badge ${form.status}`}>{formatStatus(form.status)}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {parseInt(form.quantity) || 0} units · Expires: {form.expiry ? formatDate(form.expiry) : '—'}
            </div>
          </div>

          {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Save Changes</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Row ────────────────────────────────────────────────────────────────── */
const HIGH_VALUE_THRESHOLD = 500;

function PriceCell({ price, unit }) {
  const isHigh = price > HIGH_VALUE_THRESHOLD;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontWeight: 700, color: isHigh ? '#dc2626' : 'var(--text-primary)', fontSize: 13 }}>
        ₹{price.toFixed(2)}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>/{unit}</span>
      {isHigh && (
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
          background: '#fef2f2', color: '#dc2626',
          border: '1px solid #fca5a5',
          padding: '1px 5px', borderRadius: 4,
          textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>💎 High Value</span>
      )}
    </span>
  );
}

function InventoryRow({ item, onEdit, onAddToSell, onDelete }) {
  const stockClass = item.stock > 70 ? 'high' : item.stock > 30 ? 'medium' : 'low';
  const isRecentlyUpdated = item.lastUpdated &&
    (Date.now() - new Date(item.lastUpdated).getTime()) < 60000;
  const isHighValue = (item.price ?? 0) > HIGH_VALUE_THRESHOLD;

  return (
    <tr className={isRecentlyUpdated ? 'inventory-row-updated' : ''}>
      <td>
        <div className="drug-info">
          <div className="drug-icon">
            <PillIcon size={18} stroke={isHighValue ? '#dc2626' : 'var(--accent-teal)'} />
          </div>
          <div>
            <div className="drug-name" style={{ color: isHighValue ? '#dc2626' : undefined }}>
              {item.name}
              {isRecentlyUpdated && <span className="live-dot" title="Recently updated" />}
            </div>
            <div className="drug-category">{item.category}</div>
          </div>
        </div>
      </td>
      <td>{item.category}</td>
      <td>
        <div className="stock-bar">
          <div className={`stock-fill ${stockClass}`} style={{ width: `${item.stock}%`, transition: 'width 0.6s ease' }} />
        </div>
      </td>
      <td>
        <span className={isRecentlyUpdated ? 'qty-flash' : ''}>
          {item.quantity.toLocaleString()} units
        </span>
      </td>
      <td><ExpiryCell expiry={item.expiry} /></td>
      {/* ── Rate column ── */}
      <td><PriceCell price={item.price ?? 0} unit={item.unit ?? 'Unit'} /></td>
      <td><span className={`status-badge ${item.status}`}>{formatStatus(item.status)}</span></td>
      <td>
        {item.lastUpdated && (
          <span className="last-updated-tag" title={'Last updated: ' + new Date(item.lastUpdated).toLocaleString()}>
            {timeAgo(item.lastUpdated)}
          </span>
        )}
        <button
          className="action-btn"
          title="Edit this medication"
          onClick={() => onEdit(item)}
          style={{ color: 'var(--accent-blue)' }}
        >
          <EditIcon size={14} />
        </button>
        <button
          className="action-btn"
          title="Add to Sell page"
          onClick={() => onAddToSell(item)}
          style={{ color: 'var(--accent-teal)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </button>
        <button
          className="action-btn"
          title="Delete this medication"
          onClick={() => onDelete(item)}
          style={{ color: 'var(--accent-red)' }}
        >
          <TrashIcon size={14} />
        </button>
      </td>
    </tr>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function InventoryPage({
  inventoryData, onOpenModal, onExport, onResetInventory,
  onUpdateItem,
  onDeleteItem,
  onNavigate,
  onPreloadSell,
}) {
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState('expiry');
  const [sortDir, setSortDir] = useState('asc');
  const [, setTick] = useState(0);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // item to confirm-delete
  const [toast, setToast] = useState('');

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Filter
  let filtered = filter === 'all' ? inventoryData
    : filter === 'expiring' ? inventoryData.filter(i => daysUntilExpiry(i.expiry) <= 90)
    : filter === 'high-value' ? inventoryData.filter(i => (i.price ?? 0) > HIGH_VALUE_THRESHOLD)
    : inventoryData.filter(i => i.status === filter);

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortKey === 'name') {
      const av = a.name.toLowerCase(), bv = b.name.toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    let av, bv;
    if (sortKey === 'expiry') {
      av = new Date(a.expiry || '9999').getTime();
      bv = new Date(b.expiry || '9999').getTime();
    } else if (sortKey === 'stock') {
      av = a.stock; bv = b.stock;
    } else if (sortKey === 'quantity') {
      av = a.quantity; bv = b.quantity;
    } else if (sortKey === 'price') {
      av = a.price ?? 0; bv = b.price ?? 0;
    } else {
      av = 0; bv = 0;
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const totalItems = inventoryData.length;
  const totalUnits = inventoryData.reduce((s, i) => s + i.quantity, 0);
  const lowStockCount = inventoryData.filter(i => i.status === 'low-stock' || i.status === 'critical').length;
  const expiringCount = inventoryData.filter(i => daysUntilExpiry(i.expiry) <= 90).length;
  const highValueCount = inventoryData.filter(i => (i.price ?? 0) > HIGH_VALUE_THRESHOLD).length;
  const lastUpdate = inventoryData
    .filter(i => i.lastUpdated)
    .sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated))[0];

  const thStyle = (key) => ({
    cursor: 'pointer',
    userSelect: 'none',
    color: sortKey === key ? 'var(--accent-teal)' : undefined,
    whiteSpace: 'nowrap',
  });

  const handleSaveEdit = (updatedItem) => {
    if (onUpdateItem) onUpdateItem(updatedItem);
    setEditingItem(null);
    setToast(`✅ ${updatedItem.name} updated successfully`);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (onDeleteItem) onDeleteItem(deleteTarget.name, deleteTarget.expiry);
    setDeleteTarget(null);
  };

  const handleAddToSell = (item) => {
    if (onPreloadSell) onPreloadSell(item);
    if (onNavigate) onNavigate('sell');
    setToast(`🛒 ${item.name} added to Sell page`);
  };

  return (
    <>
      {/* Edit Modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
          onSave={handleSaveEdit}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay active" onClick={() => setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🗑️ Delete Medication</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}><CloseIcon size={16} /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '28px 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", marginBottom: 8 }}>Are you sure?</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                This will permanently delete the batch of <b>{deleteTarget.name}</b>
                {deleteTarget.expiry && (
                  <> expiring on <b style={{ color: 'var(--accent-orange)' }}>{formatDate(deleteTarget.expiry)}</b></>
                )}
                {' '}({deleteTarget.quantity.toLocaleString()} units) from your inventory.
                Other batches of this medication will <b>not</b> be affected.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmDelete}>🗑️ Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* Inline toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 9999,
          background: '#0f172a', color: 'white', padding: '10px 18px',
          borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.25)',
          animation: 'slideIn .2s ease',
        }}>
          {toast}
        </div>
      )}

      <header className="header">
        <div className="header-left">
          <h1>Inventory Management</h1>
          <p>Manage your complete medication stock — updates in real-time on every sale</p>
        </div>
        <div className="header-right">
          <select
            className="form-input form-select"
            style={{ padding: '8px 12px', fontSize: 13, minWidth: 170 }}
            value={sortKey + '_' + sortDir}
            onChange={e => {
              const [k, d] = e.target.value.split('_');
              setSortKey(k); setSortDir(d);
            }}
          >
            <option value="expiry_asc">⏳ Expiry: Soonest First</option>
            <option value="expiry_desc">⏳ Expiry: Latest First</option>
            <option value="stock_asc">📦 Stock: Low → High</option>
            <option value="stock_desc">📦 Stock: High → Low</option>
            <option value="quantity_asc">🔢 Quantity: Low → High</option>
            <option value="quantity_desc">🔢 Quantity: High → Low</option>
            <option value="price_desc">💎 Rate: High → Low</option>
            <option value="price_asc">💎 Rate: Low → High</option>
            <option value="name_asc">🔤 Name: A → Z</option>
            <option value="name_desc">🔤 Name: Z → A</option>
          </select>
          {onResetInventory && (
            <button className="btn btn-secondary" onClick={onResetInventory} title="Reset inventory to seed data">
              🔄 Reset
            </button>
          )}
          <button className="btn btn-secondary" onClick={onExport}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => onOpenModal('add')}>+ Add Medication</button>
        </div>
      </header>

      {/* Live stats strip */}
      <div className="inventory-live-strip">
        <div className="live-stat">
          <span className="live-stat-value">{totalItems}</span>
          <span className="live-stat-label">Items</span>
        </div>
        <div className="live-stat">
          <span className="live-stat-value">{totalUnits.toLocaleString()}</span>
          <span className="live-stat-label">Total Units</span>
        </div>
        <div className="live-stat">
          <span className="live-stat-value" style={{ color: lowStockCount > 0 ? 'var(--accent-red)' : 'var(--accent-teal)' }}>
            {lowStockCount}
          </span>
          <span className="live-stat-label">Low / Critical</span>
        </div>
        <div className="live-stat">
          <span className="live-stat-value" style={{ color: expiringCount > 0 ? '#f97316' : 'var(--accent-teal)' }}>
            {expiringCount}
          </span>
          <span className="live-stat-label">Expiring ≤90d</span>
        </div>
        <div className="live-stat">
          <span className="live-stat-value" style={{ color: highValueCount > 0 ? '#dc2626' : 'var(--accent-teal)' }}>
            {highValueCount}
          </span>
          <span className="live-stat-label">High Value (&gt;₹500)</span>
        </div>
        <div className="live-stat">
          <div className="live-indicator">
            <span className="live-pulse" />
            <span className="live-stat-label">
              {lastUpdate ? 'Updated ' + timeAgo(lastUpdate.lastUpdated) : 'No updates yet'}
            </span>
          </div>
        </div>
      </div>

      <div className="filter-row">
        {[
          { key: 'all', label: 'All Items' },
          { key: 'in-stock', label: 'In Stock' },
          { key: 'low-stock', label: 'Low Stock' },
          { key: 'critical', label: 'Critical' },
          { key: 'expiring', label: `⏳ Expiring Soon${expiringCount > 0 ? ' (' + expiringCount + ')' : ''}` },
          { key: 'high-value', label: `💎 High Value${highValueCount > 0 ? ' (' + highValueCount + ')' : ''}` },
        ].map(f => (
          <button
            key={f.key}
            className={`filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="inventory-table">
            <thead>
              <tr>
                <th style={thStyle('name')} onClick={() => handleSort('name')}>
                  Medication <SortIcon dir={sortKey === 'name' ? sortDir : null} />
                </th>
                <th>Category</th>
                <th style={thStyle('stock')} onClick={() => handleSort('stock')}>
                  Stock Level <SortIcon dir={sortKey === 'stock' ? sortDir : null} />
                </th>
                <th style={thStyle('quantity')} onClick={() => handleSort('quantity')}>
                  Quantity <SortIcon dir={sortKey === 'quantity' ? sortDir : null} />
                </th>
                <th style={thStyle('expiry')} onClick={() => handleSort('expiry')}>
                  Expiry <SortIcon dir={sortKey === 'expiry' ? sortDir : null} />
                </th>
                <th style={thStyle('price')} onClick={() => handleSort('price')}>
                  Rate <SortIcon dir={sortKey === 'price' ? sortDir : null} />
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <InventoryRow
                  key={idx}
                  item={item}
                  onEdit={setEditingItem}
                  onAddToSell={handleAddToSell}
                  onDelete={setDeleteTarget}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
