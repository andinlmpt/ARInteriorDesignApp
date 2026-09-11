import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

const SAMPLE_LOGS = [
  {
    id: '1',
    action: 'Admin login',
    detail: 'admin@gmail.com signed in to the console',
    when: 'Just now',
  },
  {
    id: '2',
    action: 'Store settings viewed',
    detail: 'Opened Settings / store information',
    when: 'Today',
  },
];

export function ActivityLogsPage() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return SAMPLE_LOGS;
    return SAMPLE_LOGS.filter((log) =>
      [log.action, log.detail, log.when].join(' ').toLowerCase().includes(term)
    );
  }, [search]);

  return (
    <div>
      <PageHeader
        title="Activity Logs"
        subtitle="Track admin actions and system events."
        actions={
          <SearchBar
            placeholder="Search activity…"
            value={search}
            onChange={setSearch}
          />
        }
      />

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No activity found</h3>
            <p>{search ? `No matches for “${search}”.` : 'No activity yet.'}</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Detail</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td>{log.action}</td>
                  <td>{log.detail}</td>
                  <td>{log.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
