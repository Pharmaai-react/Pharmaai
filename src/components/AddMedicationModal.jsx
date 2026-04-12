import { useState, useCallback } from 'react';
import { CloseIcon, CameraIcon, StopIcon, ScanBarcodeIcon } from '../Icons.jsx';
import { useBarcodeScanner } from '../useBarcodeScanner.js';

export default function AddMedicationModal({ isOpen, onClose, onAdd, medicineDB, showNotification }) {
  const [activeTab, setActiveTab] = useState('manual');
  const [form, setForm] = useState({ barcode: '', name: '', category: '', scheme: '', unit: 'Tablet', quantity: '', price: '', expiry: '', threshold: '', supplier: '' });
  const [barcodeHint, setBarcodeHint] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [addScannedMed, setAddScannedMed] = useState(null);

  const handleAddBarcode = useCallback((code) => {
    const trimmed = code.trim();
    const med = (medicineDB || []).find(m => m.barcode === trimmed || m.name.toLowerCase().includes(trimmed.toLowerCase()));
    if (med) {
      setAddScannedMed(med);
      setScanResult({ type: 'existing', barcode: med.barcode, name: med.name, category: med.category, price: med.price.toFixed(2), stock: med.stock, unit: med.unit });
    } else {
      setAddScannedMed(null);
      setScanResult({ type: 'new', barcode: trimmed });
    }
  }, [medicineDB]);

  const { videoRef, scanAreaRef, isActive: addScannerActive, status: scanStatus, startScan: startAddScan, stopScan: stopAddScan } =
    useBarcodeScanner({
      onScan: handleAddBarcode,
    });

  const resetForm = () => {
    setForm({ barcode: '', name: '', category: '', scheme: '', unit: 'Tablet', quantity: '', price: '', expiry: '', threshold: '', supplier: '' });
    setBarcodeHint(false);
    setError('');
    setScanResult(null);
    setAddScannedMed(null);
    setActiveTab('manual');
    stopAddScan();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleBarcodeInput = (val) => {
    setForm(prev => ({ ...prev, barcode: val }));
    if (!val || val.length < 8) { setBarcodeHint(false); return; }
    const med = (medicineDB || []).find(m => m.barcode === val.trim());
    if (med) {
      setForm(prev => ({ ...prev, name: med.name, category: med.category || '', price: med.price.toFixed(2), unit: med.unit || 'Tablet' }));
      setBarcodeHint(true);
    } else { setBarcodeHint(false); }
  };

  const useScannedForAdd = () => {
    if (!addScannedMed) return;
    const m = addScannedMed;
    setForm(prev => ({ ...prev, barcode: m.barcode, name: m.name, category: m.category || '', price: m.price.toFixed(2), unit: m.unit || 'Tablet' }));
    setBarcodeHint(true);
    setActiveTab('manual');
    showNotification('Form filled from scanned barcode!');
  };

  const useNewBarcodeForAdd = () => {
    if (!scanResult || scanResult.type !== 'new') return;
    setForm(prev => ({ ...prev, barcode: scanResult.barcode }));
    setBarcodeHint(false);
    setActiveTab('manual');
    showNotification('Barcode ' + scanResult.barcode + ' captured! Fill in the medicine details.');
  };

  const handleAdd = () => {
    const { name, category, quantity, price, expiry } = form;
    if (!name.trim() || !category || !quantity || !price || !expiry) {
      setError('⚠️ Please fill in all required fields (Name, Category, Quantity, Price, Expiry).');
      setActiveTab('manual');
      return;
    }
    setError('');
    const barcode = form.barcode.trim() || ('BAR-' + Date.now().toString(36).toUpperCase());
    const qty = parseInt(quantity);
    const stockPct = Math.min(100, Math.round((qty / 500) * 100));
    const status = stockPct > 70 ? 'in-stock' : stockPct > 30 ? 'low-stock' : 'critical';
    onAdd({
      name: name.trim(), category, scheme: form.scheme || '',
      stock: stockPct, quantity: qty,
      expiry, status, barcode, price: parseFloat(price), unit: form.unit
    });
    handleClose();
  };

  const handleSwitchTab = (tab) => {
    setActiveTab(tab);
    if (tab !== 'scan') stopAddScan();
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay${isOpen ? ' active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">➕ Add New Medication</h3>
          <button className="modal-close" onClick={handleClose}><CloseIcon size={16} /></button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#fafafa' }}>
            <button
              className={`add-tab${activeTab === 'manual' ? ' active' : ''}`}
              onClick={() => handleSwitchTab('manual')}
            >✏️ Manual Entry</button>
            <button
              className={`add-tab${activeTab === 'scan' ? ' active' : ''}`}
              onClick={() => handleSwitchTab('scan')}
            >📷 Scan Barcode</button>
          </div>

          {activeTab === 'manual' && (
            <div style={{ padding: 20 }}>
              {/* Barcode field */}
              <div className="form-group">
                <label className="form-label">Barcode / SKU</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text" className="form-input" style={{ flex: 1 }}
                    placeholder="e.g. 8901234567890"
                    value={form.barcode}
                    onChange={e => handleBarcodeInput(e.target.value)}
                  />
                  <button className="btn btn-secondary" style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => handleSwitchTab('scan')} title="Scan barcode">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </button>
                </div>
                {barcodeHint && <div className="barcode-hint">✅ Barcode recognised — fields auto-filled!</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Medication Name *</label>
                <input type="text" className="form-input" placeholder="e.g., Paracetamol 500mg"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-input form-select" value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    <option value="">Select category</option>
                    <option>Antibiotics</option><option>Analgesics</option>
                    <option>Antidiabetics</option><option>Cardiovascular</option>
                    <option>Respiratory</option><option>Gastrointestinal</option>
                    <option>Supplements</option><option>Antihistamine</option><option>Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit *</label>
                  <select className="form-input form-select" value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                    <option>Tablet</option><option>Capsule</option><option>Vial</option>
                    <option>Bottle</option><option>Inhaler</option><option>Sachet</option><option>Strip</option>
                  </select>
                </div>
              </div>

              {/* Government Scheme — optional */}
              <div className="form-group">
                <label className="form-label">
                  🏛️ Government Scheme
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>(optional — 80% discount at sale)</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['', 'RGHS', 'Chiranjeevi'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, scheme: p.scheme === s ? '' : s }))}
                      style={{
                        flex: 1,
                        padding: '9px 6px',
                        borderRadius: 8,
                        border: form.scheme === s && s !== '' ? '2px solid var(--accent-teal)' : '1.5px solid var(--border)',
                        background: form.scheme === s && s !== ''
                          ? 'var(--accent-teal-light)'
                          : s === '' ? 'var(--bg-body)' : 'white',
                        color: form.scheme === s && s !== '' ? 'var(--accent-teal)' : 'var(--text-secondary)',
                        fontWeight: form.scheme === s && s !== '' ? 700 : 500,
                        fontSize: 13,
                        cursor: 'pointer',
                        transition: 'all .15s',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {s === '' ? 'None' : s}
                    </button>
                  ))}
                </div>
                {form.scheme && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'linear-gradient(135deg,#fffbeb,#ecfdf5)', border: '1px solid #6ee7b7', borderRadius: 8, fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                    🏛️ {form.scheme} scheme selected — 80% discount will auto-apply when sold under this scheme
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Quantity in Stock *</label>
                  <input type="number" className="form-input" placeholder="0" min="0"
                    value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Price per Unit (₹) *</label>
                  <input type="number" className="form-input" placeholder="0.00" step="0.01" min="0"
                    value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Expiry Date *</label>
                  <input type="date" className="form-input"
                    value={form.expiry} onChange={e => setForm(p => ({ ...p, expiry: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reorder Threshold</label>
                  <input type="number" className="form-input" placeholder="e.g. 100" min="0"
                    value={form.threshold} onChange={e => setForm(p => ({ ...p, threshold: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Supplier</label>
                <select className="form-input form-select" value={form.supplier}
                  onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}>
                  <option value="">Select supplier</option>
                  <option>MedSupply Co.</option><option>PharmaDist Inc.</option>
                  <option>HealthWare LLC</option><option>BioPharm Solutions</option>
                  <option>GenericMed Corp</option><option>ClinicalPlus India</option>
                </select>
              </div>

              {error && <div className="add-form-error">{error}</div>}
            </div>
          )}

          {activeTab === 'scan' && (
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Point your camera at the barcode on the medicine packaging. The form will auto-fill once detected.
              </p>

              <div
                className={`scan-area${addScannerActive ? ' scan-active' : ''}`}
                ref={scanAreaRef}
                onClick={!addScannerActive ? startAddScan : undefined}
                style={{ aspectRatio: '4/3', cursor: 'pointer' }}
              >
                <video ref={videoRef} playsInline autoPlay muted
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'none' }} />
                <div className="scan-line" />
                <div className="scan-corners" />
                <div className="scan-corners-2" />
                {!addScannerActive && (
                  <div className="scan-placeholder" style={{ display: 'flex' }}>
                    <ScanBarcodeIcon size={48} stroke="#334155" />
                    <h4>Click to Start Camera</h4>
                    <p>Scan the barcode on the<br />medicine box or bottle</p>
                  </div>
                )}
              </div>

              <div className={`scan-status ${scanStatus.type}`} style={{ marginTop: 12 }}>
                {scanStatus.type === 'active' ? (
                  <><span className="pulse" /><span>{scanStatus.msg}</span></>
                ) : (
                  <><span>{scanStatus.type === 'found' ? '✅' : scanStatus.type === 'error' ? '❌' : '📷'}</span><span>{scanStatus.msg}</span></>
                )}
              </div>

              <div className="scan-btn-row" style={{ marginTop: 12 }}>
                {!addScannerActive ? (
                  <button className="scan-btn primary" onClick={startAddScan}>
                    <CameraIcon size={16} /> Open Camera
                  </button>
                ) : (
                  <button className="scan-btn secondary" onClick={stopAddScan}>
                    <StopIcon size={16} /> Stop
                  </button>
                )}
              </div>

              {scanResult && (
                <div style={{ marginTop: 16, padding: 14, background: 'linear-gradient(135deg,#f0fdfa,#e0f2fe)', border: `2px solid ${scanResult.type === 'existing' ? 'var(--accent-teal)' : 'var(--accent-orange)'}`, borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: scanResult.type === 'existing' ? 'var(--accent-teal)' : '#f59e0b', marginBottom: 6 }}>
                    {scanResult.type === 'existing' ? '✅ Barcode Scanned Successfully!' : '📦 New Barcode Captured!'}
                  </div>
                  {scanResult.type === 'existing' ? (
                    <div style={{ fontSize: 13 }}>
                      <b>{scanResult.name}</b> · {scanResult.category}
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Barcode: {scanResult.barcode} · ₹{scanResult.price} / {scanResult.unit} · Stock: {scanResult.stock}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13 }}>
                      <b>Barcode:</b> {scanResult.barcode}
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                        This barcode is not in the database yet. Fill in the medicine details to add it with this barcode.
                      </div>
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 10, width: '100%' }}
                    onClick={scanResult.type === 'existing' ? useScannedForAdd : useNewBarcodeForAdd}
                  >
                    {scanResult.type === 'existing' ? 'Use This Medicine → Fill Form' : 'Use This Barcode → Fill Details'}
                  </button>
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <label className="form-label">Or enter barcode manually</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" className="form-input" placeholder="Type barcode number..."
                    id="addManualBarcodeInput" />
                  <button className="btn btn-primary" onClick={() => {
                    const val = document.getElementById('addManualBarcodeInput')?.value?.trim();
                    if (val) handleAddBarcode(val);
                  }}>Look Up</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>{' '}
            Add to Inventory
          </button>
        </div>
      </div>
    </div>
  );
}
