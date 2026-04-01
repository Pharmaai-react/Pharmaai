/**
 * pharmacyNetwork.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pharmacy Network — cross-user expiry alerting via localStorage + BroadcastChannel.
 *
 * HOW IT WORKS
 * ────────────
 * All pharmacies share the same browser (localStorage), so every user's
 * inventory is accessible under:  pharmaai_inventory_v1_<username>
 *
 * 1. After every inventory change the logged-in pharmacy calls
 *    `publishNetworkAlerts(username, records)`.  This computes which medicines
 *    are expiring ≤ 90 days and writes a record to the shared key
 *    `NETWORK_ALERTS_KEY`.
 *
 * 2. A BroadcastChannel ("pharmaai_network") fires an event to every OTHER
 *    tab/window that is currently open so they receive alerts in real-time
 *    without a page refresh.
 *
 * 3. Consumers call `useNetworkAlerts(currentUsername, onAlert)` — a React
 *    hook that subscribes to both the BroadcastChannel and the `storage`
 *    event (same-window fallback) and calls `onAlert(alert[])` whenever
 *    another pharmacy's expiry state changes.
 */

// ─── constants ────────────────────────────────────────────────────────────────

export const NETWORK_ALERTS_KEY = 'pharmaai_network_alerts_v1';
const CHANNEL_NAME = 'pharmaai_network';

/** Days threshold for "near expiry" network broadcast */
export const NETWORK_EXPIRY_DAYS = 90;

// ─── alert shape ─────────────────────────────────────────────────────────────
/**
 * NetworkAlert {
 *   fromUsername: string,
 *   fromPharmacyName: string,
 *   medicineName: string,
 *   expiry: string (ISO date),
 *   daysLeft: number,
 *   quantity: number,
 *   publishedAt: string (ISO),
 * }
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysLeft(expiryStr) {
  if (!expiryStr) return Infinity;
  return Math.ceil((new Date(expiryStr).getTime() - Date.now()) / 86400000);
}

// ─── publish ─────────────────────────────────────────────────────────────────

/**
 * Called whenever the logged-in pharmacy's inventory changes.
 * Writes current pharmacy's near-expiry medicines to the shared network key
 * and broadcasts via BroadcastChannel.
 *
 * @param {string} username
 * @param {string} pharmacyName
 * @param {Array}  records  — raw inventory records (from loadInventory)
 */
export function publishNetworkAlerts(username, pharmacyName, records) {
  try {
    // Build alerts only for medicines expiring within NETWORK_EXPIRY_DAYS
    const now = new Date().toISOString();
    const myAlerts = records
      .filter(r => r.quantity > 0 && r.expiry && daysLeft(r.expiry) <= NETWORK_EXPIRY_DAYS)
      .map(r => ({
        fromUsername:     username.toLowerCase(),
        fromPharmacyName: pharmacyName || username,
        medicineName:     r.name,
        expiry:           r.expiry,
        daysLeft:         daysLeft(r.expiry),
        quantity:         r.quantity,
        price:            r.price ?? 0,
        publishedAt:      now,
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft); // earliest first

    // Read the global map { [username]: alerts[] }
    let networkMap = {};
    try {
      const raw = localStorage.getItem(NETWORK_ALERTS_KEY);
      if (raw) networkMap = JSON.parse(raw);
    } catch {}

    // Replace this pharmacy's entry
    if (myAlerts.length === 0) {
      delete networkMap[username.toLowerCase()];
    } else {
      networkMap[username.toLowerCase()] = myAlerts;
    }

    localStorage.setItem(NETWORK_ALERTS_KEY, JSON.stringify(networkMap));

    // Broadcast to other open tabs
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ type: 'NETWORK_UPDATE', from: username.toLowerCase() });
      ch.close();
    } catch {}
  } catch (err) {
    console.warn('[pharmacyNetwork] publish error:', err);
  }
}

// ─── read ─────────────────────────────────────────────────────────────────────

/**
 * Read all alerts from OTHER pharmacies (excludes currentUsername).
 * Returns a flat Array<NetworkAlert> sorted by daysLeft ascending.
 */
export function readNetworkAlerts(currentUsername) {
  try {
    const raw = localStorage.getItem(NETWORK_ALERTS_KEY);
    if (!raw) return [];
    const networkMap = JSON.parse(raw);
    const me = currentUsername.toLowerCase();
    return Object.entries(networkMap)
      .filter(([key]) => key !== me)
      .flatMap(([, alerts]) => alerts)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  } catch {
    return [];
  }
}

// ─── React hook ──────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useNetworkAlerts(currentUsername, pharmacyName, inventory)
 *
 * - Automatically publishes current user's alerts whenever `inventory` changes.
 * - Subscribes to BroadcastChannel + storage event to pick up OTHER pharmacies' alerts.
 * - Returns { networkAlerts, dismissAlert, dismissAll, hasNew }
 *
 * `networkAlerts` — Array<NetworkAlert> from OTHER pharmacies
 * `hasNew`        — true if alerts arrived since last dismissal
 */
export function useNetworkAlerts(currentUsername, pharmacyName, inventory) {
  const [networkAlerts, setNetworkAlerts] = useState([]);
  const [hasNew, setHasNew] = useState(false);
  // Track which alert IDs have been shown as popup (to avoid repeat toasts)
  const shownRef = useRef(new Set());

  // ── publish own alerts whenever inventory changes ──
  useEffect(() => {
    if (!currentUsername || !Array.isArray(inventory) || inventory.length === 0) return;
    publishNetworkAlerts(currentUsername, pharmacyName, inventory);
  }, [currentUsername, pharmacyName, inventory]);

  // ── read others' alerts ────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    if (!currentUsername) return;
    const alerts = readNetworkAlerts(currentUsername);
    setNetworkAlerts(alerts);
    // Mark hasNew if there are unseen alerts
    const newOnes = alerts.filter(a => {
      const key = a.fromUsername + '|' + a.medicineName + '|' + a.expiry;
      return !shownRef.current.has(key);
    });
    if (newOnes.length > 0) setHasNew(true);
  }, [currentUsername]);

  // Initial read on login
  useEffect(() => {
    if (currentUsername) refresh();
  }, [currentUsername, refresh]);

  // ── BroadcastChannel subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!currentUsername) return;
    let ch;
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (e) => {
        if (e.data?.type === 'NETWORK_UPDATE' && e.data.from !== currentUsername.toLowerCase()) {
          refresh();
        }
      };
    } catch {}

    // storage event fires in same window when another script writes to localStorage
    const onStorage = (e) => {
      if (e.key === NETWORK_ALERTS_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      try { ch?.close(); } catch {}
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUsername, refresh]);

  const dismissAlert = useCallback((alert) => {
    const key = alert.fromUsername + '|' + alert.medicineName + '|' + alert.expiry;
    shownRef.current.add(key);
    setNetworkAlerts(prev => prev.filter(a =>
      !(a.fromUsername === alert.fromUsername &&
        a.medicineName === alert.medicineName &&
        a.expiry === alert.expiry)
    ));
    setHasNew(prev => {
      const remaining = networkAlerts.filter(a => {
        const k = a.fromUsername + '|' + a.medicineName + '|' + a.expiry;
        return !shownRef.current.has(k);
      });
      return remaining.length > 0;
    });
  }, [networkAlerts]);

  const dismissAll = useCallback(() => {
    networkAlerts.forEach(a => {
      shownRef.current.add(a.fromUsername + '|' + a.medicineName + '|' + a.expiry);
    });
    setNetworkAlerts([]);
    setHasNew(false);
  }, [networkAlerts]);

  const markSeen = useCallback(() => setHasNew(false), []);

  return { networkAlerts, hasNew, dismissAlert, dismissAll, markSeen };
}
