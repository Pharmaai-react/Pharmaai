import { useState } from 'react';
import { PharmacyIcon } from '../Icons.jsx';

export default function LoginPage({ onLogin, onGoToSignUp }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const errorMsg = await onLogin(username, password);
      // errorMsg is a string on failure, null on success
      if (errorMsg) {
        setError(errorMsg);
        setPassword('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <PharmacyIcon size={28} fill="white" />
          </div>
          <span className="login-logo-text">PharmaAI</span>
        </div>

        <p className="login-subtitle">
          Smart Pharmacy Inventory System<br />
          <strong>Sign in to access your dashboard</strong>
        </p>

        {error && <div className="login-error">{error}</div>}

        <div className="login-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              placeholder="e.g. admin or your username"
              autoComplete="username"
              value={username}
              disabled={loading}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              disabled={loading}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="remember-row">
            <label>
              <input type="checkbox" /> Remember me
            </label>
            <a onClick={() => {}}>Forgot password?</a>
          </div>

          <button
            id="login-submit-btn"
            className="login-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In to PharmaAI'}
          </button>
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button id="goto-signup-btn" className="signup-cta-btn" onClick={onGoToSignUp}>
          ✨ Create a New Pharmacy Account
        </button>
      </div>
    </div>
  );
}
