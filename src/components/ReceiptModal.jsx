import { CloseIcon } from '../Icons.jsx';

function printReceipt(content) {
  // Try popup approach first
  const w = window.open('', '_blank', 'width=420,height=650');
  if (w) {
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
*{box-sizing:border-box;}
body{font-family:'Segoe UI',sans-serif;margin:0;padding:24px;color:#1e293b;}
.receipt-row{display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid #f1f5f9;}
.receipt-row.total{font-weight:700;font-size:16px;border-bottom:none;margin-top:6px;color:#0d9488;}
.receipt-header{text-align:center;margin-bottom:16px;padding-bottom:14px;border-bottom:2px dashed #cbd5e1;}
.receipt-footer{text-align:center;margin-top:16px;padding-top:12px;border-top:2px dashed #cbd5e1;font-size:11px;color:#94a3b8;}
.receipt-logo{font-size:22px;font-weight:800;color:#0d9488;letter-spacing:-0.5px;}
@media print{body{padding:0;}}
</style></head><body>${content}</body></html>`);
    w.document.close();
    // Wait for full load before triggering print dialog
    w.onload = () => { w.focus(); w.print(); };
    // Fallback: some browsers fire onload before write() completes
    setTimeout(() => { try { if (!w.closed) { w.focus(); w.print(); } } catch {} }, 800);
    return;
  }

  // Popup blocked — CSS print fallback using a hidden div in the current page
  const existing = document.getElementById('__pharmaai_print_frame');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = '__pharmaai_print_frame';
  div.innerHTML = content;
  div.style.cssText = 'position:fixed;inset:0;background:white;z-index:99999;padding:24px;overflow:auto;';
  document.body.appendChild(div);
  const style = document.createElement('style');
  style.innerHTML = `@media screen { #__pharmaai_print_frame { display: block; } }
  @media print { body > *:not(#__pharmaai_print_frame) { display: none !important; } }`;
  document.head.appendChild(style);
  window.print();
  // Clean up after print dialog closes
  setTimeout(() => { div.remove(); style.remove(); }, 2000);
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
