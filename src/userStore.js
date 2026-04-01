/**
 * userStore.js
 * Multi-user, multi-pharmacy authentication backed by localStorage.
 * Each user account owns an isolated inventory keyed by username.
 */

const USERS_KEY = 'pharmaai_users_v1';

// ─── seed accounts (pre-loaded so demo still works) ─────────────────────────
const SEED_USERS = {
  admin: {
    password: 'admin123',
    name: 'Dr. Smith',
    role: 'Administrator',
    initials: 'DS',
    pharmacyName: 'MediCare Pharmacy',
    pharmacyAddress: '123 Health Ave, Mumbai',
    createdAt: '2024-01-01T00:00:00Z',
  },
  doctor: {
    password: 'pharma2024',
    name: 'Dr. Johnson',
    role: 'Pharmacist',
    initials: 'DJ',
    pharmacyName: 'City Pharmacy',
    pharmacyAddress: '456 Wellness St, Delhi',
    createdAt: '2024-01-01T00:00:00Z',
  },
  staff: {
    password: 'staff123',
    name: 'Sarah Khan',
    role: 'Staff Member',
    initials: 'SK',
    pharmacyName: 'Wellness Drugs',
    pharmacyAddress: '789 Care Blvd, Bangalore',
    createdAt: '2024-01-01T00:00:00Z',
  },
};

// ─── load / save ──────────────────────────────────────────────────────────────

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // First run — seed default accounts
  localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  return { ...SEED_USERS };
}

function saveUsers(users) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {}
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Attempt login.
 * @returns {object|null} user record (without password) on success, null on failure
 */
export function loginUser(username, password) {
  const users = loadUsers();
  const key = username.trim().toLowerCase();
  const user = users[key];
  if (!user || user.password !== password) return null;
  const { password: _pw, ...safeUser } = user;
  return { username: key, ...safeUser };
}

/**
 * Register a new account.
 * @returns {{ ok: true, user } | { ok: false, error: string }}
 */
export function registerUser({ username, password, name, role, pharmacyName, pharmacyAddress }) {
  if (!username || !password || !name || !pharmacyName) {
    return { ok: false, error: 'All required fields must be filled.' };
  }
  if (username.length < 3) {
    return { ok: false, error: 'Username must be at least 3 characters.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  const users = loadUsers();
  const key = username.trim().toLowerCase();

  if (users[key]) {
    return { ok: false, error: 'Username already taken. Please choose another.' };
  }

  // Derive initials from name
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const newUser = {
    password,
    name: name.trim(),
    role: role || 'Pharmacist',
    initials,
    pharmacyName: pharmacyName.trim(),
    pharmacyAddress: (pharmacyAddress || '').trim(),
    createdAt: new Date().toISOString(),
  };

  users[key] = newUser;
  saveUsers(users);

  const { password: _pw, ...safeUser } = newUser;
  return { ok: true, user: { username: key, ...safeUser } };
}

/** Check if a username is available (for real-time validation) */
export function isUsernameAvailable(username) {
  if (!username || username.length < 3) return false;
  const users = loadUsers();
  return !users[username.trim().toLowerCase()];
}
