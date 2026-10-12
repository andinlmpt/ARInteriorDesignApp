import { useEffect, useMemo, useState } from 'react';
import { adminApi, api, type LegalDoc, type LegalKey } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { formatRelativeTime } from '../utils/dashboard';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';

const KEYS: LegalKey[] = ['terms', 'privacy'];

type Docs = Record<LegalKey, LegalDoc>;

export function LegalPage() {
  const [docs, setDocs] = useState<Docs | null>(null);
  const [drafts, setDrafts] = useState<Record<LegalKey, string>>({ terms: '', privacy: '' });
  const [saving, setSaving] = useState<LegalKey | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const isDirty = (key: LegalKey) => Boolean(docs) && drafts[key] !== docs![key].body;
  useUnsavedChangesWarning(KEYS.some(isDirty));

  useEffect(() => {
    api
      .getLegal()
      .then((res) => {
        setDocs({ terms: res.terms, privacy: res.privacy });
        setDrafts({ terms: res.terms.body, privacy: res.privacy.body });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load legal pages'));
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  async function save(key: LegalKey) {
    setSaving(key);
    setError('');
    try {
      const res = await adminApi.saveLegal(key, drafts[key]);
      const doc = res[key];
      if (doc) {
        setDocs((prev) => (prev ? { ...prev, [key]: doc } : prev));
        setDrafts((prev) => ({ ...prev, [key]: doc.body }));
        setMessage(`${doc.title} saved. The mobile app shows it now.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  const visibleKeys = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || !docs) return KEYS;
    return KEYS.filter((key) => `${docs[key].title} ${drafts[key]}`.toLowerCase().includes(term));
  }, [docs, drafts, search]);

  return (
    <div>
      <PageHeader
        title="Legal"
        subtitle="Terms of Service and Privacy Policy shown in the mobile app."
        actions={<SearchBar placeholder="Search legal pages…" value={search} onChange={setSearch} />}
      />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="stack-card">
        {!docs ? (
          <div className="card">{error ? 'Could not load the legal pages.' : 'Loading legal pages…'}</div>
        ) : visibleKeys.length === 0 ? (
          <div className="card empty-state">
            <h3>No sections found</h3>
            <p>No matches for “{search}”.</p>
          </div>
        ) : (
          visibleKeys.map((key) => {
            const doc = docs[key];
            const dirty = isDirty(key);
            return (
              <div key={key} className="card">
                <h2 className="section-title">{doc.title}</h2>
                <p className="content-hint">
                  Start a line with <code>##</code> for a heading and with <code>•</code> or <code>-</code> for a bullet.
                  Leave a blank line between paragraphs.
                </p>
                <div className="field">
                  <textarea
                    aria-label={doc.title}
                    rows={14}
                    value={drafts[key]}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
                <div className="content-card-footer">
                  <span className="muted small">
                    {doc.isDefault
                      ? 'Built-in text. Not edited yet.'
                      : `Last saved: ${doc.updatedAt ? formatRelativeTime(doc.updatedAt) : '—'}`}
                    {dirty ? ' · Unsaved changes' : ''}
                  </span>
                  <div className="table-actions">
                    {dirty ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setDrafts((prev) => ({ ...prev, [key]: doc.body }))}
                        disabled={saving === key}
                      >
                        Discard
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={() => save(key)}
                      disabled={!dirty || saving !== null || !drafts[key].trim()}
                    >
                      {saving === key ? 'Saving…' : dirty ? `Save ${doc.title}` : 'Saved'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
