import { useState } from 'react';

const initialNotifications = [
  { id: 1, title: '🔴 Critical: Insulin Glargine — Only 45 units left', desc: 'Stock has dropped below the critical threshold. Immediate reorder recommended.', time: '5 minutes ago', unread: true },
  { id: 2, title: '⚠️ Expiry Warning: Amoxicillin 500mg', desc: 'Batch expires in 14 days. Consider prioritizing dispensing or return.', time: '20 minutes ago', unread: true },
  { id: 3, title: '🤖 AI Prediction: Metformin demand spike expected', desc: 'Next week forecast shows 23% increase. Pre-emptive reorder advised.', time: '1 hour ago', unread: true },
  { id: 4, title: '🟡 Low Stock: Lisinopril 10mg', desc: 'Only 560 units remaining. Below the 600-unit reorder threshold.', time: '3 hours ago', unread: true },
  { id: 5, title: '✅ Order Delivered: MedSupply Co.', desc: 'Order #ORD-2284 for Paracetamol (2000 units) has been delivered and logged.', time: 'Yesterday', unread: true },
  { id: 6, title: '📊 Monthly Report Ready', desc: 'Your February 2026 inventory report is ready to download.', time: '2 days ago', unread: false },
];

export default function NotificationsPage({ onMarkAllRead }) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  const handleMarkAll = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    onMarkAllRead();
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Notifications</h1>
          <p>Stay on top of important alerts</p>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={handleMarkAll}>Mark all as read</button>
        </div>
      </header>

      <div className="notif-list">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notif-item${n.unread ? ' unread' : ''}`}
            onClick={() => markRead(n.id)}
          >
            <div className="notif-dot-wrapper">
              {n.unread && <div className="notif-unread-dot" />}
              {!n.unread && <div style={{ width: 8, height: 8 }} />}
            </div>
            <div className="notif-content">
              <h4>{n.title}</h4>
              <p>{n.desc}</p>
              <div className="notif-time">{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
