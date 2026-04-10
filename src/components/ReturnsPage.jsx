import { useState, useCallback } from 'react';
import { CloseIcon, TrashIcon, CheckIcon } from '../Icons.jsx';

// ── Utility ──────────────────────────────────────────────────────────────────
function printReturnReceipt(html) {
  const w = window.open('', '_blank', 'width=440,height=650');
  if (!w) return;
  w.document.write(`<html><head><title>Return Receipt</title><style>
body{font-family:sans-serif;margin:0;padding:20px;}
.rr-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;}
.rr-row.total{font-weight:700;font-size:15px;border-top:2px dashed #ccc;padding-top:8px;margin-top:4px;}
.rr-header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px dashed #ccc;}
.rr-footer{text-align:center;margin-top:14px;padding-top:12px;border-top:2px dashed #ccc;font-size:11px;color:#999;}
.rr-logo{font-size:20px;font-weight:700;color:#0d9488;}
.rr-type-badge{display:inline-block;margin-top:8px;padding:3px 14px;border-radius:12px;font-size:12px;font-weight:700;}
</style></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
}

const RETURN_TYPES = {
  SUPPLIER: 'return_to_supplier',
  CUSTOMER: 'return_from_customer',
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReturnsPage({
  inventoryData = [],
  onInventoryUpdate,
  showNotification,
  currentUser,
}) {
  // Tab state
  const [activeTab, setActiveTab] = useState(RETURN_TYPES.SUPPLIER);

  // ─── Return to Supplier state ────────────────────────────────────────────
  const [rtsItems, setRtsItems] = useState([]); // items selected for return
  const [rtsSearch, setRtsSearch] = useState('');
  const [rtsDropdownResults, setRtsDropdownResults] = useState([]);
  const [rtsShowDropdown, setRtsShowDropdown] = useState(false);
  const [rtsSupplierName, setRtsSupplierName] = useState('');
  const [rtsReason, setRtsReason] = useState('Damaged');
  const [rtsNotes, setRtsNotes] = useState('');

  // ─── Return from Customer state ──────────────────────────────────────────
  const [rfcItems, setRfcItems] = useState([]);
  const [rfcSearch, setRfcSearch] = useState('');
  const [rfcDropdownResults, setRfcDropdownResults] = useState([]);
  const [rfcShowDropdown, setRfcShowDropdown] = useState(false);
  const [rfcCustomerName, setRfcCustomerName] = useState('');
  const [rfcReason, setRfcReason] = useState('Wrong Medicine');
  const [rfcNotes, setRfcNotes] = useState('');
  const [rfcOriginalTxn, setRfcOriginalTxn] = useState('');

  // ─── Receipt preview modal ────────────────────────────────────────────────
  const [receiptModal, setReceiptModal] = useState(null); // holds receipt data

  // ─── Returns history ─────────────────────────────────────────────────────
  const [returnsHistory, setReturnsHistory] = useState([]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtExpiry = (s) => {
    if (!s) return 'No expiry';
    try { return new Date(s).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); } catch { return s; }
  };

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Search helpers ────────────────────────────────────────────────────────
  const handleRtsSearch = useCallback((val) => {
    setRtsSearch(val);
    if (!val || val.length < 2) { setRtsDropdownResults([]); setRtsShowDropdown(false); return; }
    const results = inventoryData
      .filter(m => m.name.toLowerCase().includes(val.toLowerCase()) || m.barcode?.includes(val))
      .slice(0, 8);
    setRtsDropdownResults(results);
    setRtsShowDropdown(results.length > 0);
  }, [inventoryData]);

  const handleRfcSearch = useCallback((val) => {
    setRfcSearch(val);
    if (!val || val.length < 2) { setRfcDropdownResults([]); setRfcShowDropdown(false); return; }
    const results = inventoryData
      .filter(m => m.name.toLowerCase().includes(val.toLowerCase()) || m.barcode?.includes(val))
      .slice(0, 8);
    setRfcDropdownResults(results);
    setRfcShowDropdown(results.length > 0);
  }, [inventoryData]);

  // ── Add item to return list ───────────────────────────────────────────────
  const addRtsItem = (med) => {
    setRtsShowDropdown(false);
    setRtsSearch('');
    setRtsItems(prev => {
      const key = med._id || (med.name + '|' + med.expiry);
      if (prev.find(i => (i._id || (i.name + '|' + i.expiry)) === key)) {
        showNotification('Item already in return list');
        return prev;
      }
      return [...prev, { ...med, returnQty: 1 }];
    });
  };

  const addRfcItem = (med) => {
    setRfcShowDropdown(false);
    setRfcSearch('');
    setRfcItems(prev => {
      const key = med._id || (med.name + '|' + med.expiry);
      if (prev.find(i => (i._id || (i.name + '|' + i.expiry)) === key)) {
        showNotification('Item already in return list');
        return prev;
      }
      return [...prev, { ...med, returnQty: 1 }];
    });
  };

  // ── Change return quantity ────────────────────────────────────────────────
  const changeRtsQty = (idx, val) => {
    setRtsItems(prev => prev.map((i, n) =>
      n === idx ? { ...i, returnQty: Math.max(1, Math.min(parseInt(val) || 1, i.quantity)) } : i
    ));
  };
  const changeRfcQty = (idx, val) => {
    setRfcItems(prev => prev.map((i, n) =>
      n === idx ? { ...i, returnQty: Math.max(1, parseInt(val) || 1) } : i
    ));
  };

  // ── Complete returns ──────────────────────────────────────────────────────
  const completeReturnToSupplier = () => {
    if (!rtsItems.length) { showNotification('⚠️ Add at least one item'); return; }
    if (!rtsSupplierName.trim()) { showNotification('⚠️ Enter supplier name'); return; }

    const now = new Date();
    const rtnId = 'RTS-' + Date.now().toString().slice(-6);
    const record = {
      id: rtnId,
      type: RETURN_TYPES.SUPPLIER,
      typeLabel: 'Return to Supplier',
      supplier: rtsSupplierName,
      reason: rtsReason,
      notes: rtsNotes,
      items: rtsItems.map(i => ({ name: i.name, expiry: i.expiry, qty: i.returnQty, price: i.price, unit: i.unit })),
      totalValue: rtsItems.reduce((s, i) => s + i.price * i.returnQty, 0),
      date: now,
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      processedBy: currentUser?.name || 'Staff',
    };

    // Remove/decrement these items from inventory
    if (onInventoryUpdate) {
      onInventoryUpdate(rtsItems.map(i => ({
        action: 'decrease',
        _id: i._id,
        name: i.name,
        expiry: i.expiry,
        qty: i.returnQty,
      })));
    }

    setReturnsHistory(prev => [record, ...prev]);
    showNotification(`✅ ${rtnId} — ${rtsItems.length} item(s) returned to ${rtsSupplierName}`);

    // Show receipt
    setReceiptModal(record);

    // Reset form
    setRtsItems([]);
    setRtsSupplierName('');
    setRtsReason('Damaged');
    setRtsNotes('');
  };

  const completeReturnFromCustomer = () => {
    if (!rfcItems.length) { showNotification('⚠️ Add at least one item'); return; }
    if (!rfcCustomerName.trim()) { showNotification('⚠️ Enter customer name'); return; }

    const now = new Date();
    const rtnId = 'RFC-' + Date.now().toString().slice(-6);
    const record = {
      id: rtnId,
      type: RETURN_TYPES.CUSTOMER,
      typeLabel: 'Return from Customer',
      customer: rfcCustomerName,
      originalTxn: rfcOriginalTxn,
      reason: rfcReason,
      notes: rfcNotes,
      items: rfcItems.map(i => ({ name: i.name, expiry: i.expiry, qty: i.returnQty, price: i.price, unit: i.unit })),
      totalValue: rfcItems.reduce((s, i) => s + i.price * i.returnQty, 0),
      date: now,
      time: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      processedBy: currentUser?.name || 'Staff',
    };

    // Add items back to inventory
    if (onInventoryUpdate) {
      onInventoryUpdate(rfcItems.map(i => ({
        action: 'increase',
        _id: i._id,
        name: i.name,
        expiry: i.expiry,
        qty: i.returnQty,
      })));
    }

    setReturnsHistory(prev => [record, ...prev]);
    showNotification(`✅ ${rtnId} — ${rfcItems.length} item(s) returned from ${rfcCustomerName} — inventory restocked`);

    setReceiptModal(record);

    setRfcItems([]);
    setRfcCustomerName('');
    setRfcReason('Wrong Medicine');
    setRfcNotes('');
    setRfcOriginalTxn('');
  };

  // ── Receipt HTML generator ─────────────────────────────────────────────────
  const buildReceiptHTML = (rec) => {
    const isRts = rec.type === RETURN_TYPES.SUPPLIER;
    const badgeColor = isRts ? '#dc2626' : '#0891b2';
    const badgeBg = isRts ? '#fee2e2' : '#e0f2fe';
    const icon = isRts ? '📤' : '📥';
    const partyLabel = isRts ? 'Supplier' : 'Customer';
    const partyName = isRts ? rec.supplier : rec.customer;

    return `
<div>
  <div class="rr-header">
    <div class="rr-logo">${icon} PharmaAI</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Return Receipt</div>
    <div class="rr-type-badge" style="background:${badgeBg};color:${badgeColor};">${rec.typeLabel}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:8px;">${fmtDate(rec.date)} · ${rec.time}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px;">ID: ${rec.id}</div>
  </div>
  <div class="rr-row"><span>${partyLabel}</span><span><b>${partyName}</b></span></div>
  ${rec.originalTxn ? `<div class="rr-row"><span>Original TXN</span><span>${rec.originalTxn}</span></div>` : ''}
  <div class="rr-row"><span>Reason</span><span>${rec.reason}</span></div>
  <div class="rr-row"><span>Processed By</span><span>${rec.processedBy}</span></div>
  <div style="border-top:1px dashed #e2e8f0;margin:10px 0;padding-top:10px;">
    ${rec.items.map(i => `
      <div class="rr-row">
        <span>${i.name} × ${i.qty}${i.expiry ? ` <span style="font-size:10px;color:#94a3b8;">(exp ${fmtExpiry(i.expiry)})</span>` : ''}</span>
        <span>₹${(i.price * i.qty).toFixed(2)}</span>
      </div>`).join('')}
  </div>
  <div class="rr-row total"><span>Total Value</span><span>₹${rec.totalValue.toFixed(2)}</span></div>
  ${rec.notes ? `<div style="margin-top:10px;padding:8px;background:#f8fafc;border-radius:6px;font-size:12px;color:#475569;"><b>Notes:</b> ${rec.notes}</div>` : ''}
  <div class="rr-footer">${isRts ? 'Items removed from inventory' : 'Items added back to inventory'}<br/>Thank you — PharmaAI Smart Pharmacy</div>
</div>`;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Return Receipt Modal ── */}
      {receiptModal && (
        <div className="modal-overlay active" onClick={() => setReceiptModal(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"
              style={{
                background: receiptModal.type === RETURN_TYPES.SUPPLIER
                  ? 'linear-gradient(135deg,#fff1f2,#fee2e2)'
                  : 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                borderBottom: `2px solid ${receiptModal.type === RETURN_TYPES.SUPPLIER ? '#fca5a5' : '#93c5fd'}`,
              }}>
              <h3 className="modal-title" style={{
                color: receiptModal.type === RETURN_TYPES.SUPPLIER ? '#dc2626' : '#1d4ed8'
              }}>
                {receiptModal.type === RETURN_TYPES.SUPPLIER ? '📤' : '📥'} Return Receipt
              </h3>
              <button className="modal-close" onClick={() => setReceiptModal(null)}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="modal-body" dangerouslySetInnerHTML={{ __html: buildReceiptHTML(receiptModal) }} />
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setReceiptModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => printReturnReceipt(buildReceiptHTML(receiptModal))}>
                🖨️ Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <header className="header">
        <div className="header-left">
          <h1>↩️ Returns Management</h1>
          <p>Process medicine returns — update inventory and generate return receipts</p>
        </div>
        <div className="header-right">
          <div style={{
            background: 'linear-gradient(135deg,var(--accent-teal),#0891b2)',
            color: 'white',
            borderRadius: 10,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            📋 {returnsHistory.length} Return{returnsHistory.length !== 1 ? 's' : ''} Today
          </div>
        </div>
      </header>

      {/* ── Stats Strip ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
        {[
          {
            label: 'Return to Supplier',
            count: returnsHistory.filter(r => r.type === RETURN_TYPES.SUPPLIER).length,
            icon: '📤',
            color: '#dc2626',
            bg: '#fee2e2',
          },
          {
            label: 'Return from Customer',
            count: returnsHistory.filter(r => r.type === RETURN_TYPES.CUSTOMER).length,
            icon: '📥',
            color: '#0891b2',
            bg: '#e0f2fe',
          },
          {
            label: 'Total Value Processed',
            count: '₹' + returnsHistory.reduce((s, r) => s + r.totalValue, 0).toFixed(2),
            icon: '💰',
            color: '#059669',
            bg: '#ecfdf5',
          },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: 1,
            minWidth: 160,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: stat.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 1 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* ── LEFT: Form Panel ── */}
        <div>
          {/* Tab selector */}
          <div style={{
            display: 'flex', background: 'var(--bg-card)', borderRadius: 12,
            border: '1px solid var(--border)', padding: 5, marginBottom: 18,
            boxShadow: 'var(--shadow-sm)',
          }}>
            {[
              { id: RETURN_TYPES.SUPPLIER, label: '📤 Return to Supplier', color: '#dc2626', activeBg: '#fee2e2' },
              { id: RETURN_TYPES.CUSTOMER, label: '📥 Return from Customer', color: '#0891b2', activeBg: '#dbeafe' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'all .2s',
                  background: activeTab === tab.id ? tab.activeBg : 'transparent',
                  color: activeTab === tab.id ? tab.color : 'var(--text-muted)',
                  boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Return to Supplier Form ── */}
          {activeTab === RETURN_TYPES.SUPPLIER && (
            <div className="card">
              <div className="card-header" style={{
                background: 'linear-gradient(135deg,#fff1f2,#fee2e2)',
                borderBottom: '2px solid #fca5a5',
              }}>
                <div>
                  <h3 className="card-title" style={{ color: '#dc2626' }}>📤 Return to Supplier</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#9f1239' }}>
                    Selected items will be <b>removed from inventory</b> and a return receipt issued
                  </p>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Supplier name + reason */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Supplier Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. MediCore Pharma"
                      value={rtsSupplierName}
                      onChange={e => setRtsSupplierName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Return Reason</label>
                    <select className="form-input" value={rtsReason} onChange={e => setRtsReason(e.target.value)}>
                      {['Damaged', 'Expired', 'Wrong Item', 'Excess Stock', 'Quality Issue', 'Other'].map(r => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Medicine search */}
                <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                  <label className="form-label">Search Medicine to Return</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type medicine name..."
                      value={rtsSearch}
                      onChange={e => handleRtsSearch(e.target.value)}
                      onFocus={() => rtsDropdownResults.length && setRtsShowDropdown(true)}
                    />
                  </div>
                  {rtsShowDropdown && (
                    <div className="search-dropdown open" style={{ top: '100%', left: 0, right: 0, zIndex: 200 }}>
                      {rtsDropdownResults.map((m, idx) => (
                        <div
                          key={m._id || idx}
                          className="search-dropdown-item"
                          onClick={() => addRtsItem(m)}
                        >
                          <div className="item-name">{m.name}
                            {m.expiry && <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b' }}>exp {fmtExpiry(m.expiry)}</span>}
                          </div>
                          <div className="item-meta">{m.category} · ₹{m.price?.toFixed(2)} · Stock: {m.quantity}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items table */}
                {rtsItems.length > 0 && (
                  <div style={{ border: '1px solid #fecaca', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      background: '#fff1f2', padding: '8px 14px',
                      fontSize: 12, fontWeight: 700, color: '#dc2626',
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span>Items to Return ({rtsItems.length})</span>
                      <span>Total: ₹{rtsItems.reduce((s, i) => s + i.price * i.returnQty, 0).toFixed(2)}</span>
                    </div>
                    {rtsItems.map((item, idx) => (
                      <div key={item._id || idx} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderTop: '1px solid #fee2e2', background: 'var(--bg-card)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {item.category} · exp {fmtExpiry(item.expiry)} · ₹{item.price?.toFixed(2)}/{item.unit}
                          </div>
                          <div style={{ fontSize: 11, color: '#f97316', fontWeight: 600 }}>
                            Available stock: {item.quantity}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty:</label>
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={item.returnQty}
                            onChange={e => changeRtsQty(idx, e.target.value)}
                            style={{
                              width: 60, padding: '5px 8px', borderRadius: 7,
                              border: '1.5px solid var(--border)',
                              fontWeight: 700, textAlign: 'center',
                              background: 'var(--bg-body)', color: 'var(--text-primary)',
                              fontFamily: 'Inter, sans-serif',
                            }}
                          />
                        </div>
                        <div style={{ fontWeight: 700, color: '#dc2626', minWidth: 70, textAlign: 'right', fontSize: 13 }}>
                          ₹{(item.price * item.returnQty).toFixed(2)}
                        </div>
                        <button
                          onClick={() => setRtsItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: '#fee2e2', border: 'none', borderRadius: 6,
                            padding: '5px 7px', cursor: 'pointer', color: '#dc2626',
                          }}
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes (optional)</label>
                  <textarea
                    className="form-input"
                    placeholder="Any additional notes..."
                    rows={2}
                    value={rtsNotes}
                    onChange={e => setRtsNotes(e.target.value)}
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </div>

                {/* Submit */}
                <button
                  className="btn btn-primary"
                  style={{
                    background: rtsItems.length && rtsSupplierName
                      ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
                      : undefined,
                    padding: '12px 24px',
                    fontSize: 15,
                    fontWeight: 700,
                    gap: 8,
                    opacity: (!rtsItems.length || !rtsSupplierName) ? 0.6 : 1,
                    cursor: (!rtsItems.length || !rtsSupplierName) ? 'not-allowed' : 'pointer',
                  }}
                  onClick={completeReturnToSupplier}
                  disabled={!rtsItems.length || !rtsSupplierName}
                >
                  <CheckIcon size={16} /> Process Return to Supplier &amp; Generate Receipt
                </button>
              </div>
            </div>
          )}

          {/* ── Return from Customer Form ── */}
          {activeTab === RETURN_TYPES.CUSTOMER && (
            <div className="card">
              <div className="card-header" style={{
                background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                borderBottom: '2px solid #93c5fd',
              }}>
                <div>
                  <h3 className="card-title" style={{ color: '#1d4ed8' }}>📥 Return from Customer</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#1e40af' }}>
                    Returned items will be <b>added back to inventory</b> and a return receipt issued
                  </p>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Customer + Original TXN */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Customer Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Ramesh Sharma"
                      value={rfcCustomerName}
                      onChange={e => setRfcCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Original TXN ID (if known)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. TXN-123456"
                      value={rfcOriginalTxn}
                      onChange={e => setRfcOriginalTxn(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Return Reason</label>
                  <select className="form-input" value={rfcReason} onChange={e => setRfcReason(e.target.value)}>
                    {['Wrong Medicine', 'Duplicate Purchase', 'Doctor Changed Prescription', 'Adverse Reaction', 'Overstocked', 'Other'].map(r => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Medicine search */}
                <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                  <label className="form-label">Search Medicine Being Returned</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Type medicine name..."
                    value={rfcSearch}
                    onChange={e => handleRfcSearch(e.target.value)}
                    onFocus={() => rfcDropdownResults.length && setRfcShowDropdown(true)}
                  />
                  {rfcShowDropdown && (
                    <div className="search-dropdown open" style={{ top: '100%', left: 0, right: 0, zIndex: 200 }}>
                      {rfcDropdownResults.map((m, idx) => (
                        <div
                          key={m._id || idx}
                          className="search-dropdown-item"
                          onClick={() => addRfcItem(m)}
                        >
                          <div className="item-name">{m.name}
                            {m.expiry && <span style={{ marginLeft: 6, fontSize: 11, color: '#64748b' }}>exp {fmtExpiry(m.expiry)}</span>}
                          </div>
                          <div className="item-meta">{m.category} · ₹{m.price?.toFixed(2)} · Stock: {m.quantity}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Items table */}
                {rfcItems.length > 0 && (
                  <div style={{ border: '1px solid #bfdbfe', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{
                      background: '#eff6ff', padding: '8px 14px',
                      fontSize: 12, fontWeight: 700, color: '#1d4ed8',
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span>Items to Restock ({rfcItems.length})</span>
                      <span>Total Value: ₹{rfcItems.reduce((s, i) => s + i.price * i.returnQty, 0).toFixed(2)}</span>
                    </div>
                    {rfcItems.map((item, idx) => (
                      <div key={item._id || idx} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderTop: '1px solid #dbeafe', background: 'var(--bg-card)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            {item.category} · exp {fmtExpiry(item.expiry)} · ₹{item.price?.toFixed(2)}/{item.unit}
                          </div>
                          <div style={{ fontSize: 11, color: '#0891b2', fontWeight: 600 }}>
                            ✅ Will be added back to stock
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.returnQty}
                            onChange={e => changeRfcQty(idx, e.target.value)}
                            style={{
                              width: 60, padding: '5px 8px', borderRadius: 7,
                              border: '1.5px solid var(--border)',
                              fontWeight: 700, textAlign: 'center',
                              background: 'var(--bg-body)', color: 'var(--text-primary)',
                              fontFamily: 'Inter, sans-serif',
                            }}
                          />
                        </div>
                        <div style={{ fontWeight: 700, color: '#0891b2', minWidth: 70, textAlign: 'right', fontSize: 13 }}>
                          ₹{(item.price * item.returnQty).toFixed(2)}
                        </div>
                        <button
                          onClick={() => setRfcItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{
                            background: '#dbeafe', border: 'none', borderRadius: 6,
                            padding: '5px 7px', cursor: 'pointer', color: '#1d4ed8',
                          }}
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes (optional)</label>
                  <textarea
                    className="form-input"
                    placeholder="Any additional notes..."
                    rows={2}
                    value={rfcNotes}
                    onChange={e => setRfcNotes(e.target.value)}
                    style={{ resize: 'vertical', minHeight: 60 }}
                  />
                </div>

                {/* Submit */}
                <button
                  className="btn btn-primary"
                  style={{
                    background: rfcItems.length && rfcCustomerName
                      ? 'linear-gradient(135deg,#1d4ed8,#0891b2)'
                      : undefined,
                    padding: '12px 24px',
                    fontSize: 15,
                    fontWeight: 700,
                    gap: 8,
                    opacity: (!rfcItems.length || !rfcCustomerName) ? 0.6 : 1,
                    cursor: (!rfcItems.length || !rfcCustomerName) ? 'not-allowed' : 'pointer',
                  }}
                  onClick={completeReturnFromCustomer}
                  disabled={!rfcItems.length || !rfcCustomerName}
                >
                  <CheckIcon size={16} /> Restock Inventory &amp; Generate Receipt
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Returns History ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header">
              <h3 className="card-title">📋 Returns History</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {returnsHistory.length} record{returnsHistory.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="card-body" style={{ padding: 0, maxHeight: 520, overflowY: 'auto' }}>
              {returnsHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 24px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>↩️</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>No returns yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Processed returns will appear here</div>
                </div>
              ) : (
                returnsHistory.map((rec) => {
                  const isRts = rec.type === RETURN_TYPES.SUPPLIER;
                  return (
                    <div
                      key={rec.id}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setReceiptModal(rec)}
                      title="Click to view/print receipt"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: .5,
                            padding: '2px 8px', borderRadius: 8,
                            background: isRts ? '#fee2e2' : '#dbeafe',
                            color: isRts ? '#dc2626' : '#1d4ed8',
                          }}>
                            {isRts ? '📤 SUPPLIER' : '📥 CUSTOMER'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {rec.time}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 5 }}>{rec.id}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {isRts ? `Supplier: ${rec.supplier}` : `Customer: ${rec.customer}`}
                        &nbsp;·&nbsp;{rec.items.length} item{rec.items.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ fontSize: 12, color: isRts ? '#dc2626' : '#0891b2', fontWeight: 700, marginTop: 4 }}>
                        ₹{rec.totalValue.toFixed(2)} · {rec.reason}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {returnsHistory.length > 0 && (
              <div style={{
                padding: '10px 14px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}>
                <span>Click any record to reprint receipt</span>
                <button
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', fontSize: 12, fontWeight: 600,
                  }}
                  onClick={() => {
                    if (window.confirm('Clear returns history? (Inventory changes are permanent)')) {
                      setReturnsHistory([]);
                    }
                  }}
                >
                  Clear History
                </button>
              </div>
            )}
          </div>

          {/* Info card */}
          <div style={{
            background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)',
            border: '1px solid #a7f3d0',
            borderRadius: 12,
            padding: '14px 16px',
          }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#065f46', marginBottom: 8 }}>
              ℹ️ How Returns Work
            </div>
            <div style={{ fontSize: 11, color: '#047857', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>📤 <b>Return to Supplier</b> — removes the batch from your inventory stock</span>
              <span>📥 <b>Return from Customer</b> — adds quantity back to inventory</span>
              <span>🧾 Both generate a printable return receipt with full details</span>
              <span>📋 All returns are logged in the history panel on the right</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
