/**
 * useAppNotifications.js
 *
 * Centralised real-time notification system.
 * Generates notifications automatically from:
 *   - Inventory state (low stock, expiry warnings, out-of-stock)
 *   - Sales completed (SellPage)
 *   - Medication added / updated (AddMedicationModal / InventoryPage)
 *   - Inventory reset
 *   - Drug interactions checked
 *   - Reports exported
 *
 * Also exposes `addNotification(notification)` so any page can inject
 * a one-off notification at will.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

let _idCounter = 100; // start above the static seed IDs
const uid = () => ++_idCounter;

/** Static seed shown before any inventory-driven alerts fire */
const SEED_NOTIFICATIONS = [
  {
    id: 1,
    type: 'critical',
    icon: '🔴',
    title: 'Critical Stock: Insulin Glargine',
    desc: 'Only 45 units left. Stock has dropped below the critical threshold. Immediate reorder recommended.',
    time: new Date(Date.now() - 5 * 60000),
    page: 'inventory',
    unread: true,
  },
  {
    id: 2,
    type: 'expiry',
    icon: '⚠️',
    title: 'Expiry Warning: Amoxicillin 500mg',
    desc: 'Batch expires in 14 days. Consider prioritizing dispensing or initiating a return.',
    time: new Date(Date.now() - 20 * 60000),
    page: 'inventory',
    unread: true,
  },
  {
    id: 3,
    type: 'ai',
    icon: '🤖',
    title: 'AI Prediction: Metformin demand spike',
    desc: 'Next week forecast shows a 23% increase in demand. Pre-emptive reorder is advised.',
    time: new Date(Date.now() - 60 * 60000),
    page: 'predictions',
    unread: true,
  },
  {
    id: 4,
    type: 'lowStock',
    icon: '🟡',
    title: 'Low Stock: Lisinopril 10mg',
    desc: 'Only 560 units remaining — below the 600-unit reorder threshold.',
    time: new Date(Date.now() - 3 * 60 * 60000),
    page: 'inventory',
    unread: true,
  },
  {
    id: 5,
    type: 'order',
    icon: '✅',
    title: 'Order Delivered: MedSupply Co.',
    desc: 'Order #ORD-2284 for Paracetamol (2,000 units) has been delivered and logged.',
    time: new Date(Date.now() - 24 * 60 * 60000),
    page: 'suppliers',
    unread: true,
  },
  {
    id: 6,
    type: 'report',
    icon: '📊',
    title: 'Monthly Report Ready',
    desc: 'Your February 2026 inventory report is ready to download.',
    time: new Date(Date.now() - 2 * 24 * 60 * 60000),
    page: 'reports',
    unread: false,
  },
];

/** Format a Date → human-readable relative time */
function relativeTime(date) {
  if (!date) return '';
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 172800) return 'Yesterday';
  return Math.floor(diff / 86400) + 'd ago';
}

export function useAppNotifications() {
  const [notifications, setNotifications] = useState(SEED_NOTIFICATIONS);

  // Track which inventory items we have already raised alerts for to avoid duplicates
  const alertedLowStock  = useRef(new Set());
  const alertedExpiring  = useRef(new Set());
  const alertedCritical  = useRef(new Set());

  /** Add a single notification to the top of the list */
  const addNotification = useCallback((notif) => {
    setNotifications(prev => {
      // De-duplicate by title within the last 30 seconds
      const recent = prev.filter(n => {
        const age = Date.now() - new Date(n.time).getTime();
        return age < 30000 && n.title === notif.title;
      });
      if (recent.length > 0) return prev;
      const full = {
        id: uid(),
        unread: true,
        time: new Date(),
        icon: '🔔',
        type: 'info',
        page: null,
        ...notif,
      };
      return [full, ...prev];
    });
  }, []);

  /** Scan the inventory array and fire alerts for newly-crossed thresholds */
  const processInventory = useCallback((inventory) => {
    if (!inventory || !inventory.length) return;

    inventory.forEach(item => {
      const key = `${item.name}|${item.expiry || ''}`;

      // ── Out-of-stock / Critical ─────────────────────────────────────────
      if (item.quantity <= 0 && !alertedCritical.current.has(key)) {
        alertedCritical.current.add(key);
        addNotification({
          type: 'critical',
          icon: '🚨',
          title: `Out of Stock: ${item.name}`,
          desc: `${item.name} is completely out of stock. Immediate reorder required.`,
          page: 'inventory',
        });
      } else if (item.quantity > 0 && item.status === 'critical' && !alertedCritical.current.has(key)) {
        alertedCritical.current.add(key);
        addNotification({
          type: 'critical',
          icon: '🔴',
          title: `Critical Stock Alert: ${item.name}`,
          desc: `Only ${item.quantity} units of ${item.name} remaining. Below critical threshold — reorder immediately.`,
          page: 'inventory',
        });
      }

      // ── Low stock ───────────────────────────────────────────────────────
      if (item.status === 'low-stock' && !alertedLowStock.current.has(key)) {
        alertedLowStock.current.add(key);
        addNotification({
          type: 'lowStock',
          icon: '🟡',
          title: `Low Stock: ${item.name}`,
          desc: `${item.name} is running low — ${item.quantity} units remaining. Consider placing a reorder.`,
          page: 'inventory',
        });
      }

      // ── Expiry ──────────────────────────────────────────────────────────
      if (item.status === 'expiring' && !alertedExpiring.current.has(key)) {
        alertedExpiring.current.add(key);
        const daysLeft = item.expiry
          ? Math.ceil((new Date(item.expiry) - new Date()) / 86400000)
          : null;
        addNotification({
          type: 'expiry',
          icon: '⚠️',
          title: `Expiry Warning: ${item.name}`,
          desc: daysLeft !== null
            ? `${item.name} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. ${item.quantity} units in stock.`
            : `${item.name} is approaching its expiry date.`,
          page: 'inventory',
        });
      }
    });
  }, [addNotification]);

  /** Called by SellPage after a sale is completed */
  const notifySale = useCallback((saleData) => {
    addNotification({
      type: 'sale',
      icon: '💰',
      title: `Sale Completed — ₹${saleData.total?.toFixed(2)}`,
      desc: `${saleData.txnId || 'Transaction'} for ${saleData.patient || 'Walk-in'}: ${saleData.itemCount ?? saleData.items?.length ?? ''} item(s) · ${saleData.payment}.`,
      page: 'sell',
    });
  }, [addNotification]);

  /** Called by App when a medication is added */
  const notifyMedAdded = useCallback((med) => {
    addNotification({
      type: 'stock',
      icon: '➕',
      title: `Medication Added: ${med.name}`,
      desc: `${med.name} (${med.quantity} ${med.unit || 'units'}) has been added to inventory.`,
      page: 'inventory',
    });
  }, [addNotification]);

  /** Called by App when a medication is updated */
  const notifyMedUpdated = useCallback((med) => {
    addNotification({
      type: 'stock',
      icon: '✏️',
      title: `Medication Updated: ${med.name}`,
      desc: `${med.name} details have been updated in inventory.`,
      page: 'inventory',
    });
  }, [addNotification]);

  /** Called when inventory is reset */
  const notifyReset = useCallback(() => {
    alertedLowStock.current.clear();
    alertedExpiring.current.clear();
    alertedCritical.current.clear();
    addNotification({
      type: 'info',
      icon: '🔄',
      title: 'Inventory Reset',
      desc: 'Inventory has been reset to initial seed data.',
      page: 'inventory',
    });
  }, [addNotification]);

  /** Called from InteractionsPage when a check is run */
  const notifyInteractionCheck = useCallback((drugs, foundCount) => {
    if (foundCount > 0) {
      addNotification({
        type: 'critical',
        icon: '🚨',
        title: `Drug Interaction Alert — ${foundCount} pair(s)`,
        desc: `Interaction check for [${drugs.join(', ')}] found ${foundCount} known interaction(s). Review immediately.`,
        page: 'interactions',
      });
    }
  }, [addNotification]);

  /** Mark a single notification as read */
  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  }, []);

  /** Mark all as read */
  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  }, []);

  const unreadCount = notifications.filter(n => n.unread).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    processInventory,
    notifySale,
    notifyMedAdded,
    notifyMedUpdated,
    notifyReset,
    notifyInteractionCheck,
    markRead,
    markAllRead,
    relativeTime,
  };
}
