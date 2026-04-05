import { useState } from 'react';
import { CloseIcon } from '../Icons.jsx';

const PRIORITIES = [
  { value: 'urgent',   label: '🚨 Urgent (24–48 h delivery)' },
  { value: 'standard', label: '📦 Standard (3–5 business days)' },
  { value: 'economy',  label: '🐢 Economy (7–10 business days)' },
];

export default function ReorderModal({ isOpen, onClose, onPlace, supplierName, suppliers = [], medicineList = [] }) {
  const [form, setForm] = useState({
    medication: '',
    quantity: 100,
    supplier: supplierName || '',
    priority: 'standard',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  // Use props if set, otherwise let user pick
  const presetSupplier = supplierName || '';

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handlePlace() {
    if (!form.medication.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm({ medication: '', quantity: 100, supplier: presetSupplier, priority: 'standard', notes: '' });
      onPlace({ ...form });
    }, 1200);
  }

  // Supplier list for dropdown — deduplicate
  const supplierOptions = suppliers.length
    ? suppliers.map(s => s.name)
    : ['MedSupply Co.', 'PharmaDist Inc.', 'HealthWare LLC', 'BioPharm Solutions', 'GenericMed Corp', 'ClinicalPlus India'];

  return (
    <div
      className="modal-overlay active"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)', color: 'white' }}>
          <h3 className="modal-title" style={{ color: 'white' }}>
            📋 Place Purchase Order
            {presetSupplier && (
              <span style={{
                marginLeft: 10, fontSize: 12, fontWeight: 500, opacity: 0.85,
                background: 'rgba(255,255,255,.15)', borderRadius: 6, padding: '2px 8px',
              }}>
                {presetSupplier}
              </span>
            )}
          </h3>
          <button className="modal-close" onClick={onClose} style={{ color: 'white' }}>
            <CloseIcon size={16} />
          </button>
        </div>

        {submitted ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '48px 24px', gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18 }}>Order Placed!</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Your order for <b>{form.medication}</b> has been sent to <b>{form.supplier}</b>.
              Expected delivery based on <b>{PRIORITIES.find(p => p.value === form.priority)?.label.split(' (')[1]?.replace(')', '') || 'selected priority'}</b>.
            </p>
          </div>
        ) : (
          <>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

              {/* Medication */}
              <div className="form-group">
                <label className="form-label">Medication / Item *</label>
                {medicineList.length > 0 ? (
                  <select className="form-input form-select" name="medication" value={form.medication} onChange={handleChange}>
                    <option value="">— Select medication —</option>
                    {medicineList.map(m => (
                      <option key={m.name} value={m.name}>
                        {m.name} (Stock: {m.quantity ?? m.stock ?? 0} units)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text" className="form-input" name="medication"
                    value={form.medication} onChange={handleChange}
                    placeholder="e.g. Insulin Glargine 100 IU/mL"
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Quantity */}
                <div className="form-group">
                  <label className="form-label">Order Quantity</label>
                  <input
                    type="number" className="form-input" name="quantity"
                    min="1" value={form.quantity} onChange={handleChange}
                  />
                </div>
                {/* Priority */}
                <div className="form-group">
                  <label className="form-label">Delivery Priority</label>
                  <select className="form-input form-select" name="priority" value={form.priority} onChange={handleChange}>
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Supplier */}
              <div className="form-group">
                <label className="form-label">Supplier</label>
                {presetSupplier ? (
                  <input type="text" className="form-input" value={presetSupplier} readOnly
                    style={{ background: 'var(--accent-teal-light)', borderColor: 'var(--accent-teal)', fontWeight: 600 }}
                  />
                ) : (
                  <select className="form-input form-select" name="supplier" value={form.supplier} onChange={handleChange}>
                    <option value="">— Select supplier —</option>
                    {supplierOptions.map(s => <option key={s}>{s}</option>)}
                  </select>
                )}
              </div>

              {/* Estimated cost preview */}
              <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 16px', marginTop: 4,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Order Summary
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>Item</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{form.medication || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  <span>Quantity</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{form.quantity} units</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  <span>Supplier</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-teal)' }}>{form.supplier || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  <span>Priority</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {PRIORITIES.find(p => p.value === form.priority)?.label || '—'}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginTop: 4 }}>
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-input" name="notes" rows={2}
                  value={form.notes} onChange={handleChange}
                  placeholder="Any special instructions for this order..."
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handlePlace}
                disabled={!form.medication.trim()}
                style={{ opacity: form.medication.trim() ? 1 : 0.5 }}
              >
                📤 Place Order
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
