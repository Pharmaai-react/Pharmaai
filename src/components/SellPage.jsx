import { useState, useRef, useEffect, useCallback } from 'react';
import { QRIcon, CameraIcon, StopIcon, FlipIcon, ScanBarcodeIcon, PillIcon, CartIcon, TrashIcon, CheckIcon } from '../Icons.jsx';

export default function SellPage({ medicineDB, onNavigate, showNotification, onSaleComplete, salesHistory = [], preloadItem, onPreloadConsumed, currentUser }) {
  const [cart, setCart] = useState([]);
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const [scannedQty, setScannedQty] = useState(1);
  const [scanStatus, setScanStatus] = useState({ type: 'idle', msg: 'Camera not started — click the scan area or the button below' });
  const [scanningActive, setScanningActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discount, setDiscount] = useState(0);
  const [govtScheme, setGovtScheme] = useState(''); // '' | 'RGHS' | 'Chiranjeevi'
  // FEFO warning state
  const [fefoWarning, setFefoWarning] = useState(null); // { scanned, preferred }
  // Batch-picker: shown when same barcode has multiple expiry-date batches
  const [batchPickerBatches, setBatchPickerBatches] = useState(null); // Array<med> | null

  const videoRef = useRef(null);
  const scanAreaRef = useRef(null);
  const codeReaderRef = useRef(null);
  const availableCamerasRef = useRef([]);
  const currentCamIndexRef = useRef(0);
  const streamRef = useRef(null);
  // Track camera count in state so the Flip button re-renders when cameras are discovered
  const [cameraCount, setCameraCount] = useState(0);

  /**
   * FEFO check: find same-name batches with earlier (sooner) expiry that still have stock.
   * Returns the earliest-expiry alternative, or null if the scanned batch is already the soonest.
   */
  const findFefoViolation = useCallback((scannedMed) => {
    const sameName = medicineDB.filter(
      m => m.name.toLowerCase() === scannedMed.name.toLowerCase() &&
           m.barcode !== scannedMed.barcode &&
           m.stock > 0 &&
           m.expiry
    );
    if (!sameName.length) return null;
    const scannedExpiry = scannedMed.expiry ? new Date(scannedMed.expiry).getTime() : Infinity;
    const earlier = sameName
      .filter(m => new Date(m.expiry).getTime() < scannedExpiry)
      .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    return earlier.length ? earlier[0] : null;
  }, [medicineDB]);

  const selectBatch = useCallback((med) => {
    // FEFO enforcement after batch is chosen
    const preferredBatch = findFefoViolation(med);
    if (preferredBatch) {
      setFefoWarning({ scanned: med, preferred: preferredBatch });
      setScanStatus({ type: 'error', msg: '⚠️ FEFO violation — earlier batch must be sold first' });
      return;
    }
    setLastScannedItem(med);
    setScannedQty(1);
    setScanStatus({ type: 'found', msg: '✅ Found: ' + med.name });
  }, [findFefoViolation]);

  const handleScannedCode = useCallback((code) => {
    // Collect ALL inventory records whose barcode or name matches
    const matches = medicineDB.filter(
      m => m.barcode === code.trim() || m.name.toLowerCase().includes(code.toLowerCase())
    );
    if (!matches.length) {
      setScanStatus({ type: 'error', msg: '❌ Medicine not found: "' + code + '"' });
      showNotification('Medicine not found in database');
      return;
    }
    // Multiple distinct expiry dates for the same barcode → show picker
    const uniqueExpiries = [...new Set(matches.map(m => m.expiry))];
    if (uniqueExpiries.length > 1) {
      // Sort by expiry ascending (earliest first)
      const sorted = [...matches].sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
      setBatchPickerBatches(sorted);
      setScanStatus({ type: 'found', msg: '📦 ' + matches[0].name + ' — choose expiry batch below' });
      return;
    }
    // Single batch — proceed normally
    selectBatch(matches[0]);
  }, [medicineDB, showNotification, selectBatch]);

  // Wait for ZXing CDN script to finish loading (handles slow networks)
  const waitForZXing = () => new Promise((resolve) => {
    if (window.ZXing) { resolve(true); return; }
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (window.ZXing) { clearInterval(interval); resolve(true); }
      else if (tries > 40) { clearInterval(interval); resolve(false); } // give up after ~4s
    }, 100);
  });

  const startScan = useCallback(async () => {
    if (scanningActive) return;
    const video = videoRef.current;
    const area = scanAreaRef.current;
    if (!video || !area) return;
    video.style.removeProperty('display');
    setScanStatus({ type: 'active', msg: 'Loading scanner library...' });

    const zxingReady = await waitForZXing();

    try {
      if (zxingReady && window.ZXing) {
        // ZXing v0.18: hints map is the first arg, timeBetweenScansMillis is second
        const hints = new Map();
        hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
          window.ZXing.BarcodeFormat.EAN_13, window.ZXing.BarcodeFormat.EAN_8,
          window.ZXing.BarcodeFormat.CODE_128, window.ZXing.BarcodeFormat.CODE_39,
          window.ZXing.BarcodeFormat.QR_CODE, window.ZXing.BarcodeFormat.UPC_A,
          window.ZXing.BarcodeFormat.UPC_E
        ]);
        codeReaderRef.current = new window.ZXing.BrowserMultiFormatReader(hints, 300);
        const cameras = await codeReaderRef.current.listVideoInputDevices();
        availableCamerasRef.current = cameras;
        setCameraCount(cameras.length); // trigger re-render so Flip button appears
        if (!cameras.length) throw new Error('No cameras found');
        setScanningActive(true);
        area.classList.add('scan-active');
        setScanStatus({ type: 'active', msg: '📸 Camera active — point at a barcode or QR code' });
        await codeReaderRef.current.decodeFromVideoDevice(
          cameras[currentCamIndexRef.current].deviceId,
          video,
          (result, err) => {
            if (result) {
              handleScannedCode(result.getText());
              if (navigator.vibrate) navigator.vibrate(100);
            }
            // err here is just "not found yet" — ignore it, ZXing fires it continuously
          }
        );
      } else {
        throw new Error('ZXing library not available');
      }
    } catch (err) {
      console.warn('ZXing scanner error:', err.message);
      // Fallback: open camera only (no auto-decode)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
        streamRef.current = stream;
        video.srcObject = stream;
        video.style.display = 'block';
        if (area) area.classList.add('scan-active');
        setScanningActive(true);
        setScanStatus({ type: 'active', msg: '📸 Camera active — ZXing unavailable, use manual search below' });
      } catch {
        setScanStatus({ type: 'error', msg: '❌ Camera denied. Use manual search below.' });
        showNotification('Camera permission denied');
      }
    }
  }, [scanningActive, medicineDB, handleScannedCode, showNotification]);

  const stopScan = useCallback(() => {
    const video = videoRef.current;
    const area = scanAreaRef.current;
    if (codeReaderRef.current) { try { codeReaderRef.current.reset(); } catch {} codeReaderRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (video && video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
    setScanningActive(false);
    setCameraCount(0);
    if (area) area.classList.remove('scan-active');
    if (video) video.style.removeProperty('display');
    setScanStatus({ type: 'idle', msg: 'Camera stopped' });
  }, []);

  useEffect(() => {
    return () => { stopScan(); };
  }, [stopScan]);

  // Pre-load an item from Inventory page → add to cart immediately
  useEffect(() => {
    if (!preloadItem) return;
    // Find matching item in the live medicineDB (has current stock)
    const live = medicineDB.find(
      m => m.barcode === preloadItem.barcode || m.name === preloadItem.name
    );
    const target = live || preloadItem;
    if (target.stock <= 0) {
      showNotification('⚠️ ' + target.name + ' is out of stock');
    } else {
      addToCart(target, 1);
      showNotification('🛒 ' + target.name + ' added from Inventory');
    }
    if (onPreloadConsumed) onPreloadConsumed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadItem]);

  const switchCamera = async () => {
    const cameras = availableCamerasRef.current;
    if (!cameras.length || !codeReaderRef.current) return;

    // Advance to next camera index
    currentCamIndexRef.current = (currentCamIndexRef.current + 1) % cameras.length;
    const nextDeviceId = cameras[currentCamIndexRef.current].deviceId;

    try {
      // Must reset the existing decode session before starting a new one
      codeReaderRef.current.reset();

      // Small delay so the browser releases the previous stream
      await new Promise(r => setTimeout(r, 150));

      await codeReaderRef.current.decodeFromVideoDevice(
        nextDeviceId,
        videoRef.current,
        (result) => { if (result) handleScannedCode(result.getText()); }
      );
      showNotification('📸 Camera switched');
    } catch (err) {
      console.warn('Camera switch failed:', err);
      showNotification('⚠️ Could not switch camera');
    }
  };

  const handleSearch = (val) => {
    setSearchQuery(val);
    if (!val || val.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const results = medicineDB.filter(m =>
      m.name.toLowerCase().includes(val.toLowerCase()) || m.barcode.includes(val)
    ).slice(0, 6);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  };

  const selectResult = (barcode) => {
    setShowDropdown(false);
    setSearchQuery('');
    handleScannedCode(barcode);
  };

  const manualSearch = () => {
    setShowDropdown(false);
    if (!searchQuery) return;
    handleScannedCode(searchQuery);
    setSearchQuery('');
  };

  const addScannedToCart = () => {
    if (!lastScannedItem) return;
    if (scannedQty < 1) return showNotification('Quantity must be at least 1');
    if (scannedQty > lastScannedItem.stock) return showNotification('Only ' + lastScannedItem.stock + ' in stock!');
    addToCart(lastScannedItem, scannedQty);
    setLastScannedItem(null);
  };

  const addToCart = (med, qty = 1) => {
    // Unique cart key: barcode + expiry so different batches stay as separate line items
    const cartKey = (item) => item.barcode + '|' + (item.expiry || '');
    setCart(prev => {
      const existing = prev.find(i => cartKey(i) === cartKey(med));
      if (existing) {
        if (existing.qty + qty > med.stock) { showNotification('Cannot exceed stock limit (' + med.stock + ')'); return prev; }
        return prev.map(i => cartKey(i) === cartKey(med) ? { ...i, qty: i.qty + qty } : i);
      }
      return [...prev, { ...med, qty }];
    });
    showNotification(med.name + ' added to cart');
  };

  const changeQty = (idx, delta) => {
    setCart(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], qty: updated[idx].qty + delta };
      if (updated[idx].qty < 1) return prev.filter((_, i) => i !== idx);
      if (updated[idx].qty > updated[idx].stock) {
        showNotification('Maximum stock reached');
        updated[idx].qty = updated[idx].stock;
      }
      return updated;
    });
  };

  /** Format expiry as Month Year for display */
  const fmtExpiry = (expStr) => {
    if (!expStr) return 'No expiry';
    try { return new Date(expStr).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); } catch { return expStr; }
  };

  /** True if this batch has the earliest expiry among all batches of the same name */
  const isEarliestBatch = (batch, batches) => {
    if (!batch.expiry) return false;
    return batches.every(b => !b.expiry || new Date(batch.expiry) <= new Date(b.expiry));
  };

  const removeFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const clearCart = () => {
    setCart([]);
    setPatientName('');
    setDiscount(0);
    setGovtScheme('');
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const gst = subtotal * 0.18;
  // Government scheme gives 80% discount; manual discount adds on top
  const schemeDiscPct = govtScheme ? 80 : 0;
  const effectiveDiscPct = Math.min(100, schemeDiscPct + (parseFloat(discount) || 0));
  const discAmt = subtotal * effectiveDiscPct / 100;
  const total = subtotal + gst - discAmt;

  const completeSale = () => {
    if (!cart.length) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const txnId = 'TXN-' + Date.now().toString().slice(-6);
    const saleData = {
      txnId, patient: patientName || 'Walk-in Customer',
      items: [...cart], subtotal, gst,
      discount: effectiveDiscPct,
      govtScheme: govtScheme || null,
      discAmt, total, time: timeStr, payment: paymentMethod, date: now
    };
    // onSaleComplete handles inventory deduction, receipt modal, and sales history
    if (onSaleComplete) onSaleComplete(cart, { ...saleData, itemCount: cart.length });
    clearCart();
    showNotification('Sale completed! ₹' + total.toFixed(2) + ' — ' + paymentMethod);
  };

  return (
    <>
      {/* ── Batch Picker Modal (multiple expiry dates for same barcode) ── */}
      {batchPickerBatches && (
        <div className="modal-overlay active" onClick={() => setBatchPickerBatches(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', borderBottom: '2px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>📦</span>
                <div>
                  <h3 className="modal-title" style={{ color: '#1d4ed8', margin: 0 }}>Multiple Batches Found</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#3730a3' }}>
                    Same medicine has {batchPickerBatches.length} different expiry dates — choose a batch to sell
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {batchPickerBatches.map((batch, idx) => {
                const isEarliest = isEarliestBatch(batch, batchPickerBatches);
                const daysLeft = batch.expiry
                  ? Math.ceil((new Date(batch.expiry) - new Date()) / 86400000)
                  : null;
                const isExpired = daysLeft !== null && daysLeft <= 0;
                const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 90;
                return (
                  <button
                    key={batch.expiry + batch.barcode + idx}
                    onClick={() => {
                      setBatchPickerBatches(null);
                      selectBatch(batch);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: isEarliest ? '2px solid #ef4444' : '1.5px solid #e2e8f0',
                      background: isEarliest ? '#fff5f5' : '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all .15s',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    {/* Expiry badge */}
                    <div style={{
                      minWidth: 52, height: 52, borderRadius: 10,
                      background: isEarliest ? '#fee2e2' : '#eff6ff',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 20 }}>{isExpired ? '🚫' : isEarliest ? '🔴' : '🟢'}</span>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: isEarliest ? '#dc2626' : '#1e293b',
                      }}>
                        {batch.name}
                        {isEarliest && (
                          <span style={{
                            marginLeft: 8, fontSize: 10, fontWeight: 700,
                            background: '#dc2626', color: 'white',
                            padding: '2px 8px', borderRadius: 10, verticalAlign: 'middle',
                          }}>EARLIEST — SELL FIRST</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: isEarliest ? '#b91c1c' : '#64748b', marginTop: 3 }}>
                        Expires: <b style={{ color: isEarliest ? '#dc2626' : '#374151' }}>{fmtExpiry(batch.expiry)}</b>
                        {daysLeft !== null && (
                          <span style={{
                            marginLeft: 6,
                            color: isExpired ? '#dc2626' : isExpiringSoon ? '#f97316' : '#16a34a',
                            fontWeight: 600,
                          }}>
                            ({isExpired ? 'EXPIRED' : daysLeft + 'd left'})
                          </span>
                        )}
                        &nbsp;·&nbsp; Stock: <b>{batch.stock} {batch.unit}s</b>
                        &nbsp;·&nbsp; ₹{batch.price.toFixed(2)}
                      </div>
                    </div>
                    <span style={{ color: isEarliest ? '#dc2626' : '#94a3b8', fontSize: 18 }}>›</span>
                  </button>
                );
              })}
              <button
                className="btn btn-secondary"
                style={{ marginTop: 4 }}
                onClick={() => setBatchPickerBatches(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── FEFO Warning Modal ── */}
      {fefoWarning && (
        <div className="modal-overlay active" onClick={() => setFefoWarning(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg,#fff7ed,#fef3c7)', borderBottom: '2px solid #f97316' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>⚠️</span>
                <div>
                  <h3 className="modal-title" style={{ color: '#c2410c', margin: 0 }}>FEFO Violation Detected</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#92400e' }}>First Expired, First Out policy requires selling the earlier batch first</p>
                </div>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              {/* Scanned (wrong) batch */}
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  ❌ Scanned — Do Not Sell Yet
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{fefoWarning.scanned.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Barcode: {fefoWarning.scanned.barcode} &nbsp;·&nbsp;
                  Expires: <b style={{ color: '#dc2626' }}>
                    {new Date(fefoWarning.scanned.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </b>
                </div>
              </div>

              {/* Preferred (correct) batch */}
              <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  ✅ Sell This Batch First
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{fefoWarning.preferred.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  Barcode: {fefoWarning.preferred.barcode} &nbsp;·&nbsp;
                  Expires: <b style={{ color: '#16a34a' }}>
                    {new Date(fefoWarning.preferred.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </b>
                  &nbsp;·&nbsp; Stock: {fefoWarning.preferred.stock} {fefoWarning.preferred.unit}s
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const pref = fefoWarning.preferred;
                    setFefoWarning(null);
                    setLastScannedItem(pref);
                    setScannedQty(1);
                    setScanStatus({ type: 'found', msg: '✅ Switched to earlier batch: ' + pref.name });
                    showNotification('FEFO: Switched to earlier expiry batch — ' + new Date(pref.expiry).toLocaleDateString());
                  }}
                >
                  ✅ Use Correct Batch
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, borderColor: '#f97316', color: '#f97316' }}
                  onClick={() => {
                    const s = fefoWarning.scanned;
                    setFefoWarning(null);
                    setLastScannedItem(s);
                    setScannedQty(1);
                    setScanStatus({ type: 'found', msg: '⚠️ Override: ' + s.name + ' (FEFO bypassed)' });
                    showNotification('⚠️ FEFO override — earlier batch should be sold first');
                  }}
                >
                  ⚡ Override (not recommended)
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10, textAlign: 'center' }}>
                Selling expired or near-expiry medicines first reduces waste and ensures patient safety.
              </p>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-left">
          <h1>💊 Sell Medicines</h1>
          <p>Scan barcodes or search to add items to cart</p>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={() => onNavigate('reports')}>View Sales History</button>
        </div>
      </header>

      <div className="sell-layout">
        {/* LEFT */}
        <div className="sell-left">
          {/* Scanner Card */}
          <div className="scanner-card">
            <div className="scanner-header">
              <QRIcon size={22} />
              <div>
                <h3>Barcode / QR Scanner</h3>
                <p>Point camera at medicine barcode or QR code</p>
              </div>
            </div>
            <div className="scanner-body">
              <div
                className={`scan-area${scanningActive ? ' scan-active' : ''}`}
                ref={scanAreaRef}
                onClick={!scanningActive ? startScan : undefined}
              >
                <video ref={videoRef} className="scan-video" playsInline autoPlay muted />
                <div className="scan-line" />
                <div className="scan-corners" />
                <div className="scan-corners-2" />
                {!scanningActive && (
                  <div className="scan-placeholder">
                    <ScanBarcodeIcon size={56} stroke="#334155" />
                    <h4>Click to Start Camera</h4>
                    <p>Camera will open to scan barcodes<br />on medicine packaging</p>
                  </div>
                )}
              </div>

              <div className={`scan-status ${scanStatus.type}`}>
                {scanStatus.type === 'active' ? (
                  <><span className="pulse" /><span>{scanStatus.msg}</span></>
                ) : (
                  <><span>{scanStatus.type === 'found' ? '✅' : scanStatus.type === 'error' ? '❌' : '📷'}</span><span>{scanStatus.msg}</span></>
                )}
              </div>

              <div className="scan-btn-row">
                {!scanningActive ? (
                  <button className="scan-btn primary" onClick={startScan}>
                    <CameraIcon size={16} /> Open Camera
                  </button>
                ) : (
                  <>
                    <button className="scan-btn secondary" onClick={stopScan}>
                      <StopIcon size={16} /> Stop Camera
                    </button>
                    {cameraCount > 1 && (
                      <button className="scan-btn secondary" onClick={switchCamera}>
                        <FlipIcon size={16} /> Flip
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Manual search */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <label className="form-label">Or search / enter barcode manually</label>
                <div className="manual-search">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Type medicine name or barcode..."
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    onKeyPress={e => { if (e.key === 'Enter') manualSearch(); }}
                  />
                  <button className="btn btn-primary" onClick={manualSearch}>Search</button>
                </div>
                <div className={`search-dropdown${showDropdown ? ' open' : ''}`}>
                  {searchResults.map((m, idx) => {
                    // Check if this medicine has sibling batches (same name, diff expiry) in results
                    const siblings = searchResults.filter(s => s.name.toLowerCase() === m.name.toLowerCase());
                    const isEarliest = siblings.length > 1 && isEarliestBatch(m, siblings);
                    return (
                      <div
                        key={m.barcode + '|' + (m.expiry || idx)}
                        className="search-dropdown-item"
                        onClick={() => selectResult(m.barcode)}
                        style={{ borderLeft: isEarliest ? '3px solid #ef4444' : undefined }}
                      >
                        <div className="item-name" style={{ color: isEarliest ? '#dc2626' : undefined }}>
                          {m.name}
                          {m.expiry && <span style={{ marginLeft: 6, fontSize: 11, color: isEarliest ? '#dc2626' : '#64748b' }}>exp {fmtExpiry(m.expiry)}</span>}
                        </div>
                        <div className="item-meta">{m.category} · ₹{m.price.toFixed(2)} · Stock: {m.stock}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Last Scanned Item */}
          {lastScannedItem && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">✅ Last Scanned Item</h3>
              </div>
              <div className="card-body">
                <div className="scanned-item">
                  <div className="scanned-item-icon"><PillIcon size={22} stroke="white" /></div>
                  <div style={{ flex: 1 }}>
                    <div className="scanned-item-name">{lastScannedItem.name}</div>
                    <div className="scanned-item-meta">{lastScannedItem.category} · Barcode: {lastScannedItem.barcode}</div>
                    <div style={{ fontSize: 11, color: lastScannedItem.stock < 50 ? '#ef4444' : '#0d9488', marginTop: 2, fontWeight: 600 }}>
                      {lastScannedItem.stock < 50 ? '⚠️' : '✅'} Stock: {lastScannedItem.stock} {lastScannedItem.unit}s
                    </div>
                  </div>
                  <div className="scanned-item-price">
                    <div className="price">₹{lastScannedItem.price.toFixed(2)}</div>
                    <div className="stock-info">per {lastScannedItem.unit}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label className="form-label">Quantity</label>
                    <input
                      type="number" className="form-input"
                      value={scannedQty} min="1"
                      style={{ fontSize: 16, fontWeight: 700 }}
                      onChange={e => setScannedQty(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '10px 20px', fontSize: 14 }} onClick={addScannedToCart}>
                      Add to Cart
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '10px 14px' }} onClick={() => setLastScannedItem(null)}>✕</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Today's Sales */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Today's Sales</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{salesHistory.length} transaction{salesHistory.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Medicine</th><th>Qty</th><th>Amount</th><th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {salesHistory.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No sales recorded yet today</td></tr>
                  ) : salesHistory.map(s => (
                    <tr key={s.txnId}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{s.txnId}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.patient} · {s.payment}</div>
                      </td>
                      <td>{s.itemCount} item{s.itemCount !== 1 ? 's' : ''}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>₹{s.total.toFixed(2)}</td>
                      <td style={{ fontSize: 11, color: '#94a3b8' }}>{s.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div className="sell-right">
          <div className="cart-card">
            <div className="cart-header">
              <h3>🛒 Cart</h3>
              <span className="cart-count">{cart.reduce((s, i) => s + i.qty, 0)} items</span>
            </div>

            {cart.length === 0 ? (
              <div className="cart-empty">
                <CartIcon size={40} />
                <p>Cart is empty<br />Scan or search a medicine to begin</p>
              </div>
            ) : (
              <>
                {/* Govt scheme banner */}
                {govtScheme && (
                  <div style={{ margin: '0 0 0 0', padding: '10px 16px', background: 'linear-gradient(135deg,#ecfdf5,#fffbeb)', borderBottom: '2px solid #6ee7b7', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🏛️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46' }}>{govtScheme} Scheme Active</div>
                      <div style={{ fontSize: 11, color: '#047857' }}>80% government discount applied automatically</div>
                    </div>
                    <span style={{ background: '#059669', color: 'white', fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 20 }}>-80%</span>
                  </div>
                )}
                <div className="cart-items">
                  {cart.map((item, idx) => (
                    <div key={idx} className="cart-item">
                      <div style={{ flex: 1 }}>
                        <div className="cart-item-name">
                          {item.name}
                          {govtScheme && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#059669', color: 'white', padding: '1px 6px', borderRadius: 10, fontWeight: 700, verticalAlign: 'middle' }}>
                              {govtScheme}
                            </span>
                          )}
                          {item.expiry && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 10, fontWeight: 600, verticalAlign: 'middle' }}>
                              exp {fmtExpiry(item.expiry)}
                            </span>
                          )}
                        </div>
                        <div className="cart-item-sub">
                          {govtScheme ? (
                            <>
                              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: 4 }}>₹{item.price.toFixed(2)}</span>
                              <span style={{ color: '#059669', fontWeight: 700 }}>₹{(item.price * 0.20).toFixed(2)}</span>
                              <span style={{ color: 'var(--text-muted)' }}> / {item.unit}</span>
                            </>
                          ) : (
                            <>₹{item.price.toFixed(2)} / {item.unit}</>
                          )}
                        </div>
                      </div>
                      <div className="qty-control">
                        <button className="qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                        <span className="qty-val">{item.qty}</span>
                        <button className="qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                      </div>
                      <div className="cart-item-price">
                        {govtScheme ? (
                          <span style={{ color: '#059669', fontWeight: 700 }}>₹{(item.price * item.qty * 0.20).toFixed(2)}</span>
                        ) : (
                          <>₹{(item.price * item.qty).toFixed(2)}</>
                        )}
                      </div>
                      <button className="cart-item-remove" onClick={() => removeFromCart(idx)}>
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="cart-totals">
                  {/* Government Scheme Selector */}
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>🏛️ Government Scheme <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — 80% off)</span></label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['', 'RGHS', 'Chiranjeevi'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setGovtScheme(prev => prev === s ? '' : s)}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            borderRadius: 8,
                            border: govtScheme === s && s !== '' ? '2px solid #059669' : '1.5px solid var(--border)',
                            background: govtScheme === s && s !== '' ? '#ecfdf5' : s === '' ? 'var(--bg-body)' : 'white',
                            color: govtScheme === s && s !== '' ? '#065f46' : 'var(--text-secondary)',
                            fontWeight: govtScheme === s && s !== '' ? 700 : 500,
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'all .15s',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {s === '' ? 'None' : s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="cart-total-row"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  <div className="cart-total-row"><span>GST (18%)</span><span>₹{gst.toFixed(2)}</span></div>

                  {govtScheme && (
                    <div className="cart-total-row" style={{ color: '#059669', fontWeight: 600 }}>
                      <span>🏛️ {govtScheme} Discount (80%)</span>
                      <span>−₹{(subtotal * 0.80).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="cart-total-row">
                    <span>Extra Discount</span>
                    <span>
                      <input
                        type="number" value={discount} min="0" max="100"
                        style={{ width: 50, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, textAlign: 'center' }}
                        onChange={e => setDiscount(e.target.value)}
                      />
                       %
                    </span>
                  </div>
                  {(parseFloat(discount) > 0) && (
                    <div className="cart-total-row" style={{ color: 'var(--accent-orange)', fontSize: 12 }}>
                      <span>Extra Discount Amt</span>
                      <span>−₹{(subtotal * (parseFloat(discount) || 0) / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="cart-total-row grand">
                    <span>Total</span>
                    <span style={{ color: govtScheme ? '#059669' : 'var(--accent-teal)' }}>₹{total.toFixed(2)}</span>
                  </div>

                  <div className="form-group" style={{ margin: '10px 0 0' }}>
                    <label className="form-label">Patient Name (optional)</label>
                    <input
                      type="text" className="form-input"
                      placeholder="e.g. Ramesh Gupta"
                      value={patientName}
                      onChange={e => setPatientName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: '8px 0 0' }}>
                    <label className="form-label">Payment Method</label>
                    <select className="form-input form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                      <option>Cash</option>
                      <option>UPI / QR</option>
                      <option>Card</option>
                      <option>Credit (Account)</option>
                    </select>
                  </div>

                  <button className="checkout-btn" onClick={completeSale}
                    style={govtScheme ? { background: 'linear-gradient(135deg,#059669,#0d9488)' } : {}}>
                    <CheckIcon size={16} />
                    {govtScheme ? `Complete ${govtScheme} Sale` : 'Complete Sale & Print Receipt'}
                  </button>
                  <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={clearCart}>
                    🗑️ Clear Cart
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
