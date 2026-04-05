/**
 * pharmacyRooms.js — Supabase version
 * Rooms stored in Supabase tables. Realtime replaces BroadcastChannel.
 */
import { supabase } from './supabase.js';
import { useState, useEffect, useRef, useCallback } from 'react';

function daysLeft(expiryStr) {
  if (!expiryStr) return Infinity;
  return Math.ceil((new Date(expiryStr).getTime() - Date.now()) / 86400000);
}

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return 'R' + Array.from({ length: 7 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createRoom({ userId, username, pharmacyName, pharmacyId, roomName }) {
  if (!roomName?.trim()) return { ok: false, error: 'Room name is required.' };
  const id = generateRoomId();

  const { error: roomError } = await supabase
    .from('rooms')
    .insert({ id, name: roomName.trim(), created_by: userId });
  if (roomError) return { ok: false, error: roomError.message };

  const { error: memberError } = await supabase
    .from('room_members')
    .insert({ room_id: id, user_id: userId, username, pharmacy_name: pharmacyName, pharmacy_id: pharmacyId });
  if (memberError) return { ok: false, error: memberError.message };

  return { ok: true, room: { id, name: roomName.trim(), createdBy: userId, members: [] } };
}

export async function joinRoom({ roomId, userId, username, pharmacyName, pharmacyId }) {
  const id = roomId.trim().toUpperCase();
  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!room) return { ok: false, error: `Room "${id}" not found. Check the code and try again.` };

  const { error } = await supabase
    .from('room_members')
    .upsert({ room_id: id, user_id: userId, username, pharmacy_name: pharmacyName, pharmacy_id: pharmacyId });
  if (error) return { ok: false, error: error.message };

  return { ok: true, room: { id: room.id, name: room.name, createdBy: room.created_by } };
}

export async function leaveRoom(roomId, userId, isCreator) {
  if (isCreator) {
    // Delete room — cascades to members and alerts
    await supabase.from('rooms').delete().eq('id', roomId);
  } else {
    await supabase.from('room_members').delete()
      .eq('room_id', roomId).eq('user_id', userId);
    await supabase.from('room_alerts').delete()
      .eq('room_id', roomId).eq('user_id', userId);
  }
}

export async function getUserRooms(userId) {
  if (!userId) return [];
  // Get rooms where user is a member
  const { data: memberships } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId);
  if (!memberships || memberships.length === 0) return [];

  const roomIds = memberships.map(m => m.room_id);

  const [{ data: rooms }, { data: members }, { data: alerts }] = await Promise.all([
    supabase.from('rooms').select('*').in('id', roomIds),
    supabase.from('room_members').select('*').in('room_id', roomIds),
    supabase.from('room_alerts').select('*').in('room_id', roomIds)
      .order('days_left', { ascending: true }),
  ]);

  return (rooms || []).map(r => ({
    id:        r.id,
    name:      r.name,
    createdBy: r.created_by,
    createdAt: r.created_at,
    members:   (members || []).filter(m => m.room_id === r.id).map(m => ({
      username:     m.username,
      pharmacyName: m.pharmacy_name,
      pharmacyId:   m.pharmacy_id,
      joinedAt:     m.joined_at,
    })),
    alerts: (alerts || []).filter(a => a.room_id === r.id).map(a => ({
      fromUsername:     a.username,
      fromPharmacyName: a.pharmacy_name,
      fromPharmacyId:   a.pharmacy_id,
      medicineName:     a.medicine_name,
      expiry:           a.expiry,
      daysLeft:         a.days_left,
      quantity:         a.quantity,
      price:            a.price,
    })),
  }));
}

export async function publishRoomAlerts(userId, username, pharmacyName, pharmacyId, inventory) {
  if (!userId || !Array.isArray(inventory)) return;

  const { data: memberships } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId);
  if (!memberships || memberships.length === 0) return;

  const nearExpiry = inventory.filter(r =>
    r.quantity > 0 && r.expiry && daysLeft(r.expiry) <= 90
  );

  for (const { room_id } of memberships) {
    await supabase.from('room_alerts').delete()
      .eq('room_id', room_id).eq('user_id', userId);

    if (nearExpiry.length > 0) {
      await supabase.from('room_alerts').insert(
        nearExpiry.map(r => ({
          room_id,
          user_id:      userId,
          username,
          pharmacy_name: pharmacyName,
          pharmacy_id:  pharmacyId,
          medicine_name: r.name,
          expiry:       r.expiry,
          days_left:    daysLeft(r.expiry),
          quantity:     r.quantity,
          price:        r.price ?? 0,
        }))
      );
    }
  }
}

// ── React Hook ────────────────────────────────────────────────────────────────

export function usePharmacyRooms(currentUser, inventory) {
  const [rooms, setRooms]                 = useState([]);
  const [hasNewRoomAlert, setHasNew]      = useState(false);
  const seenRef = useRef(new Set());

  const userId      = currentUser?.id;
  const username    = currentUser?.username;
  const pharmacyName = currentUser?.pharmacyName;
  const pharmacyId  = currentUser?.pharmacyId;

  const refresh = useCallback(async () => {
    if (!userId) return;
    const list = await getUserRooms(userId);
    setRooms(list);
    const alertKeys = list.flatMap(r =>
      r.alerts.filter(a => a.fromUsername !== username)
               .map(a => r.id + '|' + a.fromUsername + '|' + a.medicineName + '|' + a.expiry)
    );
    if (alertKeys.some(k => !seenRef.current.has(k))) setHasNew(true);
  }, [userId, username]);

  // Publish own alerts when inventory changes
  useEffect(() => {
    if (!userId || !Array.isArray(inventory)) return;
    publishRoomAlerts(userId, username, pharmacyName, pharmacyId, inventory);
  }, [userId, username, pharmacyName, pharmacyId, inventory]);

  useEffect(() => { if (userId) refresh(); }, [userId, refresh]);

  // Realtime — room_alerts and room_members changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('room-changes-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_alerts' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refresh]);

  const handleCreate = useCallback(({ roomName }) =>
    createRoom({ userId, username, pharmacyName, pharmacyId, roomName }),
  [userId, username, pharmacyName, pharmacyId]);

  const handleJoin = useCallback(({ roomId }) =>
    joinRoom({ roomId, userId, username, pharmacyName, pharmacyId }),
  [userId, username, pharmacyName, pharmacyId]);

  const handleLeave = useCallback(async (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    const isCreator = room?.createdBy === userId;
    await leaveRoom(roomId, userId, isCreator);
    refresh();
  }, [userId, rooms, refresh]);

  const markSeen = useCallback((roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    room.alerts.filter(a => a.fromUsername !== username).forEach(a => {
      seenRef.current.add(room.id + '|' + a.fromUsername + '|' + a.medicineName + '|' + a.expiry);
    });
    setHasNew(false);
  }, [rooms, username]);

  const totalRoomAlerts = rooms.reduce((sum, r) =>
    sum + r.alerts.filter(a => a.fromUsername !== username).length, 0);

  return {
    rooms, totalRoomAlerts, hasNewRoomAlert,
    createRoom: handleCreate,
    joinRoom:   handleJoin,
    leaveRoom:  handleLeave,
    markSeen,
    refresh,
  };
}
