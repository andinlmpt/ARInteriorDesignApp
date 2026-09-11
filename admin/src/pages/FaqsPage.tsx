import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const DEFAULT_FAQS: FaqItem[] = [
  {
    id: '1',
    question: 'How do I place furniture in AR?',
    answer: 'Open the Camera tab, select a product, and tap on a detected floor surface.',
  },
  {
    id: '2',
    question: 'Can I save my room designs?',
    answer: 'Yes. Saved designs appear under Projects in your profile.',
  },
];

export function FaqsPage() {
  const [faqs, setFaqs] = useState<FaqItem[]>(DEFAULT_FAQS);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  function updateFaq(id: string, field: 'question' | 'answer', value: string) {
    setFaqs((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function addFaq() {
    setFaqs((items) => [
      ...items,
      { id: String(Date.now()), question: '', answer: '' },
    ]);
  }

  function saveFaqs() {
    setMessage('FAQs saved locally for now. Backend persistence can be added next.');
    setTimeout(() => setMessage(''), 3000);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return faqs;
    return faqs.filter((faq) =>
      [faq.question, faq.answer].join(' ').toLowerCase().includes(term)
    );
  }, [faqs, search]);

  return (
    <div>
      <PageHeader
        title="FAQs"
        subtitle="Manage frequently asked questions shown in the app."
        actions={
          <>
            <SearchBar
              placeholder="Search FAQs…"
              value={search}
              onChange={setSearch}
            />
            <button type="button" className="btn btn-ghost" onClick={addFaq}>
              Add FAQ
            </button>
            <button type="button" className="btn btn-dark" onClick={saveFaqs}>
              Save changes
            </button>
          </>
        }
      />

      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="stack-card">
        {filtered.length === 0 ? (
          <div className="card empty-state">
            <h3>No FAQs found</h3>
            <p>{search ? `No matches for “${search}”.` : 'Add your first FAQ.'}</p>
          </div>
        ) : (
          filtered.map((faq, index) => (
            <div key={faq.id} className="card faq-card">
              <h3 className="faq-label">FAQ {index + 1}</h3>
              <div className="field">
                <label htmlFor={`q-${faq.id}`}>Question</label>
                <input
                  id={`q-${faq.id}`}
                  value={faq.question}
                  onChange={(e) => updateFaq(faq.id, 'question', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor={`a-${faq.id}`}>Answer</label>
                <textarea
                  id={`a-${faq.id}`}
                  rows={3}
                  value={faq.answer}
                  onChange={(e) => updateFaq(faq.id, 'answer', e.target.value)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
