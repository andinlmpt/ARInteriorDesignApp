import { FormEvent, KeyboardEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const REMEMBERED_EMAIL_KEY = 'admin.rememberedEmail';

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconEye({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M4 4l16 16" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) !== null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  function handlePasswordKey(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState('CapsLock'));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const trimmedEmail = email.trim();

    try {
      await login(trimmedEmail, password);
      if (remember) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <aside className="login-brand">
        <span className="login-blob login-blob--navy" aria-hidden="true" />
        <span className="login-blob login-blob--orange" aria-hidden="true" />

        <div className="login-brand-content">
          <div className="login-logo-frame">
            <img src="/maharlika-logo.png" alt="Maharlika Furniture" className="login-logo" />
          </div>
          <h1>Maharlika Furniture</h1>
          <p>Your vision, our craft</p>
        </div>
      </aside>

      <main className="login-main">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-heading">
            <span className="login-heading-accent" aria-hidden="true" />
            <h2>Welcome back</h2>
            <p>Sign in to the admin console</p>
          </div>

          {error ? (
            <div className="alert alert-error login-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="float-field">
            <span className="float-icon">
              <IconMail />
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
              autoComplete="email"
              autoFocus={!email}
              required
            />
            <label htmlFor="email">Email address</label>
          </div>

          <div className="float-field">
            <span className="float-icon">
              <IconLock />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={handlePasswordKey}
              onKeyDown={handlePasswordKey}
              onBlur={() => setCapsLockOn(false)}
              placeholder=" "
              autoComplete="current-password"
              autoFocus={!!email}
              required
            />
            <label htmlFor="password">Password</label>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <IconEye open={showPassword} />
            </button>
          </div>

          {capsLockOn ? <p className="caps-warning">Caps Lock is on</p> : null}

          <div className="login-options">
            <label className="remember-me">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="remember-box" aria-hidden="true" />
              Remember me
            </label>
            <button type="button" className="forgot-password-link">
              Forgot password?
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? <span className="login-spinner" aria-label="Signing in" /> : 'Sign in'}
          </button>

          <p className="login-note">Admin access only. Contact your administrator for credentials.</p>
        </form>
      </main>
    </div>
  );
}
