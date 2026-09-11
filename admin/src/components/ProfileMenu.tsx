import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function getInitials(name?: string, email?: string) {
  const source = (name || email || 'A').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 17.5V20l3.2-2.1H16a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v5.4a4 4 0 0 0 3 3.9z" />
      <path d="M10.5 11h.01M13.5 11h.01M16.5 11h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 16h11l-1.1-1.8V10a4.4 4.4 0 1 0-8.8 0v4.2L6.5 16z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const photo = user?.avatar || user?.profilePicture || '';
  const initials = getInitials(user?.name, user?.email);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="topbar-actions" ref={menuRef}>
      <button type="button" className="topbar-icon-btn" aria-label="Messages" title="Messages">
        <IconChat />
      </button>
      <button type="button" className="topbar-icon-btn" aria-label="Notifications" title="Notifications">
        <IconBell />
      </button>

      <div className="profile-menu">
        <button
          type="button"
          className="profile-trigger"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Open profile menu"
          title={user?.name || user?.email || 'Profile'}
        >
          <span className="profile-avatar">
            {photo ? (
              <img src={photo} alt={user?.name || user?.email || 'Admin'} />
            ) : (
              <span>{initials}</span>
            )}
          </span>
        </button>

        {open ? (
          <div className="profile-dropdown">
            <div className="profile-dropdown-header">
              <span className="profile-avatar profile-avatar-lg">
                {photo ? (
                  <img src={photo} alt={user?.name || user?.email || 'Admin'} />
                ) : (
                  <span>{initials}</span>
                )}
              </span>
              <div>
                <strong>{user?.name || 'Admin'}</strong>
                <p>{user?.email}</p>
              </div>
            </div>
            <Link to="/profile" className="profile-dropdown-item" onClick={() => setOpen(false)}>
              Profile &amp; settings
            </Link>
            <button
              type="button"
              className="profile-dropdown-item danger"
              onClick={() => {
                setOpen(false);
                logout();
              }}
            >
              Log out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
