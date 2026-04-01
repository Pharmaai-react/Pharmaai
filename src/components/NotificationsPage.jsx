import { useState } from 'react';

/** ── Helpers ─────────────────────────────────────────────────────────────── */

function relativeTime(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 5)    return 'Just now';
  if (diff < 60)   return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 172800) return 'Yesterday';
  return Math.floor(diff / 86400) + 'd ago';
}

const TYPE_META = {
  critical : { label: 'Critical',    color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' },
  expiry   : { label: 'Expiry',      color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
  lowStock : { label: 'Low Stock',   color: '#f97316', bg: '#fff7ed', border: '#fdba74' },
  sale     : { label: 'Sale',        color: '#0d9488', bg: '#f0fdfa', border: '#5eead4' },
  stock    : { label: 'Stock',       color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd' },
  ai       : { label: 'AI',          color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd' },
  order    : { label: 'Order',       color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7' },
  report   : { label: 'Report',      color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  info     : { label: 'Info',        color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
};

const PAGE_LABEL = {
  inventory   : '→ Inventory',
  sell        : '→ Sell',
  predictions : '→ AI Predictions',
  interactions: '→ Drug Interactions',
  suppliers   : '→ Suppliers',
  reports     : '→ Reports',
  settings    : '→ Settings',
};

const FILTER_OPTIONS = [
  { key: 'all',      label: 'All' },
  { key: 'critical', label: '🔴 Critical' },
  { key: 'expiry',   label: '⚠️ Expiry' },
  { key: 'lowStock', label: '🟡 Low Stock' },
  { key: 'sale',     label: '💰 Sales' },
  { key: 'ai',       label: '🤖 AI' },
  { key: 'order',    label: '📦 Orders' },
  { key: 'report',   label: '📊 Reports' },
];

/** ── Component ─────────────────────────────────────────────────────────────── */

export default function NotificationsPage({ notifications = [], onMarkRead, onMarkAllRead, onNavigate }) {
  const [filter, setFilter] = useState('all');
  const [showReadToo, setShowReadToo] = useState(true);

  const filtered = notifications.filter(n => {
    const typeMatch = filter === 'all' || n.type === filter;
    const readMatch = showReadToo || n.unread;
    return typeMatch && readMatch;
  });

  const unreadCount = notifications.filter(n => n.unread).length;

  // Count per type for badges
  const typeCounts = {};
  notifications.forEach(n => {
    if (n.unread) typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  });

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Notifications</h1>
          <p>
            {unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''} across all modules`
              : 'All caught up — no unread alerts'}
          </p>
        </div>
        <div className="header-right" style={{ gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowReadToo(p => !p)}
            style={{ fontSize: 13 }}
          >
            {showReadToo ? 'Hide Read' : 'Show All'}
          </button>
          <button className="btn btn-secondary" onClick={onMarkAllRead} disabled={unreadCount === 0}>
            Mark all as read
          </button>
        </div>
      </header>

      {/* ── Filter chips ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {FILTER_OPTIONS.map(opt => {
          const count = opt.key === 'all'
            ? unreadCount
            : (typeCounts[opt.key] || 0);
          const active = filter === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                border: active ? '2px solid var(--accent-teal)' : '1.5px solid var(--border)',
                background: active ? 'var(--accent-teal)' : 'var(--card-bg)',
                color: active ? 'white' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: 'all .15s',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {opt.label}
              {count > 0 && (
                <span style={{
                  background: active ? 'rgba(255,255,255,0.3)' : '#ef4444',
                  color: 'white',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 6px',
                  lineHeight: '18px',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Notification list ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          background: 'var(--card-bg)',
          borderRadius: 16,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
            {filter === 'all' ? 'No notifications' : `No ${FILTER_OPTIONS.find(o => o.key === filter)?.label} notifications`}
          </div>
          <div style={{ fontSize: 13 }}>
            {showReadToo ? 'Everything is clear.' : 'Toggle "Show All" to see read notifications.'}
          </div>
        </div>
      ) : (
        <div className="notif-list">
          {filtered.map(n => {
            const meta = TYPE_META[n.type] || TYPE_META.info;
            return (
              <div
                key={n.id}
                className={`notif-item${n.unread ? ' unread' : ''}`}
                onClick={() => onMarkRead && onMarkRead(n.id)}
                style={{
                  borderLeft: n.unread ? `4px solid ${meta.color}` : '4px solid transparent',
                  transition: 'all .2s',
                }}
              >
                {/* Unread dot */}
                <div className="notif-dot-wrapper">
                  {n.unread
                    ? <div className="notif-unread-dot" style={{ background: meta.color }} />
                    : <div style={{ width: 8, height: 8 }} />
                  }
                </div>

                {/* Icon bubble */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: meta.bg,
                  border: `1.5px solid ${meta.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}>
                  {n.icon || '🔔'}
                </div>

                <div className="notif-content" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{
                      flex: 1,
                      fontWeight: n.unread ? 700 : 500,
                      color: n.unread ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 14,
                      margin: 0,
                    }}>
                      {n.title}
                    </h4>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: meta.color,
                      background: meta.bg,
                      border: `1px solid ${meta.border}`,
                      borderRadius: 6,
                      padding: '2px 8px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>
                      {meta.label}
                    </span>
                  </div>

                  <p style={{
                    margin: '4px 0',
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}>
                    {n.desc}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                    <div className="notif-time">{relativeTime(n.time)}</div>
                    {n.page && onNavigate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead && onMarkRead(n.id);
                          onNavigate(n.page);
                        }}
                        style={{
                          fontSize: 12,
                          color: 'var(--accent-teal)',
                          fontWeight: 600,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {PAGE_LABEL[n.page] || `→ ${n.page}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
