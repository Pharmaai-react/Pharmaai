/**
 * userStore.js — Supabase Auth version
 * Auth email format: username@pharmaai.local (internal convention)
 * All user-facing interactions remain username-based.
 */
import { supabase } from './supabase.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function toEmail(username) {
  return `${username.trim().toLowerCase()}@pharmaai.local`;
}

function profileToUser(profile) {
  return {
    id:              profile.id,
    username:        profile.username,
    name:            profile.name,
    role:            profile.role,
    initials:        profile.initials,
    pharmacyName:    profile.pharmacy_name,
    pharmacyAddress: profile.pharmacy_address,
    pharmacyId:      profile.pharmacy_id,
    createdAt:       profile.created_at,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function registerUser({
  username, password, name, role,
  pharmacyName, pharmacyAddress, pharmacyId,
}) {
  if (!username || !password || !name || !pharmacyName) {
    return { ok: false, error: 'All required fields must be filled.' };
  }
  if (username.length < 3) {
    return { ok: false, error: 'Username must be at least 3 characters.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  const pid = (pharmacyId || '').trim().toUpperCase();
  if (!pid || !/^[A-Z0-9]{1,10}$/.test(pid)) {
    return { ok: false, error: 'Pharmacy ID must be 1–10 alphanumeric characters.' };
  }

  // Check username uniqueness
  const { data: uCheck } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();
  if (uCheck) return { ok: false, error: 'Username already taken.' };

  // Check pharmacy ID uniqueness
  const { data: pCheck } = await supabase
    .from('profiles')
    .select('id')
    .eq('pharmacy_id', pid)
    .maybeSingle();
  if (pCheck) return { ok: false, error: `Pharmacy ID "${pid}" is already registered.` };

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: toEmail(username),
    password,
  });
  if (authError) return { ok: false, error: authError.message };

  const initials = name
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('');

  // Create profile row
  const { error: profileError } = await supabase.from('profiles').insert({
    id:               authData.user.id,
    username:         username.trim().toLowerCase(),
    name:             name.trim(),
    role:             role || 'Pharmacist',
    initials,
    pharmacy_name:    pharmacyName.trim(),
    pharmacy_address: (pharmacyAddress || '').trim(),
    pharmacy_id:      pid,
  });
  if (profileError) return { ok: false, error: profileError.message };

  const user = {
    id: authData.user.id,
    username: username.trim().toLowerCase(),
    name: name.trim(), role: role || 'Pharmacist',
    initials, pharmacyName: pharmacyName.trim(),
    pharmacyAddress: (pharmacyAddress || '').trim(),
    pharmacyId: pid,
  };
  return { ok: true, user };
}

export async function loginUser(username, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(username),
    password,
  });
  if (error || !data?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (!profile) return null;

  return profileToUser(profile);
}

export async function logoutUser() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (!profile) return null;

  return profileToUser(profile);
}

export async function isUsernameAvailable(username) {
  if (!username || username.length < 3) return false;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.trim().toLowerCase())
    .maybeSingle();
  return !data;
}

export async function isPharmacyIdAvailable(pharmacyId) {
  const pid = pharmacyId.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(pid)) return false;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('pharmacy_id', pid)
    .maybeSingle();
  return !data;
}

export function generatePharmacyId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 10 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
