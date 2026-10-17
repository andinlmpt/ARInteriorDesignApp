import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { StoreRegistrationInput } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const EMPTY: StoreRegistrationInput = {
  storeName: '',
  ownerName: '',
  email: '',
  password: '',
  phone: '',
  address: '',
  city: '',
  businessPermit: '',
  description: '',
};

export function StoreRegisterPage() {
  const { user, loading, registerStore } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<StoreRegistrationInput>(EMPTY);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  function update<K extends keyof StoreRegistrationInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await registerStore({ ...form, email: form.email.trim() });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page login-page-scroll">
      <aside className="login-brand">
        <span className="login-blob login-blob--navy" aria-hidden="true" />
        <span className="login-blob login-blob--orange" aria-hidden="true" />

        <div className="login-brand-content">
          <div className="login-logo-frame">
            <img src="/visionspace-mark.png" alt="VisionSpace" className="login-logo" />
          </div>
          <h1>Sell on VisionSpace</h1>
          <p>Show your furniture in customers' rooms with AR</p>
        </div>
      </aside>

      <main className="login-main">
        <form className="login-form register-form" onSubmit={handleSubmit}>
          <div className="login-heading">
            <span className="login-heading-accent" aria-hidden="true" />
            <h2>Register your store</h2>
            <p>An admin reviews every store before its products go live.</p>
          </div>

          {error ? (
            <div className="alert alert-error login-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="storeName">Store name *</label>
            <input id="storeName" value={form.storeName} onChange={(e) => update('storeName', e.target.value)} required />
          </div>

          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="ownerName">Owner name</label>
              <input id="ownerName" value={form.ownerName} onChange={(e) => update('ownerName', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone *</label>
              <input id="phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email (used to sign in) *</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password *</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="address">Store address *</label>
              <input id="address" value={form.address} onChange={(e) => update('address', e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="city">City</label>
              <input id="city" value={form.city} onChange={(e) => update('city', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="businessPermit">Business permit / DTI or SEC number</label>
            <input
              id="businessPermit"
              value={form.businessPermit}
              onChange={(e) => update('businessPermit', e.target.value)}
              placeholder="Helps the admin verify your store"
            />
          </div>

          <div className="field">
            <label htmlFor="description">About your store</label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What kind of furniture do you sell?"
            />
          </div>

          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? <span className="login-spinner" aria-label="Submitting" /> : 'Submit for review'}
          </button>

          <p className="login-note">
            Already registered? <Link to="/login" className="login-link">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
