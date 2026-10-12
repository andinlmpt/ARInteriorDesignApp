import { useEffect, useMemo, useState } from 'react';
import { adminApi, api, type Faq } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { formatRelativeTime } from '../utils/dashboard';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';

/** A FAQ being edited; `key` keeps React rows stable while the list is reordered. */
interface FaqDraft extends Faq {
  key: string;
}

let nextKey = 0;
const toDrafts = (faqs: Faq[]): FaqDraft[] => faqs.map((faq) => ({ ...faq, key: `faq-${nextKey++}` }));
const snapshot = (faqs: Faq[]) => JSON.stringify(faqs.map(({ question, answer }) => ({ question, answer })));

export function FaqsPage() {
  const [faqs, setFaqs] = useState<FaqDraft[]>([]);
  const [saved, setSaved] = useState('[]');
  const [isDefault, setIsDefault] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const dirty = snapshot(faqs) !== saved;
  useUnsavedChangesWarning(dirty);

  function applyServer(content: { faqs: Faq[]; isDefault: boolean; updatedAt: string | null }) {
    setFaqs(toDrafts(content.faqs));
    setSaved(snapshot(content.faqs));
    setIsDefault(content.isDefault);
    setUpdatedAt(content.updatedAt);
  }

  useEffect(() => {
    api
      .getFaqs()
      .then(applyServer)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load FAQs'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  function updateFaq(key: string, field: 'question' | 'answer', value: string) {
    setFaqs((items) => items.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  }

  function addFaq() {
    setSearch('');
    setFaqs((items) => [...items, ...toDrafts([{ question: '', answer: '' }])]);
  }

  function removeFaq(key: string) {
    setFaqs((items) => items.filter((item) => item.key !== key));
  }

  function moveFaq(key: string, offset: -1 | 1) {
    setFaqs((items) => {
      const from = items.findIndex((item) => item.key === key);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= items.length) return items;
      const next = [...items];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  async function saveFaqs() {
    setSaving(true);
    setError('');
    try {
      const res = await adminApi.saveFaqs(faqs.map(({ question, answer }) => ({ question, answer })));
      applyServer(res);
      setMessage('FAQs saved. The mobile app shows them now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save FAQs');
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setFaqs(toDrafts(JSON.parse(saved) as Faq[]));
    setError('');
  }

  const searching = search.trim().length > 0;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return faqs;
    return faqs.filter((faq) => [faq.question, faq.answer].join(' ').toLowerCase().includes(term));
  }, [faqs, search]);

  const subtitle = isDefault
    ? 'Questions shown on the Help screen of the mobile app.'
    : `Questions shown on the Help screen of the mobile app. Last saved: ${updatedAt ? formatRelativeTime(updatedAt) : '—'}`;

  return (
    <div>
      <PageHeader
        title="FAQs"
        subtitle={subtitle}
        actions={
          <>
            <SearchBar placeholder="Search FAQs…" value={search} onChange={setSearch} />
            <button type="button" className="btn btn-ghost" onClick={addFaq} disabled={loading}>
              Add FAQ
            </button>
            {dirty ? (
              <button type="button" className="btn btn-ghost" onClick={discardChanges} disabled={saving}>
                Discard
              </button>
            ) : null}
            <button type="button" className="btn btn-dark" onClick={saveFaqs} disabled={!dirty || saving || loading}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </>
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {isDefault && !loading ? (
        <div className="status-banner status-banner-pending">
          These are the app’s built-in FAQs. Edit them and save to manage them from here.
        </div>
      ) : null}

      <div className="stack-card">
        {loading ? (
          <div className="card">Loading FAQs…</div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <h3>No FAQs found</h3>
            <p>{searching ? `No matches for “${search}”.` : 'Add your first FAQ. The Help screen hides the section while the list is empty.'}</p>
          </div>
        ) : (
          filtered.map((faq) => {
            const index = faqs.indexOf(faq);
            return (
              <div key={faq.key} className="card faq-card">
                <div className="faq-card-header">
                  <h3 className="faq-label">FAQ {index + 1}</h3>
                  <div className="table-actions">
                    {!searching ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => moveFaq(faq.key, -1)}
                          disabled={index === 0}
                          aria-label={`Move FAQ ${index + 1} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          onClick={() => moveFaq(faq.key, 1)}
                          disabled={index === faqs.length - 1}
                          aria-label={`Move FAQ ${index + 1} down`}
                        >
                          ↓
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-small btn-danger-text"
                      onClick={() => removeFaq(faq.key)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`q-${faq.key}`}>Question</label>
                  <input
                    id={`q-${faq.key}`}
                    value={faq.question}
                    maxLength={300}
                    onChange={(e) => updateFaq(faq.key, 'question', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`a-${faq.key}`}>Answer</label>
                  <textarea
                    id={`a-${faq.key}`}
                    rows={3}
                    value={faq.answer}
                    maxLength={3000}
                    onChange={(e) => updateFaq(faq.key, 'answer', e.target.value)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
