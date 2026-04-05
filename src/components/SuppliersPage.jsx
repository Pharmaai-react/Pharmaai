import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';

const EMOJI_OPTIONS = ['💊', '🏥', '🧪', '🌿', '⚗️', '🔬', '💉', '🩺', '🧬', '📦', '🏭', '🔭'];
const BG_OPTIONS = [
  '#dbeafe', '#fef3c7', '#ede9fe', '#ccfbf1',
  '#fee2e2', '#e0f2fe', '#dcfce7', '#fce7f3',
];

const SEED_SUPPLIERS = [
  { id: 1, emoji: '💊', bg: '#dbeafe', name: 'MedSupply Co.', city: 'Mumbai', country: 'India', since: 2018, tags: ['Best Price', 'Verified'], orders: 142, rating: '4.8', contactName: 'Amit Sharma', phone: '+91 98765 43210', email: 'amit@medsupply.in', notes: '' },
  { id: 2, emoji: '🏥', bg: '#fef3c7', name: 'PharmaDist Inc.', city: 'Delhi', country: 'India', since: 2015, tags: ['Fast Delivery', 'Trusted'], orders: 98, rating: '4.6', contactName: 'Priya Patel', phone: '+91 87654 32109', email: 'priya@pharmadist.in', notes: '' },
  { id: 3, emoji: '🧪', bg: '#ede9fe', name: 'HealthWare LLC', city: 'Bangalore', country: 'India', since: 2020, tags: ['New', 'Affordable'], orders: 34, rating: '4.3', contactName: 'Ravi Kumar', phone: '+91 76543 21098', email: 'ravi@healthware.in', notes: '' },
  { id: 4, emoji: '🌿', bg: '#ccfbf1', name: 'BioPharm Solutions', city: 'Chennai', country: 'India', since: 2016, tags: ['Biologics', 'GMP Cert'], orders: 67, rating: '4.7', contactName: 'Sunita Rao', phone: '+91 65432 10987', email: 'sunita@biopharm.in', notes: '' },
  { id: 5, emoji: '⚗️', bg: '#fee2e2', name: 'GenericMed Corp', city: 'Hyderabad', country: 'India', since: 2012, tags: ['Generics', 'Bulk'], orders: 210, rating: '4.5', contactName: 'Mohan Reddy', phone: '+91 54321 09876', email: 'mohan@genericmed.in', notes: '' },
  { id: 6, emoji: '🔬', bg: '#e0f2fe', name: 'ClinicalPlus India', city: 'Pune', country: 'India', since: 2019, tags: ['Premium', 'ISO Cert'], orders: 51, rating: '4.9', contactName: 'Anita Desai', phone: '+91 43210 98765', email: 'anita@clinicalplus.in', notes: '' },
];

const EMPTY_FORM = {
  emoji: '💊', bg: '#dbeafe', name: '', city: '', country: 'India',
  since: new Date().getFullYear(), tags: '', contactName: '',
  phone: '', email: '', notes: '', rating: '5.0',
};


// ── Icons ────────────────────────────────────────────────────────────────────
function IconEdit() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function IconTrash() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>;
}
function IconUser() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function IconPhone() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.26a2 2 0 0 1 1.72-2.19l3-.28a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 6.29 6.29l1.12-1.12a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
}
function IconMail() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>;
}
function IconSearch() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function SuppliersPage({ onOpenModal, showNotification, currentUser }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load suppliers from Supabase
  useEffect(() => {
    if (!currentUser?.id) return;
    supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at')
      .then(({ data }) => setSuppliers(data || []));
  }, [currentUser?.id]);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase()) ||
    (s.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const totalOrders = suppliers.reduce((sum, s) => sum + (s.orders || 0), 0);
  const avgRating = suppliers.length
    ? (suppliers.reduce((sum, s) => sum + parseFloat(s.rating || 0), 0) / suppliers.length).toFixed(1)
    : '0.0';

  function openAdd() { setForm(EMPTY_FORM); setEditingId(null); setDrawerOpen(true); }
  function openEdit(s) {
    setForm({ ...s, tags: (s.tags || []).join(', ') });
    setEditingId(s.id);
    setDrawerOpen(true);
  }
  function closeDrawer() { setDrawerOpen(false); setEditingId(null); setForm(EMPTY_FORM); }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim()) {
      showNotification('⚠️ Supplier name and city are required.');
      return;
    }
    const tagsArr = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editingId !== null) {
      await supabase.from('suppliers').update({
        name: form.name, city: form.city, country: form.country,
        since: form.since, tags: tagsArr, contact_name: form.contactName,
        phone: form.phone, email: form.email, notes: form.notes,
        rating: parseFloat(form.rating) || 5.0, emoji: form.emoji, color: form.bg,
      }).eq('id', editingId);
      setSuppliers(prev => prev.map(s =>
        s.id === editingId ? { ...s, ...form, tags: tagsArr } : s
      ));
      showNotification(`✅ ${form.name} updated!`);
    } else {
      const { data } = await supabase
        .from('suppliers')
        .insert({
          user_id: currentUser.id,
          name: form.name, city: form.city, country: form.country,
          since: form.since, tags: tagsArr, contact_name: form.contactName,
          phone: form.phone, email: form.email, notes: form.notes,
          rating: parseFloat(form.rating) || 5.0,
          orders: 0, emoji: form.emoji, color: form.bg,
        })
        .select().single();
      if (data) setSuppliers(prev => [data, ...prev]);
      showNotification(`✅ ${form.name} added to suppliers!`);
    }
    closeDrawer();
  }

  async function handleDelete(id) {
    const name = suppliers.find(s => s.id === id)?.name;
    await supabase.from('suppliers').delete().eq('id', id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setDeleteConfirm(null);
    showNotification(`🗑️ ${name} removed.`);
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Suppliers</h1>
          <p>Manage your pharmaceutical supplier network</p>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="supplier-stats-bar">
        <div className="supplier-stat-pill">
          <span className="pill-label">Total Suppliers</span>
          <span className="pill-value">{suppliers.length}</span>
        </div>
        <div className="supplier-stat-pill">
          <span className="pill-label">Total Orders</span>
          <span className="pill-value">{totalOrders.toLocaleString()}</span>
        </div>
        <div className="supplier-stat-pill">
          <span className="pill-label">Avg Rating</span>
          <span className="pill-value">⭐ {avgRating}</span>
        </div>
        <div className="supplier-search-wrap">
          <span className="supplier-search-icon"><IconSearch /></span>
          <input
            className="supplier-search-input"
            type="text"
            placeholder="Search by name, city, tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid / Empty state */}
      {filtered.length === 0 ? (
        <div className="supplier-empty">
          <div className="supplier-empty-icon">🔍</div>
          <h3>No suppliers found</h3>
          <p>{search ? `No results for "${search}"` : 'Add your first supplier to get started.'}</p>
          {!search && <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>}
        </div>
      ) : (
        <div className="supplier-grid">
          {filtered.map(s => (
            <div key={s.id} className="supplier-card">
              <div className="supplier-card-top">
                <div className="supplier-logo" style={{ background: s.bg }}>{s.emoji}</div>
                <div className="supplier-card-actions">
                  <button className="supplier-icon-btn" title="Edit" onClick={() => openEdit(s)}><IconEdit /></button>
                  <button className="supplier-icon-btn danger" title="Delete" onClick={() => setDeleteConfirm(s.id)}><IconTrash /></button>
                </div>
              </div>
              <div className="supplier-name">{s.name}</div>
              <div className="supplier-meta">{s.city}, {s.country} · Since {s.since}</div>
              <div style={{ marginBottom: 10 }}>
                {(s.tags || []).map(t => <span key={t} className="supplier-tag">{t}</span>)}
              </div>
              {s.contactName && (
                <div className="supplier-contact-info">
                  <div className="contact-row"><IconUser /> {s.contactName}</div>
                  {s.phone && <div className="contact-row"><IconPhone /> {s.phone}</div>}
                  {s.email && <div className="contact-row"><IconMail /> {s.email}</div>}
                </div>
              )}
              {s.notes && <div className="supplier-notes">{s.notes}</div>}
              <div className="supplier-stat">
                <span>Orders: <b>{s.orders}</b></span>
                <span>Rating: <b>⭐ {s.rating}</b></span>
                <span>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '5px 12px', fontSize: 11 }}
                    onClick={() => onOpenModal('reorder', s.name)}
                  >
                    📋 Order
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation overlay */}
      {deleteConfirm !== null && (
        <div className="supplier-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="delete-confirm-icon">🗑️</div>
            <h3>Remove Supplier?</h3>
            <p>
              This will permanently remove&nbsp;
              <b>{suppliers.find(s => s.id === deleteConfirm)?.name}</b>&nbsp;
              from your network.
            </p>
            <div className="delete-confirm-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit drawer */}
      {drawerOpen && (
        <div className="supplier-overlay" onClick={closeDrawer}>
          <div className="supplier-drawer" onClick={e => e.stopPropagation()}>
            <div className="supplier-drawer-header">
              <h2>{editingId !== null ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button className="drawer-close" onClick={closeDrawer}>✕</button>
            </div>

            <form className="supplier-drawer-body" onSubmit={handleSubmit}>
              {/* Icon + Color */}
              <div className="drawer-section-title">Icon &amp; Colour</div>
              <div className="emoji-picker-row">
                <div className="emoji-options">
                  {EMOJI_OPTIONS.map(em => (
                    <button
                      type="button" key={em}
                      className={`emoji-opt${form.emoji === em ? ' selected' : ''}`}
                      style={{ background: form.bg }}
                      onClick={() => setForm(f => ({ ...f, emoji: em }))}
                    >{em}</button>
                  ))}
                </div>
                <div className="color-options">
                  {BG_OPTIONS.map(bg => (
                    <button
                      type="button" key={bg}
                      className={`color-opt${form.bg === bg ? ' selected' : ''}`}
                      style={{ background: bg }}
                      onClick={() => setForm(f => ({ ...f, bg }))}
                    />
                  ))}
                </div>
              </div>

              {/* Supplier details */}
              <div className="drawer-section-title">Supplier Details</div>
              <div className="drawer-form-grid">
                <div className="form-group">
                  <label className="form-label">Supplier Name *</label>
                  <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. MedSupply Co." required />
                </div>
                <div className="form-group">
                  <label className="form-label">Since Year</label>
                  <input className="form-input" name="since" type="number" min="1900" max={new Date().getFullYear()} value={form.since} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input className="form-input" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Mumbai" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input className="form-input" name="country" value={form.country} onChange={handleChange} placeholder="e.g. India" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Tags / Specialties <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                <input className="form-input" name="tags" value={form.tags} onChange={handleChange} placeholder="e.g. Verified, Fast Delivery, Generics" />
              </div>

              {/* Contact info */}
              <div className="drawer-section-title">Contact Information</div>
              <div className="drawer-form-grid">
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input className="form-input" name="contactName" value={form.contactName} onChange={handleChange} placeholder="e.g. Amit Sharma" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="contact@supplier.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Rating (out of 5)</label>
                <input className="form-input" name="rating" type="number" step="0.1" min="0" max="5" value={form.rating} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Additional notes..." style={{ resize: 'vertical' }} />
              </div>

              <div className="supplier-drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={closeDrawer}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingId !== null ? 'Save Changes' : '+ Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
