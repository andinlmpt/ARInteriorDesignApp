import { useEffect, useState } from 'react';
import { adminApi, type ActivityEntry } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { activityLabel, formatRelativeTime } from '../utils/dashboard';

export function ActivityLogsPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      adminApi
        .listActivity(search.trim(), 200)
        .then((res) => setEntries(res.activity))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load activity'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <div>
      <PageHeader
        title="Activity Logs"
        subtitle="Store registrations, approvals, and product changes across the platform."
        actions={<SearchBar placeholder="Search activity…" value={search} onChange={setSearch} />}
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <h3>No activity found</h3>
            <p>{search ? `No matches for “${search}”.` : 'Actions by admins and stores will appear here.'}</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Detail</th>
                <th>By</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{activityLabel(entry.action)}</td>
                  <td>{entry.summary}</td>
                  <td>
                    {entry.actorEmail || '—'}
                    {entry.actorRole ? <div className="muted small">{entry.actorRole}</div> : null}
                  </td>
                  <td title={new Date(entry.createdAt).toLocaleString()}>{formatRelativeTime(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
