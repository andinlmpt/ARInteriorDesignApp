import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';

function getInitials(name?: string, email?: string) {
  const source = (name || email || 'A').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const photo = user?.avatar || user?.profilePicture || '';

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await api.updateProfile({ name: name.trim() });
      setUser(res.user);
      setMessage('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoChange(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, or WebP).');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const upload = await api.uploadAvatar(file);
      const res = await api.updateProfile({ avatar: upload.url });
      setUser(res.user);
      setMessage('Profile picture updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload picture');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Your admin account details and photo."
      />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="stack-card">
        <div className="card">
          <h2 className="section-title">Profile picture</h2>
          <div className="profile-photo-row">
            <div className="settings-avatar">
              {photo ? (
                <img src={photo} alt={user?.name || user?.email || 'Admin'} />
              ) : (
                <span>{getInitials(user?.name, user?.email)}</span>
              )}
            </div>
            <div>
              <p className="page-subtitle" style={{ marginBottom: 12 }}>
                Upload a square photo so it shows clearly in the top-right profile menu.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className="btn btn-dark"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Upload picture'}
              </button>
            </div>
          </div>
        </div>

        <form className="card" onSubmit={handleSave}>
          <h2 className="section-title">Account</h2>
          <div className="field">
            <label htmlFor="admin-name">Name</label>
            <input
              id="admin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Admin name"
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={user?.email || ''} disabled />
          </div>
          <div className="field">
            <label>Role</label>
            <div>
              <span className="badge badge-admin">{user?.role}</span>
            </div>
          </div>
          <button type="submit" className="btn btn-dark" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <div className="card">
          <h2 className="section-title">Session</h2>
          <p className="page-subtitle" style={{ marginBottom: 16 }}>
            Sign out of the admin console on this device.
          </p>
          <button type="button" className="btn btn-dark" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
