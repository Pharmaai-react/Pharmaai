export default function SuppliersPage({ onOpenModal, showNotification }) {
  const suppliers = [
    { emoji: '💊', bg: '#dbeafe', name: 'MedSupply Co.', meta: 'Mumbai, India · Since 2018', tags: ['Best Price', 'Verified'], orders: 142, rating: '4.8' },
    { emoji: '🏥', bg: '#fef3c7', name: 'PharmaDist Inc.', meta: 'Delhi, India · Since 2015', tags: ['Fast Delivery', 'Trusted'], orders: 98, rating: '4.6' },
    { emoji: '🧪', bg: '#ede9fe', name: 'HealthWare LLC', meta: 'Bangalore, India · Since 2020', tags: ['New', 'Affordable'], orders: 34, rating: '4.3' },
    { emoji: '🌿', bg: '#ccfbf1', name: 'BioPharm Solutions', meta: 'Chennai, India · Since 2016', tags: ['Biologics', 'GMP Cert'], orders: 67, rating: '4.7' },
    { emoji: '⚗️', bg: '#fee2e2', name: 'GenericMed Corp', meta: 'Hyderabad, India · Since 2012', tags: ['Generics', 'Bulk'], orders: 210, rating: '4.5' },
    { emoji: '🔬', bg: '#e0f2fe', name: 'ClinicalPlus India', meta: 'Pune, India · Since 2019', tags: ['Premium', 'ISO Cert'], orders: 51, rating: '4.9' },
  ];

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Suppliers</h1>
          <p>Manage your pharmaceutical supplier network</p>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={() => showNotification('Add Supplier form coming soon!')}>
            + Add Supplier
          </button>
        </div>
      </header>

      <div className="supplier-grid">
        {suppliers.map((s, idx) => (
          <div key={idx} className="supplier-card">
            <div className="supplier-logo" style={{ background: s.bg }}>{s.emoji}</div>
            <div className="supplier-name">{s.name}</div>
            <div className="supplier-meta">{s.meta}</div>
            <div>
              {s.tags.map(t => <span key={t} className="supplier-tag">{t}</span>)}
            </div>
            <div className="supplier-stat">
              <span>Orders: <b>{s.orders}</b></span>
              <span>Rating: <b>⭐ {s.rating}</b></span>
              <span>
                <button
                  className="btn btn-primary"
                  style={{ padding: '5px 10px', fontSize: 11 }}
                  onClick={() => onOpenModal('reorder')}
                >
                  Order
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
