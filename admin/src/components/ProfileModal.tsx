import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

function getInitials(name?: string, email?: string) {
  const source = (name || email || 'A').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) {
      setName(user?.name || '');
      setError('');
      setMessage('');
    }
  }, [open, user?.name]);

  const photo = user?.avatar || user?.profilePicture || '';
  const nameChanged = name.trim() !== (user?.name || '');

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

  return createPortal(
    <Modal
      open={open}
      title="Profile"
      subtitle="Your admin account details and photo."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            type="submit"
            form="profile-modal-form"
            className="btn btn-dark"
            disabled={saving || !nameChanged}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="profile-modal-photo">
        <div className="settings-avatar">
          {photo ? (
            <img src={photo} alt={user?.name || user?.email || 'Admin'} />
          ) : (
            <span>{getInitials(user?.name, user?.email)}</span>
          )}
        </div>
        <div>
          <strong>{user?.name || 'Admin'}</strong>
          <span className="badge badge-admin">{user?.role}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => handlePhotoChange(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            className="profile-modal-upload"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'Uploading…' : 'Change photo'}
          </button>
        </div>
      </div>

      <form id="profile-modal-form" onSubmit={handleSave}>
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
          <label htmlFor="admin-email">Email</label>
          <input id="admin-email" value={user?.email || ''} disabled />
        </div>
      </form>
    </Modal>,
    document.body,
  );
}
