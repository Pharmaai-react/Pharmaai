import { useState, useEffect } from 'react';
import { PharmacyIcon } from '../Icons.jsx';
import { registerUser, isUsernameAvailable, isPharmacyIdAvailable, generatePharmacyId } from '../userStore.js';

const ROLES = ['Pharmacist', 'Administrator', 'Doctor', 'Staff Member', 'Technician'];

export default function SignUpPage({ onSignUp, onGoToLogin }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'Pharmacist',
    pharmacyName: '',
    pharmacyAddress: '',
    pharmacyId: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);  // null | 'checking' | 'available' | 'taken'
  const [pidStatus, setPidStatus] = useState(null);            // null | 'checking' | 'available' | 'taken' | 'invalid'
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Live username availability check
  useEffect(() => {
    if (form.username.length < 3) { setUsernameStatus(null); return; }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      const available = await isUsernameAvailable(form.username);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 400);
    return () => clearTimeout(t);
  }, [form.username]);

  // Live Pharmacy ID validation + uniqueness check
  useEffect(() => {
    const raw = form.pharmacyId.trim().toUpperCase();
    if (!raw) { setPidStatus(null); return; }
    if (!/^[A-Z0-9]{1,10}$/.test(raw)) { setPidStatus('invalid'); return; }
    setPidStatus('checking');
    const t = setTimeout(async () => {
      const available = await isPharmacyIdAvailable(raw);
      setPidStatus(available ? 'available' : 'taken');
    }, 350);
    return () => clearTimeout(t);
  }, [form.pharmacyId]);

  const update = (field) => (e) => {
    let val = e.target.value;
    // Auto-uppercase pharmacyId as user types; strip illegal chars
    if (field === 'pharmacyId') {
      val = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    }
    setForm((prev) => ({ ...prev, [field]: val }));
    setError('');
  };

  const handleGenerate = () => {
    const id = generatePharmacyId();
    setForm((prev) => ({ ...prev, pharmacyId: id }));
    setError('');
  };

  const validateStep1 = () => {
    if (!form.name.trim()) return 'Please enter your full name.';
    if (form.username.length < 3) return 'Username must be at least 3 characters.';
    if (usernameStatus === 'taken') return 'That username is already taken.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleNext = () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setStep(2);
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.pharmacyName.trim()) { setError('Pharmacy name is required.'); return; }
    const pid = form.pharmacyId.trim().toUpperCase();
    if (!pid) { setError('Pharmacy ID is required.'); return; }
    if (!/^[A-Z0-9]{1,10}$/.test(pid)) { setError('Pharmacy ID must be 1–10 alphanumeric characters (A–Z, 0–9).'); return; }
    if (pidStatus === 'taken') { setError(`Pharmacy ID "${pid}" is already registered.`); return; }
    if (pidStatus === 'invalid') { setError('Pharmacy ID contains invalid characters.'); return; }

    setLoading(true);
    setError('');
    try {
      const result = await registerUser({ ...form, pharmacyId: pid });
      if (!result.ok) { setError(result.error); return; }
      setSuccess(`Welcome to PharmaAI, ${result.user.name}! Redirecting...`);
      setTimeout(() => onSignUp(result.user), 1200);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') step === 1 ? handleNext() : handleSubmit();
  };

  const strengthScore = (() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][strengthScore] || '';
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#0d9488', '#10b981'][strengthScore] || '';

  // Pharmacy ID status label/icon
  const pidLabel = {
    available: { text: '✓ Available', cls: 'available' },
    taken:     { text: '✗ Already registered', cls: 'taken' },
    invalid:   { text: '✗ A–Z and 0–9 only, max 10 chars', cls: 'taken' },
    checking:  { text: 'Checking…', cls: 'checking' },
  }[pidStatus] || null;

  const pidInputClass = [
    'form-input pid-input',
    pidStatus === 'available' ? 'input-success' : '',
    pidStatus === 'taken' || pidStatus === 'invalid' ? 'input-error' : '',
  ].join(' ').trim();

  return (
    <div className="login-page signup-page">
      <div className="login-card signup-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <PharmacyIcon size={28} fill="white" />
          </div>
          <span className="login-logo-text">PharmaAI</span>
        </div>

        <p className="login-subtitle">
          Smart Pharmacy Inventory System<br />
          <strong>Create your pharmacy account</strong>
        </p>

        {/* Step indicator */}
        <div className="signup-steps">
          <div className={`signup-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
            <div className="step-circle">{step > 1 ? '✓' : '1'}</div>
            <span>Account</span>
          </div>
          <div className="step-divider" />
          <div className={`signup-step ${step >= 2 ? 'active' : ''}`}>
            <div className="step-circle">2</div>
            <span>Pharmacy</span>
          </div>
        </div>

        {error   && <div className="login-error">{error}</div>}
        {success && <div className="signup-success">{success}</div>}

        {/* ── Step 1: Account Details ── */}
        {step === 1 && (
          <div className="login-form">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                id="signup-name" type="text" className="form-input"
                placeholder="e.g. Dr. Priya Sharma"
                value={form.name} onChange={update('name')} onKeyDown={handleKeyDown} autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Username *
                {usernameStatus === 'available' && <span className="username-status available"> ✓ Available</span>}
                {usernameStatus === 'taken'     && <span className="username-status taken"> ✗ Already taken</span>}
                {usernameStatus === 'checking'  && <span className="username-status checking"> Checking...</span>}
              </label>
              <input
                id="signup-username" type="text" autoComplete="username"
                className={`form-input ${usernameStatus === 'taken' ? 'input-error' : ''} ${usernameStatus === 'available' ? 'input-success' : ''}`}
                placeholder="Choose a unique username"
                value={form.username} onChange={update('username')} onKeyDown={handleKeyDown}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select id="signup-role" className="form-input form-select" value={form.role} onChange={update('role')}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <div className="password-wrapper">
                <input
                  id="signup-password"
                  type={showPass ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Min. 6 characters"
                  value={form.password} onChange={update('password')} onKeyDown={handleKeyDown}
                  autoComplete="new-password"
                />
                <button type="button" className="password-toggle" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {form.password && (
                <div className="strength-bar-wrap">
                  <div className="strength-bar">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="strength-segment"
                        style={{ background: i <= strengthScore ? strengthColor : '#e2e8f0' }} />
                    ))}
                  </div>
                  <span className="strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                id="signup-confirm-password" type="password" autoComplete="new-password"
                className={`form-input ${form.confirmPassword && form.password !== form.confirmPassword ? 'input-error' : ''} ${form.confirmPassword && form.password === form.confirmPassword ? 'input-success' : ''}`}
                placeholder="Re-enter your password"
                value={form.confirmPassword} onChange={update('confirmPassword')} onKeyDown={handleKeyDown}
              />
            </div>

            <button id="signup-next-btn" className="login-btn" onClick={handleNext}>
              Next: Pharmacy Details →
            </button>
          </div>
        )}

        {/* ── Step 2: Pharmacy Details ── */}
        {step === 2 && (
          <div className="login-form">
            <div className="form-group">
              <label className="form-label">Pharmacy Name *</label>
              <input
                id="signup-pharmacy-name" type="text" className="form-input"
                placeholder="e.g. City MediCare Pharmacy"
                value={form.pharmacyName} onChange={update('pharmacyName')} onKeyDown={handleKeyDown} autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
              <input
                id="signup-pharmacy-address" type="text" className="form-input"
                placeholder="e.g. 42 Health Street, Mumbai"
                value={form.pharmacyAddress} onChange={update('pharmacyAddress')} onKeyDown={handleKeyDown}
              />
            </div>

            {/* ── Pharmacy ID ── */}
            <div className="form-group">
              <label className="form-label">
                Pharmacy ID *
                {pidLabel && (
                  <span className={`username-status ${pidLabel.cls}`}> {pidLabel.text}</span>
                )}
              </label>

              <div className="pid-field-row">
                <input
                  id="signup-pharmacy-id"
                  type="text"
                  className={pidInputClass}
                  placeholder="e.g. PH001AB234"
                  maxLength={10}
                  value={form.pharmacyId}
                  onChange={update('pharmacyId')}
                  onKeyDown={handleKeyDown}
                  style={{ fontFamily: "'Space Grotesk', monospace", letterSpacing: 2, textTransform: 'uppercase' }}
                />
                <button
                  type="button"
                  className="pid-generate-btn"
                  onClick={handleGenerate}
                  title="Auto-generate a unique Pharmacy ID"
                >
                  ⚡ Generate
                </button>
              </div>

              <div className="pid-hint">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Exactly 10 characters · Letters A–Z and digits 0–9 only · Must be globally unique ·{' '}
                <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>
                  {form.pharmacyId.length}/10
                </span>
              </div>
            </div>

            {/* Account summary */}
            <div className="signup-account-summary">
              <div className="summary-row">
                <span>👤 Name</span><strong>{form.name}</strong>
              </div>
              <div className="summary-row">
                <span>🔑 Username</span><strong>@{form.username}</strong>
              </div>
              <div className="summary-row">
                <span>🎓 Role</span><strong>{form.role}</strong>
              </div>
              {form.pharmacyId && (
                <div className="summary-row">
                  <span>🏥 Pharmacy ID</span>
                  <strong style={{ fontFamily: "'Space Grotesk', monospace", letterSpacing: 1.5, color: 'var(--accent-teal)' }}>
                    {form.pharmacyId.toUpperCase()}
                  </strong>
                </div>
              )}
            </div>

            <div className="signup-btn-row">
              <button
                id="signup-back-btn"
                className="login-btn signup-back"
                onClick={() => { setStep(1); setError(''); }}
                disabled={loading}
              >
                ← Back
              </button>
              <button
                id="signup-submit-btn"
                className="login-btn"
                onClick={handleSubmit}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Creating account…' : '🚀 Create My Pharmacy'}
              </button>
            </div>
          </div>
        )}

        {/* Switch to Login */}
        <div className="signup-footer">
          Already have an account?{' '}
          <button id="goto-login-btn" className="link-btn" onClick={onGoToLogin}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
