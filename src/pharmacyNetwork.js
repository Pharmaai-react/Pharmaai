/**
 * pharmacyNetwork.js — Supabase version
 * Near-expiry alerts written to `network_alerts` table.
 * Realtime subscription replaces BroadcastChannel.
 */
import { supabase } from './supabase.js';
import { useState, useEffect, useRef, useCallback } from 'react';

export const NETWORK_EXPIRY_DAYS = 90;

function daysLeft(expiryStr) {
  if (!expiryStr) return Infinity;
  return Math.ceil((new Date(expiryStr).getTime() - Date.now()) / 86400000);
}

// ── Publish ───────────────────────────────────────────────────────────────────

export async function publishNetworkAlerts(userId, username, pharmacyName, pharmacyId, records) {
  if (!userId || !Array.isArray(records)) return;

  const nearExpiry = records.filter(r =>
    r.quantity > 0 && r.expiry && daysLeft(r.expiry) <= NETWORK_EXPIRY_DAYS
  );

  // Delete current user's alerts, then re-insert
  await supabase.from('network_alerts').delete().eq('user_id', userId);

  if (nearExpiry.length === 0) return;

  const rows = nearExpiry.map(r => ({
    user_id:      userId,
    username:     username.toLowerCase(),
    pharmacy_name: pharmacyName || username,
    pharmacy_id:  pharmacyId || '',
    medicine_name: r.name,
    expiry:       r.expiry,
    days_left:    daysLeft(r.expiry),
    quantity:     r.quantity,
    price:        r.price ?? 0,
  }));

  await supabase.from('network_alerts').insert(rows);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function readNetworkAlerts(userId) {
  const { data } = await supabase
    .from('network_alerts')
    .select('*')
    .neq('user_id', userId)
    .order('days_left', { ascending: true });
  return (data || []).map(r => ({
    fromUsername:     r.username,
    fromPharmacyName: r.pharmacy_name,
    fromPharmacyId:   r.pharmacy_id,
    medicineName:     r.medicine_name,
    expiry:           r.expiry,
    daysLeft:         r.days_left,
    quantity:         r.quantity,
    price:            r.price,
    publishedAt:      r.published_at,
  }));
}

// ── React Hook ────────────────────────────────────────────────────────────────

export function useNetworkAlerts(currentUser, inventory) {
  const [networkAlerts, setNetworkAlerts] = useState([]);
  const [hasNew, setHasNew]               = useState(false);
  const seenRef = useRef(new Set());

  const userId      = currentUser?.id;
  const username    = currentUser?.username;
  const pharmacyName = currentUser?.pharmacyName;
  const pharmacyId  = currentUser?.pharmacyId;

  // Publish own alerts when inventory changes
  useEffect(() => {
    if (!userId || !Array.isArray(inventory)) return;
    publishNetworkAlerts(userId, username, pharmacyName, pharmacyId, inventory);
  }, [userId, username, pharmacyName, pharmacyId, inventory]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const alerts = await readNetworkAlerts(userId);
    setNetworkAlerts(alerts);
    const newOnes = alerts.filter(a => {
      const k = a.fromUsername + '|' + a.medicineName + '|' + a.expiry;
      return !seenRef.current.has(k);
    });
    if (newOnes.length > 0) setHasNew(true);
  }, [userId]);

  useEffect(() => { if (userId) refresh(); }, [userId, refresh]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('network-alerts-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'network_alerts',
      }, (payload) => {
        if (payload.new?.user_id !== userId && payload.old?.user_id !== userId) {
          refresh();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refresh]);

  const dismissAlert = useCallback((alert) => {
    const k = alert.fromUsername + '|' + alert.medicineName + '|' + alert.expiry;
    seenRef.current.add(k);
    setNetworkAlerts(prev => prev.filter(a =>
      !(a.fromUsername === alert.fromUsername &&
        a.medicineName === alert.medicineName &&
        a.expiry       === alert.expiry)
    ));
  }, []);

  const dismissAll = useCallback(() => {
    networkAlerts.forEach(a =>
      seenRef.current.add(a.fromUsername + '|' + a.medicineName + '|' + a.expiry)
    );
    setNetworkAlerts([]);
    setHasNew(false);
  }, [networkAlerts]);

  const markSeen = useCallback(() => setHasNew(false), []);

  return { networkAlerts, hasNew, dismissAlert, dismissAll, markSeen };
}
