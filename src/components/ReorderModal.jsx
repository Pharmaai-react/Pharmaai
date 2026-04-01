import { CloseIcon } from '../Icons.jsx';

export default function ReorderModal({ isOpen, onClose, onPlace }) {
  if (!isOpen) return null;
  return (
    <div className={`modal-overlay${isOpen ? ' active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Quick Reorder</h3>
          <button className="modal-close" onClick={onClose}><CloseIcon size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Medication</label>
            <input type="text" className="form-input" defaultValue="Insulin Glargine" readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Current Stock</label>
            <input type="text" className="form-input" defaultValue="45 units" readOnly
              style={{ background: '#fee2e2', borderColor: '#fca5a5', color: '#b91c1c' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Suggested Order Quantity (AI Recommended)</label>
            <input type="number" className="form-input" defaultValue="500" />
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <select className="form-input form-select">
              <option>MedSupply Co. - Best Price</option>
              <option>PharmaDist Inc. - Faster Delivery</option>
              <option>HealthWare LLC</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-input form-select">
              <option>Urgent (24-48h delivery)</option>
              <option>Standard (3-5 business days)</option>
              <option>Economy (7-10 business days)</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onPlace}>Place Order</button>
        </div>
      </div>
    </div>
  );
}
