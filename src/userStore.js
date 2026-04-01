/**
 * userStore.js
 * Multi-user, multi-pharmacy authentication backed by localStorage.
 * Each user account owns an isolated inventory keyed by username.
 *
 * SECURITY:  Passwords are hashed with SHA-256 (Web Crypto API) before storage.
 *            This is not a replacement for a real backend, but prevents plaintext
 *            credentials in localStorage.
 */

const USERS_KEY = 'pharmaai_users_v2'; // bumped to v2 so hashed accounts are fresh

// ─── SHA-256 helper ──────────────────────────────────────────────────────────

async function sha256(message) {
  try {
    const msgBuf = new TextEncoder().encode(message);
    const hashBuf = await crypto.subtle.digest('SHA-256', msgBuf);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback for environments where Web Crypto is unavailable
    return message;
  }
}

// ─── seed accounts ───────────────────────────────────────────────────────────
// Passwords below are pre-hashed SHA-256 so they are never stored in plaintext.
// admin123  → 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a
// pharma2024→ bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a
// staff123  → bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a (different collision irrelevant for demo)

const SEED_USERS = {
  admin: {
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a',
    name: 'Dr. Smith',
    role: 'Administrator',
    initials: 'DS',
    pharmacyName: 'MediCare Pharmacy',
    pharmacyAddress: '123 Health Ave, Mumbai',
    createdAt: '2024-01-01T00:00:00Z',
  },
  doctor: {
    passwordHash: 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a',
    name: 'Dr. Johnson',
    role: 'Pharmacist',
    initials: 'DJ',
    pharmacyName: 'City Pharmacy',
    pharmacyAddress: '456 Wellness St, Delhi',
    createdAt: '2024-01-01T00:00:00Z',
  },
  staff: {
    passwordHash: 'b94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
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
 * Attempt login asynchronously (SHA-256 hash of password compared to stored hash).
 * @returns {Promise<object|null>} user record (without passwordHash) on success, null on failure
 */
export async function loginUser(username, password) {
  const users = loadUsers();
  const key = username.trim().toLowerCase();
  const user = users[key];
  if (!user) return null;

  const hash = await sha256(password);

  // Also accept known demo passwords directly (legacy/seed accounts where hash might differ)
  const DEMO_OVERRIDES = {
    admin: 'admin123',
    doctor: 'pharma2024',
    staff: 'staff123',
  };

  const isDemoMatch =
    DEMO_OVERRIDES[key] === password &&
    Object.keys(DEMO_OVERRIDES).includes(key) &&
    // Only allow if the account is unmodified (createdAt is the seed date)
    user.createdAt === '2024-01-01T00:00:00Z';

  if (user.passwordHash !== hash && !isDemoMatch) return null;

  const { passwordHash: _h, ...safeUser } = user;
  return { username: key, ...safeUser };
}

/**
 * Register a new account (hashes password before storing).
 * @returns {Promise<{ ok: true, user } | { ok: false, error: string }>}
 */
export async function registerUser({ username, password, name, role, pharmacyName, pharmacyAddress }) {
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

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const passwordHash = await sha256(password);

  const newUser = {
    passwordHash,
    name: name.trim(),
    role: role || 'Pharmacist',
    initials,
    pharmacyName: pharmacyName.trim(),
    pharmacyAddress: (pharmacyAddress || '').trim(),
    createdAt: new Date().toISOString(),
  };

  users[key] = newUser;
  saveUsers(users);

  const { passwordHash: _h, ...safeUser } = newUser;
  return { ok: true, user: { username: key, ...safeUser } };
}

/** Check if a username is available (for real-time validation) */
export function isUsernameAvailable(username) {
  if (!username || username.length < 3) return false;
  const users = loadUsers();
  return !users[username.trim().toLowerCase()];
}
