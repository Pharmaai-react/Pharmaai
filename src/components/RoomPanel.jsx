/**
 * RoomPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pharmacy Network Room UI
 *
 * Features:
 *  • "My Rooms" list showing all rooms the user is in
 *  • Create Room modal
 *  • Join Room modal
 *  • Per-room alert feed (near-expiry alerts from room members)
 *  • Member list with pharmacy details
 *  • Room code copy-to-clipboard
 *  • Leave / Dissolve room
 */

import { useState, useEffect } from 'react';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function urgencyColor(d) {
  if (d <= 0)  return { bg: '#fef2f2', border: '#f87171', accent: '#dc2626', label: 'EXPIRED',     emoji: '🚫' };
  if (d <= 15) return { bg: '#fef2f2', border: '#f87171', accent: '#dc2626', label: 'CRITICAL',    emoji: '🔴' };
  if (d <= 30) return { bg: '#fff7ed', border: '#fb923c', accent: '#ea580c', label: 'URGENT',      emoji: '🟠' };
  if (d <= 60) return { bg: '#fefce8', border: '#fbbf24', accent: '#d97706', label: 'WARNING',     emoji: '🟡' };
  return             { bg: '#f0fdf4', border: '#86efac', accent: '#16a34a', label: 'NEAR EXPIRY', emoji: '🟢' };
}

// ─── RoomAlertCard ────────────────────────────────────────────────────────────

function RoomAlertCard({ alert }) {
  const u = urgencyColor(alert.daysLeft);
  return (
    <div style={{
      background: u.bg, border: `1.5px solid ${u.border}`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{u.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            color: u.accent, border: `1px solid ${u.border}`, padding: '1px 6px', borderRadius: 4,
          }}>{u.label}</span>
          <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>
            {alert.daysLeft <= 0 ? 'EXPIRED' : `${alert.daysLeft}d left`}
          </span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, color: u.accent, marginBottom: 2 }}>
          {alert.medicineName}
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          Expires: <b style={{ color: u.accent }}>{fmtDate(alert.expiry)}</b>
          &nbsp;·&nbsp;{alert.quantity} units
          {alert.price > 0 && <>&nbsp;·&nbsp;₹{alert.price.toFixed(2)}</>}
        </div>
        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: '#475569', display: 'flex', gap: 4 }}>
          <span>🏥</span>
          <span>{alert.fromPharmacyName}</span>
          {alert.fromPharmacyId && <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {alert.fromPharmacyId}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── RoomDetail ───────────────────────────────────────────────────────────────

function RoomDetail({ room, currentUsername, onLeave, onClose }) {
  const [copied, setCopied] = useState(false);
  const alerts = room.alerts.filter(a => a.fromUsername !== currentUsername);
  const isCreator = room.createdBy === currentUsername;

  const copyCode = () => {
    navigator.clipboard.writeText(room.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #0c4a6e, #0e7490)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', cursor: 'pointer',
            color: 'white', borderRadius: 6, padding: '3px 8px', fontSize: 13,
          }}>← Back</button>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'white', flex: 1 }}>{room.name}</span>
          <button onClick={() => { onLeave(room.id); onClose(); }} style={{
            background: 'rgba(239,68,68,.2)', border: '1px solid rgba(239,68,68,.4)',
            cursor: 'pointer', color: '#fca5a5', borderRadius: 6, padding: '3px 10px', fontSize: 11,
          }}>
            {isCreator ? '🗑 Dissolve' : '↩ Leave'}
          </button>
        </div>

        {/* Room code */}
        <div style={{
          background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#bae6fd', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              Room Code
            </div>
            <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: 3 }}>
              {room.id}
            </div>
          </div>
          <button onClick={copyCode} style={{
            background: copied ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.15)',
            border: 'none', cursor: 'pointer', color: 'white',
            borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 600,
            transition: 'all .2s',
          }}>
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      {/* Members */}
      <div style={{ padding: '10px 14px', background: '#0f172a', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Members · {room.members.length}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {room.members.map(m => (
            <div key={m.username} style={{
              background: m.username === currentUsername ? 'rgba(14,116,144,.3)' : 'rgba(255,255,255,.05)',
              border: `1px solid ${m.username === currentUsername ? '#0ea5e9' : '#1e293b'}`,
              borderRadius: 6, padding: '4px 8px',
              fontSize: 10, color: m.username === currentUsername ? '#38bdf8' : '#94a3b8',
              fontWeight: m.username === currentUsername ? 700 : 500,
            }}>
              🏥 {m.pharmacyName || m.username}
              {m.username === currentUsername && ' (you)'}
              {room.createdBy === m.username && ' 👑'}
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
          Near-Expiry Alerts from Room Members · {alerts.length}
        </div>
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#94a3b8', fontSize: 13 }}>
            ✅ No active alerts from room members
          </div>
        ) : (
          alerts.map((a, i) => (
            <RoomAlertCard key={a.fromUsername + a.medicineName + a.expiry + i} alert={a} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function RoomPanel({
  rooms, totalRoomAlerts, hasNewRoomAlert,
  currentUser, onCreateRoom, onJoinRoom, onLeaveRoom, onMarkSeen,
}) {
  const [open, setOpen]           = useState(false);
  const [view, setView]           = useState('list'); // 'list' | 'detail' | 'create' | 'join'
  const [detailRoom, setDetailRoom] = useState(null);
  const [animated, setAnimated]   = useState(false);

  // Form states
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode]     = useState('');
  const [formError, setFormError]   = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Pulse animation when new alert arrives
  useEffect(() => {
    if (hasNewRoomAlert) {
      setAnimated(true);
      const t = setTimeout(() => setAnimated(false), 600);
      return () => clearTimeout(t);
    }
  }, [hasNewRoomAlert]);

  // Refresh detail room data when rooms change
  useEffect(() => {
    if (detailRoom) {
      const updated = rooms.find(r => r.id === detailRoom.id);
      if (updated) setDetailRoom(updated);
    }
  }, [rooms, detailRoom]);

  const toggle = () => {
    setOpen(o => {
      if (!o) { setView('list'); setFormError(''); setFormSuccess(''); }
      return !o;
    });
  };

  const handleCreate = async () => {
    setFormError('');
    const result = onCreateRoom({ roomName: createName });
    if (!result.ok) { setFormError(result.error); return; }
    setFormSuccess(`Room "${result.room.name}" created! Share code: ${result.room.id}`);
    setCreateName('');
    setTimeout(() => { setFormSuccess(''); setView('list'); }, 2000);
  };

  const handleJoin = async () => {
    setFormError('');
    if (!joinCode.trim()) { setFormError('Please enter a Room Code.'); return; }
    const result = onJoinRoom({ roomId: joinCode.trim() });
    if (!result.ok) { setFormError(result.error); return; }
    setFormSuccess(`Joined "${result.room.name}" successfully!`);
    setJoinCode('');
    setTimeout(() => { setFormSuccess(''); setView('list'); }, 1500);
  };

  const openDetail = (room) => {
    setDetailRoom(room);
    setView('detail');
    if (onMarkSeen) onMarkSeen(room.id);
  };

  return (
    <>
      {/* ── Floating button ── */}
      <button
        id="room-panel-btn"
        onClick={toggle}
        title={`${rooms.length} room${rooms.length !== 1 ? 's' : ''} · ${totalRoomAlerts} alert${totalRoomAlerts !== 1 ? 's' : ''}`}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
          width: 52, height: 52, borderRadius: '50%',
          background: hasNewRoomAlert
            ? 'linear-gradient(135deg, #7c3aed, #0891b2)'
            : 'linear-gradient(135deg, #4f46e5, #0891b2)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hasNewRoomAlert
            ? '0 0 0 4px rgba(124,58,237,0.25), 0 4px 20px rgba(124,58,237,0.4)'
            : '0 4px 20px rgba(79,70,229,0.4)',
          animation: animated ? 'networkBellShake 0.5s ease' : 'none',
          transition: 'all .2s',
        }}
      >
        <span style={{ fontSize: 22 }}>🏘</span>
        {(rooms.length > 0 || totalRoomAlerts > 0) && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 18, height: 18,
            background: hasNewRoomAlert ? '#7c3aed' : '#4f46e5',
            color: 'white', fontSize: 10, fontWeight: 800,
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid white',
          }}>
            {totalRoomAlerts > 0 ? (totalRoomAlerts > 99 ? '99+' : totalRoomAlerts) : rooms.length}
          </span>
        )}
      </button>

      {/* ── Slide-in Panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 86, right: 24, zIndex: 9001,
          width: 380, maxHeight: 'calc(100vh - 120px)',
          display: 'flex', flexDirection: 'column',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          animation: 'networkPanelIn .25s cubic-bezier(.4,0,.2,1)',
          fontFamily: 'Inter, sans-serif',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #312e81, #1e3a8a)',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 20 }}>🏘</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>Pharmacy Network Rooms</div>
              <div style={{ fontSize: 11, color: '#a5b4fc', marginTop: 1 }}>
                {rooms.length} room{rooms.length !== 1 ? 's' : ''} · {totalRoomAlerts} alert{totalRoomAlerts !== 1 ? 's' : ''}
              </div>
            </div>
            <button onClick={toggle} style={{
              background: 'rgba(255,255,255,.12)', border: 'none', cursor: 'pointer',
              color: 'white', fontSize: 16, padding: '4px 8px', borderRadius: 6,
            }}>✕</button>
          </div>

          {/* Body */}
          {view === 'detail' && detailRoom ? (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <RoomDetail
                room={detailRoom}
                currentUsername={currentUser?.username}
                onLeave={onLeaveRoom}
                onClose={() => setView('list')}
              />
            </div>
          ) : view === 'create' ? (
            <div style={{ flex: 1, background: '#f8fafc', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => { setView('list'); setFormError(''); setFormSuccess(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12, textAlign: 'left', padding: 0 }}>
                ← Back to rooms
              </button>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>✨ Create a New Room</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Give your room a name. Share the generated code with other pharmacies so they can join.
              </div>
              {formError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>{formError}</div>}
              {formSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>{formSuccess}</div>}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Room Name *</label>
                <input
                  type="text" value={createName} onChange={e => { setCreateName(e.target.value); setFormError(''); }}
                  placeholder="e.g. Central District Pharmacies"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                    border: '1.5px solid #e2e8f0', outline: 'none',
                    fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={!createName.trim()}
                style={{
                  padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: createName.trim() ? 'linear-gradient(135deg,#4f46e5,#0891b2)' : '#e2e8f0',
                  color: createName.trim() ? 'white' : '#94a3b8',
                  fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif',
                  transition: 'all .2s',
                }}
              >
                🚀 Create Room
              </button>
            </div>
          ) : view === 'join' ? (
            <div style={{ flex: 1, background: '#f8fafc', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => { setView('list'); setFormError(''); setFormSuccess(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12, textAlign: 'left', padding: 0 }}>
                ← Back to rooms
              </button>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>🔑 Join a Room</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Enter the 8-character room code shared by the room creator.
              </div>
              {formError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>{formError}</div>}
              {formSuccess && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>{formSuccess}</div>}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Room Code *</label>
                <input
                  type="text" value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setFormError(''); }}
                  placeholder="e.g. R4F2A7BX"
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 15,
                    border: '1.5px solid #e2e8f0', outline: 'none',
                    fontFamily: "'Space Grotesk', monospace", letterSpacing: 3, fontWeight: 700,
                    textTransform: 'uppercase', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                onClick={handleJoin}
                disabled={joinCode.trim().length < 2}
                style={{
                  padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: joinCode.trim().length >= 2 ? 'linear-gradient(135deg,#0d9488,#0891b2)' : '#e2e8f0',
                  color: joinCode.trim().length >= 2 ? 'white' : '#94a3b8',
                  fontWeight: 700, fontSize: 13, fontFamily: 'Inter, sans-serif',
                  transition: 'all .2s',
                }}
              >
                🔑 Join Room
              </button>
            </div>
          ) : (
            /* ── Room list ── */
            <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
              {/* Action buttons */}
              <div style={{ padding: '10px 12px', display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', background: 'white' }}>
                <button onClick={() => { setView('create'); setFormError(''); setFormSuccess(''); }} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white',
                  fontWeight: 700, fontSize: 12, fontFamily: 'Inter, sans-serif',
                }}>
                  ✨ Create Room
                </button>
                <button onClick={() => { setView('join'); setFormError(''); setFormSuccess(''); }} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: '1.5px solid #0d9488', cursor: 'pointer',
                  background: 'white', color: '#0d9488',
                  fontWeight: 700, fontSize: 12, fontFamily: 'Inter, sans-serif',
                }}>
                  🔑 Join Room
                </button>
              </div>

              {/* Room cards */}
              {rooms.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🏘</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>No rooms yet</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    Create a room and share the code with partner pharmacies,
                    or join an existing room with a code.
                  </div>
                </div>
              ) : (
                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rooms.map(room => {
                    const roomAlerts = room.alerts.filter(a => a.fromUsername !== currentUser?.username);
                    const isCreator  = room.createdBy === currentUser?.username;
                    return (
                      <button
                        key={room.id}
                        onClick={() => openDetail(room)}
                        style={{
                          background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10,
                          padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', gap: 4,
                          transition: 'all .15s', width: '100%',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#818cf8'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(79,70,229,.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{room.name}</span>
                          {isCreator && <span style={{ fontSize: 10, background: '#ede9fe', color: '#7c3aed', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>👑 Creator</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b' }}>
                          <span style={{ fontFamily: "'Space Grotesk', monospace", fontWeight: 700, letterSpacing: 1 }}>{room.id}</span>
                          <span>·</span>
                          <span>👥 {room.members.length} member{room.members.length !== 1 ? 's' : ''}</span>
                          {roomAlerts.length > 0 && (
                            <>
                              <span>·</span>
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠ {roomAlerts.length} alert{roomAlerts.length !== 1 ? 's' : ''}</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Info footer */}
          <div style={{
            padding: '8px 14px', background: '#1e293b', flexShrink: 0,
            fontSize: 10, color: '#475569', lineHeight: 1.5,
          }}>
            💡 Only pharmacies with the room code can see alerts from members
          </div>
        </div>
      )}
    </>
  );
}
