/**
 * pharmacyRooms.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pharmacy Network Rooms — isolated alert channels accessible only by members.
 *
 * DATA MODEL (stored in localStorage under ROOMS_KEY):
 * {
 *   [roomId]: {
 *     id: string,           // 8-char alphanumeric code e.g. "ROOM4F2A"
 *     name: string,         // human label
 *     createdBy: string,    // username of creator
 *     createdAt: string,    // ISO
 *     members: [
 *       { username, pharmacyName, pharmacyId, joinedAt }
 *     ],
 *     alerts: [             // latest near-expiry alerts per member
 *       { ...NetworkAlert, roomId }
 *     ]
 *   }
 * }
 *
 * CHANNEL: "pharmaai_rooms" — BroadcastChannel for real-time cross-tab updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const ROOMS_KEY    = 'pharmaai_rooms_v1';
const CHANNEL_NAME = 'pharmaai_rooms';

// ── helpers ──────────────────────────────────────────────────────────────────

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rooms = loadAllRooms();
  const taken = new Set(Object.keys(rooms));
  let id;
  do {
    id = 'R' + Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (taken.has(id));
  return id;
}

function daysLeft(expiryStr) {
  if (!expiryStr) return Infinity;
  return Math.ceil((new Date(expiryStr).getTime() - Date.now()) / 86400000);
}

// ── localStorage CRUD ────────────────────────────────────────────────────────

export function loadAllRooms() {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAllRooms(rooms) {
  try { localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms)); } catch {}
}

function broadcast(payload) {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage(payload);
    ch.close();
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new room. Returns { ok, room } | { ok: false, error }
 */
export function createRoom({ username, pharmacyName, pharmacyId, roomName }) {
  if (!roomName?.trim()) return { ok: false, error: 'Room name is required.' };
  const id = generateRoomId();
  const rooms = loadAllRooms();
  const room = {
    id,
    name: roomName.trim(),
    createdBy: username,
    createdAt: new Date().toISOString(),
    members: [{ username, pharmacyName, pharmacyId, joinedAt: new Date().toISOString() }],
    alerts: [],
  };
  rooms[id] = room;
  saveAllRooms(rooms);
  broadcast({ type: 'ROOM_UPDATED', roomId: id });
  return { ok: true, room };
}

/**
 * Join an existing room by ID. Returns { ok, room } | { ok: false, error }
 */
export function joinRoom({ roomId, username, pharmacyName, pharmacyId }) {
  const id = roomId.trim().toUpperCase();
  const rooms = loadAllRooms();
  if (!rooms[id]) return { ok: false, error: `Room "${id}" not found. Check the code and try again.` };
  const room = rooms[id];
  const alreadyIn = room.members.some(m => m.username === username);
  if (!alreadyIn) {
    room.members.push({ username, pharmacyName, pharmacyId, joinedAt: new Date().toISOString() });
    rooms[id] = room;
    saveAllRooms(rooms);
    broadcast({ type: 'ROOM_UPDATED', roomId: id });
  }
  return { ok: true, room };
}

/**
 * Leave a room. Creator leaving dissolves it.
 */
export function leaveRoom(roomId, username) {
  const rooms = loadAllRooms();
  if (!rooms[roomId]) return;
  const room = rooms[roomId];
  if (room.createdBy === username) {
    // Creator dissolves the room
    delete rooms[roomId];
  } else {
    room.members = room.members.filter(m => m.username !== username);
    room.alerts  = room.alerts.filter(a => a.fromUsername !== username);
    rooms[roomId] = room;
  }
  saveAllRooms(rooms);
  broadcast({ type: 'ROOM_UPDATED', roomId });
}

/**
 * Publish this user's near-expiry alerts to every room they're in.
 */
export function publishRoomAlerts(username, pharmacyName, pharmacyId, inventory) {
  if (!username || !Array.isArray(inventory)) return;
  const rooms = loadAllRooms();
  let changed = false;

  const myAlerts = inventory
    .filter(r => r.quantity > 0 && r.expiry && daysLeft(r.expiry) <= 90)
    .map(r => ({
      fromUsername:     username,
      fromPharmacyName: pharmacyName || username,
      fromPharmacyId:   pharmacyId   || '',
      medicineName:     r.name,
      expiry:           r.expiry,
      daysLeft:         daysLeft(r.expiry),
      quantity:         r.quantity,
      price:            r.price ?? 0,
      publishedAt:      new Date().toISOString(),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  Object.keys(rooms).forEach(rid => {
    const room = rooms[rid];
    if (!room.members.some(m => m.username === username)) return;
    // Remove old alerts from this user and replace with fresh batch
    const others = room.alerts.filter(a => a.fromUsername !== username);
    room.alerts = [...others, ...myAlerts].sort((a, b) => a.daysLeft - b.daysLeft);
    rooms[rid] = room;
    changed = true;
  });

  if (changed) {
    saveAllRooms(rooms);
    broadcast({ type: 'ROOM_ALERTS_UPDATE', from: username });
  }
}

/**
 * Get all rooms that this user is a member of. Returns array of room objects.
 */
export function getUserRooms(username) {
  const rooms = loadAllRooms();
  return Object.values(rooms).filter(r => r.members.some(m => m.username === username));
}

/**
 * Get all alerts from a specific room (excluding own alerts).
 */
export function getRoomAlerts(roomId, currentUsername) {
  const rooms = loadAllRooms();
  const room = rooms[roomId];
  if (!room) return [];
  return room.alerts.filter(a => a.fromUsername !== currentUsername);
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * usePharmacyRooms(currentUser, inventory)
 *
 * Manages room membership, publishes alerts, and subscribes to real-time updates.
 * Returns:
 *   rooms          – rooms the user is in
 *   activeRoomId   – currently selected room
 *   setActiveRoomId
 *   totalRoomAlerts – count of unseen room alerts across all rooms
 *   hasNewRoomAlert  – boolean for badge pulse
 *   createRoom / joinRoom / leaveRoom wrappers
 *   refresh
 */
export function usePharmacyRooms(currentUser, inventory) {
  const [rooms, setRooms]               = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [hasNewRoomAlert, setHasNewRoomAlert] = useState(false);
  const seenRef = useRef(new Set());

  const username     = currentUser?.username;
  const pharmacyName = currentUser?.pharmacyName;
  const pharmacyId   = currentUser?.pharmacyId;

  // Refresh rooms from localStorage
  const refresh = useCallback(() => {
    if (!username) return;
    const list = getUserRooms(username);
    setRooms(list);

    // Check for new room alerts
    const alertKeys = list.flatMap(r =>
      r.alerts
        .filter(a => a.fromUsername !== username)
        .map(a => r.id + '|' + a.fromUsername + '|' + a.medicineName + '|' + a.expiry)
    );
    const newOnes = alertKeys.filter(k => !seenRef.current.has(k));
    if (newOnes.length > 0) setHasNewRoomAlert(true);
  }, [username]);

  // Publish own alerts whenever inventory changes
  useEffect(() => {
    if (!username || !Array.isArray(inventory)) return;
    publishRoomAlerts(username, pharmacyName, pharmacyId, inventory);
  }, [username, pharmacyName, pharmacyId, inventory]);

  // Initial load
  useEffect(() => { if (username) refresh(); }, [username, refresh]);

  // BroadcastChannel + storage event subscriptions
  useEffect(() => {
    if (!username) return;
    let ch;
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (e) => {
        if (['ROOM_UPDATED', 'ROOM_ALERTS_UPDATE'].includes(e.data?.type)) {
          if (e.data.from !== username) refresh();
        }
      };
    } catch {}
    const onStorage = (e) => { if (e.key === ROOMS_KEY) refresh(); };
    window.addEventListener('storage', onStorage);
    return () => {
      try { ch?.close(); } catch {}
      window.removeEventListener('storage', onStorage);
    };
  }, [username, refresh]);

  // Poll for cross-tab updates every 10 s (fallback for same-tab multi-user demo)
  useEffect(() => {
    if (!username) return;
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [username, refresh]);

  const handleCreate = useCallback(({ roomName }) => {
    return createRoom({ username, pharmacyName, pharmacyId, roomName });
  }, [username, pharmacyName, pharmacyId]);

  const handleJoin = useCallback(({ roomId }) => {
    return joinRoom({ roomId, username, pharmacyName, pharmacyId });
  }, [username, pharmacyName, pharmacyId]);

  const handleLeave = useCallback((roomId) => {
    leaveRoom(roomId, username);
    refresh();
    if (activeRoomId === roomId) setActiveRoomId(null);
  }, [username, activeRoomId, refresh]);

  const markSeen = useCallback((roomId) => {
    const rooms = getUserRooms(username);
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    room.alerts
      .filter(a => a.fromUsername !== username)
      .forEach(a => {
        seenRef.current.add(room.id + '|' + a.fromUsername + '|' + a.medicineName + '|' + a.expiry);
      });
    setHasNewRoomAlert(false);
  }, [username]);

  const totalRoomAlerts = rooms.reduce((sum, r) =>
    sum + r.alerts.filter(a => a.fromUsername !== username).length, 0);

  return {
    rooms, activeRoomId, setActiveRoomId,
    totalRoomAlerts, hasNewRoomAlert,
    createRoom: handleCreate,
    joinRoom:   handleJoin,
    leaveRoom:  handleLeave,
    markSeen,
    refresh,
  };
}
