import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';

const EMOJI_OPTIONS = ['💊', '🏥', '🧪', '🌿', '⚗️', '🔬', '💉', '🩺', '🧬', '📦', '🏭', '🔭'];
const COLOR_OPTIONS = [
  '#dbeafe', '#fef3c7', '#ede9fe', '#ccfbf1',
  '#fee2e2', '#e0f2fe', '#dcfce7', '#fce7f3',
];

const SEED_SUPPLIERS = [
  { emoji: '💊', color: '#dbeafe', name: 'MedSupply Co.',      contact: 'Amit Sharma',  phone: '+91 98765 43210', email: 'amit@medsupply.in',     address: 'Mumbai, India',     orders: 142, rating: 4.8 },
  { emoji: '🏥', color: '#fef3c7', name: 'PharmaDist Inc.',    contact: 'Priya Patel',  phone: '+91 87654 32109', email: 'priya@pharmadist.in',   address: 'Delhi, India',      orders: 98,  rating: 4.6 },
  { emoji: '🧪', color: '#ede9fe', name: 'HealthWare LLC',     contact: 'Ravi Kumar',   phone: '+91 76543 21098', email: 'ravi@healthware.in',    address: 'Bangalore, India',  orders: 34,  rating: 4.3 },
  { emoji: '🌿', color: '#ccfbf1', name: 'BioPharm Solutions', contact: 'Sunita Rao',   phone: '+91 65432 10987', email: 'sunita@biopharm.in',    address: 'Chennai, India',    orders: 67,  rating: 4.7 },
  { emoji: '⚗️', color: '#fee2e2', name: 'GenericMed Corp',    contact: 'Mohan Reddy',  phone: '+91 54321 09876', email: 'mohan@genericmed.in',   address: 'Hyderabad, India',  orders: 210, rating: 4.5 },
  { emoji: '🔬', color: '#e0f2fe', name: 'ClinicalPlus India', contact: 'Anita Desai',  phone: '+91 43210 98765', email: 'anita@clinicalplus.in', address: 'Pune, India',       orders: 51,  rating: 4.9 },
];

const EMPTY_FORM = {
  emoji: '💊', color: '#dbeafe',
  name: '', contact: '', phone: '', email: '', address: '', rating: '5.0',
};

// ── Icons ─────────────────────────────────────────────────────────────────────
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
function IconMapPin() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
}
function IconSearch() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SuppliersPage({ onOpenModal, showNotification, currentUser }) {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch]       = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading]       = useState(true);

  // ── Load from Supabase; seed default suppliers on first use ──────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at');

      if (error) {
        console.warn('[suppliers] load error:', error.message);
        showNotification('⚠️ Could not load suppliers: ' + error.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        // Seed default suppliers on first login
        const seeds = SEED_SUPPLIERS.map(s => ({ user_id: currentUser.id, ...s }));
        const { data: seeded, error: seedErr } = await supabase
          .from('suppliers').insert(seeds).select();
        if (seedErr) {
          console.warn('[suppliers] seed error:', seedErr.message);
        }
        setSuppliers(seeded || []);
      } else {
        setSuppliers(data);
      }
      setLoading(false);
    })();
  }, [currentUser?.id]);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase()) ||
    s.contact?.toLowerCase().includes(search.toLowerCase())
  );

  const totalOrders = suppliers.reduce((sum, s) => sum + (s.orders || 0), 0);
  const avgRating   = suppliers.length
    ? (suppliers.reduce((sum, s) => sum + parseFloat(s.rating || 0), 0) / suppliers.length).toFixed(1)
    : '0.0';

  // ── Drawer helpers ─────────────────────────────────────────────────────────
  function openAdd() { setForm(EMPTY_FORM); setEditingId(null); setDrawerOpen(true); }
  function openEdit(s) {
    setForm({
      emoji:   s.emoji   || '💊',
      color:   s.color   || '#dbeafe',
      name:    s.name    || '',
      contact: s.contact || '',
      phone:   s.phone   || '',
      email:   s.email   || '',
      address: s.address || '',
      rating:  String(s.rating ?? '5.0'),
    });
    setEditingId(s.id);
    setDrawerOpen(true);
  }
  function closeDrawer() { setDrawerOpen(false); setEditingId(null); setForm(EMPTY_FORM); }
  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  // ── Submit (add / update) ──────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      showNotification('⚠️ Supplier name is required.');
      return;
    }

    const payload = {
      name:    form.name.trim(),
      contact: form.contact.trim(),
      phone:   form.phone.trim(),
      email:   form.email.trim(),
      address: form.address.trim(),
      rating:  parseFloat(form.rating) || 5.0,
      emoji:   form.emoji,
      color:   form.color,
    };

    if (editingId !== null) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', editingId);
      if (error) { showNotification('❌ Update failed: ' + error.message); return; }
      setSuppliers(prev => prev.map(s => s.id === editingId ? { ...s, ...payload } : s));
      showNotification(`✅ ${form.name} updated!`);
    } else {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ user_id: currentUser.id, ...payload, orders: 0 })
        .select().single();
      if (error) { showNotification('❌ Add failed: ' + error.message); return; }
      if (data) setSuppliers(prev => [data, ...prev]);
      showNotification(`✅ ${form.name} added!`);
    }
    closeDrawer();
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    const name = suppliers.find(s => s.id === id)?.name;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) { showNotification('❌ Delete failed: ' + error.message); return; }
    setSuppliers(prev => prev.filter(s => s.id !== id));
    setDeleteConfirm(null);
    showNotification(`🗑️ ${name} removed.`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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
            placeholder="Search by name, address, contact..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid / Empty / Loading */}
      {loading ? (
        <div className="supplier-empty">
          <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
          <h3>Loading suppliers...</h3>
        </div>
      ) : filtered.length === 0 ? (
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
                <div className="supplier-logo" style={{ background: s.color || '#dbeafe' }}>
                  {s.emoji || '💊'}
                </div>
                <div className="supplier-card-actions">
                  <button className="supplier-icon-btn" title="Edit" onClick={() => openEdit(s)}><IconEdit /></button>
                  <button className="supplier-icon-btn danger" title="Delete" onClick={() => setDeleteConfirm(s.id)}><IconTrash /></button>
                </div>
              </div>

              <div className="supplier-name">{s.name}</div>

              {/* Contact details */}
              <div className="supplier-contact-info" style={{ marginTop: 8 }}>
                {s.contact && <div className="contact-row"><IconUser /> {s.contact}</div>}
                {s.phone   && <div className="contact-row"><IconPhone /> {s.phone}</div>}
                {s.email   && <div className="contact-row"><IconMail /> {s.email}</div>}
                {s.address && <div className="contact-row"><IconMapPin /> {s.address}</div>}
              </div>

              <div className="supplier-stat" style={{ marginTop: 12 }}>
                <span>Orders: <b>{s.orders ?? 0}</b></span>
                <span>Rating: <b>⭐ {s.rating ?? '—'}</b></span>
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
                      style={{ background: form.color }}
                      onClick={() => setForm(f => ({ ...f, emoji: em }))}
                    >{em}</button>
                  ))}
                </div>
                <div className="color-options">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      type="button" key={c}
                      className={`color-opt${form.color === c ? ' selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                    />
                  ))}
                </div>
              </div>

              {/* Supplier details */}
              <div className="drawer-section-title">Supplier Details</div>
              <div className="form-group">
                <label className="form-label">Supplier Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. MedSupply Co." required />
              </div>
              <div className="form-group">
                <label className="form-label">Address / Location</label>
                <input className="form-input" name="address" value={form.address} onChange={handleChange} placeholder="e.g. Mumbai, India" />
              </div>

              {/* Contact info */}
              <div className="drawer-section-title">Contact Information</div>
              <div className="drawer-form-grid">
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input className="form-input" name="contact" value={form.contact} onChange={handleChange} placeholder="e.g. Amit Sharma" />
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
