import { CloseIcon } from '../Icons.jsx';

function printReceipt(content) {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<html><head><title>Receipt</title><style>
body{font-family:sans-serif;margin:0;padding:20px;}
.receipt-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;}
.receipt-row.total{font-weight:700;font-size:15px;}
.receipt-header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px dashed #ccc;}
.receipt-footer{text-align:center;margin-top:14px;padding-top:12px;border-top:2px dashed #ccc;font-size:11px;color:#999;}
.receipt-logo{font-size:20px;font-weight:700;color:#0d9488;}
</style></head><body>${content}</body></html>`);
  w.document.close();
  w.print();
}

export default function ReceiptModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const { txnId, patient, items, subtotal, gst, discount, discAmt, total, time, payment, date, govtScheme } = data;
  const dateStr = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const receiptHTML = `
<div class="receipt">
  <div class="receipt-header">
    <div class="receipt-logo">💊 PharmaAI</div>
    <div class="receipt-sub">Smart Pharmacy</div>
    ${govtScheme ? `<div style="display:inline-block;margin-top:6px;background:#059669;color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;">🏛️ ${govtScheme} Scheme</div>` : ''}
    <div style="font-size:11px;color:#94a3b8;margin-top:6px;">${dateStr} · ${time}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px;">TXN: ${txnId}</div>
  </div>
  <div class="receipt-row"><span>Patient</span><span>${patient}</span></div>
  <div class="receipt-row"><span>Payment</span><span>${payment}</span></div>
  <div style="border-top:1px dashed #e2e8f0;margin:10px 0;padding-top:10px;">
    ${items.map(i => `<div class="receipt-row"><span>${i.name} × ${i.qty}${govtScheme ? ` <span style="font-size:10px;background:#059669;color:white;padding:1px 5px;border-radius:6px;">${govtScheme}</span>` : ''}</span><span>₹${govtScheme ? (i.price * i.qty * 0.20).toFixed(2) : (i.price * i.qty).toFixed(2)}</span></div>`).join('')}
  </div>
  <div class="receipt-row" style="border-top:1px dashed #e2e8f0;padding-top:10px;"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
  <div class="receipt-row"><span>GST (18%)</span><span>₹${gst.toFixed(2)}</span></div>
  ${govtScheme ? `<div class="receipt-row" style="color:#059669;font-weight:600;"><span>🏛️ ${govtScheme} Discount (80%)</span><span>−₹${(subtotal * 0.80).toFixed(2)}</span></div>` : ''}
  ${discount > (govtScheme ? 80 : 0) ? `<div class="receipt-row"><span>Extra Discount (${discount - (govtScheme ? 80 : 0)}%)</span><span>−₹${(subtotal * (discount - (govtScheme ? 80 : 0)) / 100).toFixed(2)}</span></div>` : ''}
  <div class="receipt-row total"><span>TOTAL</span><span>₹${total.toFixed(2)}</span></div>
  <div class="receipt-footer">Thank you for choosing PharmaAI!</div>
</div>`;

  return (
    <div className={`modal-overlay${isOpen ? ' active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3 className="modal-title">🧾 Sale Receipt</h3>
          <button className="modal-close" onClick={onClose}><CloseIcon size={16} /></button>
        </div>
        <div className="modal-body" dangerouslySetInnerHTML={{ __html: receiptHTML }} />
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => printReceipt(receiptHTML)}>🖨️ Print</button>
        </div>
      </div>
    </div>
  );
}
