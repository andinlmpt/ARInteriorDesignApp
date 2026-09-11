import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { api, type StoreInfo } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';

const EMPTY_STORE: StoreInfo = {
  storeName: '',
  tagline: '',
  description: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  website: '',
  facebook: '',
  instagram: '',
  businessHours: '',
  logoUrl: '',
};

type SectionId = 'logo' | 'basic' | 'contact' | 'online';

export function StoreInfoPage() {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<StoreInfo>(EMPTY_STORE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api
      .getStore()
      .then((res) => setForm(res.store))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load store info'))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof StoreInfo>(key: K, value: StoreInfo[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await api.updateStore(form);
      setForm(res.store);
      setMessage('Store information saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save store information');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, or WebP).');
      return;
    }

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const upload = await api.uploadThumbnail(file);
      const res = await api.updateStore({ ...form, logoUrl: upload.url });
      setForm(res.store);
      setMessage('Store logo updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  }

  const visibleSections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sections: Array<{ id: SectionId; keywords: string }> = [
      { id: 'logo', keywords: 'store logo branding upload' },
      {
        id: 'basic',
        keywords: `basic information store name tagline about description ${form.storeName} ${form.tagline} ${form.description}`,
      },
      {
        id: 'contact',
        keywords: `contact details email phone address city business hours ${form.email} ${form.phone} ${form.address} ${form.city} ${form.businessHours}`,
      },
      {
        id: 'online',
        keywords: `online presence website facebook instagram ${form.website} ${form.facebook} ${form.instagram}`,
      },
    ];

    if (!term) return new Set(sections.map((s) => s.id));
    return new Set(
      sections.filter((section) => section.keywords.toLowerCase().includes(term)).map((s) => s.id)
    );
  }, [form, search]);

  if (loading) {
    return <p>Loading store information…</p>;
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Store information for Maharlika Furniture."
        actions={
          <SearchBar
            placeholder="Search settings…"
            value={search}
            onChange={setSearch}
          />
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      {visibleSections.size === 0 ? (
        <div className="card empty-state">
          <h3>No settings found</h3>
          <p>No matches for “{search}”.</p>
        </div>
      ) : (
        <form className="stack-card" onSubmit={handleSave}>
          {visibleSections.has('logo') ? (
            <div className="card">
              <h2 className="section-title">Store logo</h2>
              <div className="profile-photo-row">
                <div className="settings-avatar">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt={form.storeName || 'Store logo'} />
                  ) : (
                    <span>MF</span>
                  )}
                </div>
                <div>
                  <p className="page-subtitle" style={{ marginBottom: 12 }}>
                    Upload your store logo for the admin console and future app branding.
                  </p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => handleLogoUpload(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={uploading}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Upload logo'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {visibleSections.has('basic') ? (
            <div className="card">
              <h2 className="section-title">Basic information</h2>
              <div className="field">
                <label htmlFor="storeName">Store name</label>
                <input
                  id="storeName"
                  value={form.storeName}
                  onChange={(e) => updateField('storeName', e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="tagline">Tagline</label>
                <input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => updateField('tagline', e.target.value)}
                  placeholder="Your vision, Our craft"
                />
              </div>
              <div className="field">
                <label htmlFor="description">About the store</label>
                <textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Short description of your furniture store"
                />
              </div>
            </div>
          ) : null}

          {visibleSections.has('contact') ? (
            <div className="card">
              <h2 className="section-title">Contact details</h2>
              <div className="form-grid-2">
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label htmlFor="city">City</label>
                  <input
                    id="city"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="businessHours">Business hours</label>
                  <input
                    id="businessHours"
                    value={form.businessHours}
                    onChange={(e) => updateField('businessHours', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {visibleSections.has('online') ? (
            <div className="card">
              <h2 className="section-title">Online presence</h2>
              <div className="field">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  value={form.website}
                  onChange={(e) => updateField('website', e.target.value)}
                  placeholder="https://"
                />
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label htmlFor="facebook">Facebook</label>
                  <input
                    id="facebook"
                    value={form.facebook}
                    onChange={(e) => updateField('facebook', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="instagram">Instagram</label>
                  <input
                    id="instagram"
                    value={form.instagram}
                    onChange={(e) => updateField('instagram', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <button type="submit" className="btn btn-dark" disabled={saving || uploading}>
              {saving ? 'Saving…' : 'Save store information'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
