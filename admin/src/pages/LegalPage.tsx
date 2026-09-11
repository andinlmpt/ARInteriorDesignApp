import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

export function LegalPage() {
  const [terms, setTerms] = useState(
    'Terms of service content for Maharlika Furniture. Update this text from the admin console.'
  );
  const [privacy, setPrivacy] = useState(
    'Privacy policy content for Maharlika Furniture. Update this text from the admin console.'
  );
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  function saveLegal() {
    setMessage('Legal content saved locally for now. Backend persistence can be added next.');
    setTimeout(() => setMessage(''), 3000);
  }

  const sections = useMemo(() => {
    const all = [
      { id: 'terms', title: 'Terms of Service', value: terms, setter: setTerms },
      { id: 'privacy', title: 'Privacy Policy', value: privacy, setter: setPrivacy },
    ];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((section) =>
      [section.title, section.value].join(' ').toLowerCase().includes(term)
    );
  }, [terms, privacy, search]);

  return (
    <div>
      <PageHeader
        title="Legal"
        subtitle="Terms of service and privacy policy content."
        actions={
          <>
            <SearchBar
              placeholder="Search legal pages…"
              value={search}
              onChange={setSearch}
            />
            <button type="button" className="btn btn-dark" onClick={saveLegal}>
              Save changes
            </button>
          </>
        }
      />

      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="stack-card">
        {sections.length === 0 ? (
          <div className="card empty-state">
            <h3>No sections found</h3>
            <p>No matches for “{search}”.</p>
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.id} className="card">
              <h2 className="section-title">{section.title}</h2>
              <div className="field">
                <textarea
                  rows={8}
                  value={section.value}
                  onChange={(e) => section.setter(e.target.value)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
