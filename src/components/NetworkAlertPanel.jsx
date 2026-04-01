/**
 * NetworkAlertPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pharmacy Network — expiry alert popup panel.
 *
 * Displays near-expiry medicines reported by OTHER pharmacies in the network.
 * Shown as a slide-in notification panel anchored to the bottom-right.
 * Also exports a <NetworkBell> badge for the sidebar/header.
 */

import { useState, useEffect } from 'react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtExpiry(expStr) {
  if (!expStr) return '—';
  try {
    return new Date(expStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return expStr; }
}

function urgencyColor(daysLeft) {
  if (daysLeft <= 0)  return { bg: '#fef2f2', border: '#f87171', accent: '#dc2626', label: 'EXPIRED',      emoji: '🚫' };
  if (daysLeft <= 15) return { bg: '#fef2f2', border: '#f87171', accent: '#dc2626', label: 'CRITICAL',     emoji: '🔴' };
  if (daysLeft <= 30) return { bg: '#fff7ed', border: '#fb923c', accent: '#ea580c', label: 'URGENT',       emoji: '🟠' };
  if (daysLeft <= 60) return { bg: '#fefce8', border: '#fbbf24', accent: '#d97706', label: 'WARNING',      emoji: '🟡' };
  return               { bg: '#f0fdf4', border: '#86efac', accent: '#16a34a', label: 'NEAR EXPIRY',  emoji: '🟢' };
}

// ─── Single Alert Card ────────────────────────────────────────────────────────

function AlertCard({ alert, onDismiss }) {
  const u = urgencyColor(alert.daysLeft);
  return (
    <div style={{
      background: u.bg,
      border: `1.5px solid ${u.border}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      position: 'relative',
      transition: 'all .2s',
    }}>
      {/* Urgency emoji */}
      <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{u.emoji}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Urgency badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          marginBottom: 4,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1,
            color: u.accent, background: u.bg,
            border: `1px solid ${u.border}`,
            padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase',
          }}>{u.label}</span>
          <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>
            {alert.daysLeft <= 0 ? 'EXPIRED' : alert.daysLeft + ' days left'}
          </span>
        </div>

        {/* Medicine name */}
        <div style={{
          fontWeight: 700, fontSize: 13, color: u.accent,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {alert.medicineName}
        </div>

        {/* Meta */}
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
          Expires: <b style={{ color: u.accent }}>{fmtExpiry(alert.expiry)}</b>
          &nbsp;·&nbsp;Stock: {alert.quantity} units
          {alert.price > 0 && <>&nbsp;·&nbsp;₹{alert.price.toFixed(2)}</>}
        </div>

        {/* Pharmacy source */}
        <div style={{
          marginTop: 6, fontSize: 11, fontWeight: 600,
          color: '#475569',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span>🏥</span>
          <span>{alert.fromPharmacyName}</span>
          <span style={{ fontWeight: 400, color: '#94a3b8' }}>· @{alert.fromUsername}</span>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(alert)}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 2,
          borderRadius: 4,
        }}
        title="Dismiss"
      >×</button>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function NetworkAlertPanel({ networkAlerts, hasNew, onDismiss, onDismissAll, onMarkSeen }) {
  const [open, setOpen] = useState(false);
  const [animated, setAnimated] = useState(false);

  // Auto-open when new alerts arrive
  useEffect(() => {
    if (hasNew && networkAlerts.length > 0) {
      setOpen(true);
      setAnimated(true);
      const t = setTimeout(() => setAnimated(false), 600);
      return () => clearTimeout(t);
    }
  }, [hasNew, networkAlerts.length]);

  const toggle = () => {
    setOpen(o => {
      if (!o && onMarkSeen) onMarkSeen();
      return !o;
    });
  };

  if (networkAlerts.length === 0 && !open) return null;

  // Group by pharmacy for the header
  const pharmacyCount = new Set(networkAlerts.map(a => a.fromUsername)).size;

  return (
    <>
      {/* ── Floating bell button ── */}
      <button
        id="network-alert-bell"
        onClick={toggle}
        title={`${networkAlerts.length} network alert${networkAlerts.length !== 1 ? 's' : ''} from ${pharmacyCount} other pharmacy`}
        style={{
          position: 'fixed',
          bottom: 88,
          right: 24,
          zIndex: 9000,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: hasNew
            ? 'linear-gradient(135deg, #dc2626, #f97316)'
            : 'linear-gradient(135deg, #1e40af, #0891b2)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: hasNew
            ? '0 0 0 4px rgba(220,38,38,0.25), 0 4px 20px rgba(220,38,38,0.4)'
            : '0 4px 20px rgba(14,116,144,0.4)',
          animation: animated ? 'networkBellShake 0.5s ease' : 'none',
          transition: 'all .2s',
        }}
      >
        <span style={{ fontSize: 22 }}>🌐</span>
        {/* Badge count */}
        {networkAlerts.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18,
            background: '#ef4444',
            color: 'white',
            fontSize: 10, fontWeight: 800,
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid white',
            fontFamily: 'Inter, sans-serif',
          }}>
            {networkAlerts.length > 99 ? '99+' : networkAlerts.length}
          </span>
        )}
      </button>

      {/* ── Slide-in Panel ── */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 150,
          right: 24,
          zIndex: 9001,
          width: 360,
          maxHeight: 'calc(100vh - 200px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          animation: 'networkPanelIn .25s cubic-bezier(.4,0,.2,1)',
          fontFamily: 'Inter, sans-serif',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #1e3a5f, #0c4a6e)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 20 }}>🌐</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>
                Pharmacy Network Alerts
              </div>
              <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 1 }}>
                {networkAlerts.length} alert{networkAlerts.length !== 1 ? 's' : ''} · {pharmacyCount} pharmacy network
              </div>
            </div>
            <button
              onClick={toggle}
              style={{
                background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer',
                color: 'white', fontSize: 16, padding: '4px 8px', borderRadius: 6,
              }}
            >✕</button>
          </div>

          {/* Sub-header info */}
          <div style={{
            padding: '8px 16px',
            background: '#0f172a',
            fontSize: 10, color: '#64748b',
            flexShrink: 0,
          }}>
            💡 These medicines are near expiry at partner pharmacies — coordinate to transfer or reduce stock
          </div>

          {/* Alert list */}
          <div style={{
            overflowY: 'auto',
            flex: 1,
            background: '#f8fafc',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {networkAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
                ✅ No active network alerts
              </div>
            ) : (
              networkAlerts.map((alert, idx) => (
                <AlertCard
                  key={alert.fromUsername + '|' + alert.medicineName + '|' + alert.expiry + idx}
                  alert={alert}
                  onDismiss={onDismiss}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {networkAlerts.length > 0 && (
            <div style={{
              padding: '10px 16px',
              background: '#1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>
                Auto-updates across all pharmacies
              </span>
              <button
                onClick={() => { onDismissAll(); setOpen(false); }}
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171',
                  fontSize: 11, fontWeight: 600,
                  padding: '5px 12px', borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Dismiss All
              </button>
            </div>
          )}
        </div>
      )}

      {/* CSS keyframes — injected once */}
      <style>{`
        @keyframes networkBellShake {
          0%,100% { transform: rotate(0deg); }
          20%      { transform: rotate(-12deg) scale(1.15); }
          40%      { transform: rotate(12deg)  scale(1.15); }
          60%      { transform: rotate(-8deg); }
          80%      { transform: rotate(8deg); }
        }
        @keyframes networkPanelIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </>
  );
}
