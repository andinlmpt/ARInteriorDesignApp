import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { storeApi, type Store, type StoreProfileInput } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { resolveAssetUrl } from '../../utils/assetUrl';

const EMPTY_PROFILE: StoreProfileInput = {
  name: '',
  tagline: '',
  description: '',
  businessPermit: '',
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

function toProfile(store: Store): StoreProfileInput {
  const profile = { ...EMPTY_PROFILE };
  (Object.keys(EMPTY_PROFILE) as (keyof StoreProfileInput)[]).forEach((key) => {
    profile[key] = store[key] ?? '';
  });
  return profile;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (name.trim() || 'S').slice(0, 2).toUpperCase();
}

export function StoreProfilePage() {
  const { store, setStore } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<StoreProfileInput>(store ? toProfile(store) : EMPTY_PROFILE);
  const [loading, setLoading] = useState(!store);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const readOnly = store?.status === 'suspended';

  useEffect(() => {
    storeApi
      .getMyStore()
      .then((res) => {
        setStore(res.store);
        setForm(toProfile(res.store));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load store profile'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField<K extends keyof StoreProfileInput>(key: K, value: StoreProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await storeApi.updateMyStore(form);
      setStore(res.store);
      setForm(toProfile(res.store));
      setMessage('Store profile saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save store profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleResubmit() {
    setResubmitting(true);
    setError('');
    setMessage('');
    try {
      const saved = await storeApi.updateMyStore(form);
      setStore(saved.store);
      const res = await storeApi.resubmit();
      setStore(res.store);
      setMessage('Submitted for review. An admin will look at your store again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resubmit your store');
    } finally {
      setResubmitting(false);
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
      const upload = await storeApi.uploadImage(file);
      const res = await storeApi.updateMyStore({ ...form, logoUrl: upload.url });
      setStore(res.store);
      setForm(toProfile(res.store));
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
        keywords: `basic information store name tagline about description business permit dti ${form.name} ${form.tagline} ${form.description} ${form.businessPermit}`,
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
    return <p>Loading store profile…</p>;
  }

  return (
    <div>
      <PageHeader
        title="Store profile"
        subtitle="How your store appears to customers and to the platform admin."
        actions={<SearchBar placeholder="Search profile…" value={search} onChange={setSearch} />}
      />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      {visibleSections.size === 0 ? (
        <div className="card empty-state">
          <h3>Nothing found</h3>
          <p>No matches for “{search}”.</p>
        </div>
      ) : (
        <form className="stack-card" onSubmit={handleSave}>
          <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="stack-card">
            {visibleSections.has('logo') ? (
              <div className="card">
                <h2 className="section-title">Store logo</h2>
                <div className="profile-photo-row">
                  <div className="settings-avatar">
                    {form.logoUrl ? (
                      <img src={resolveAssetUrl(form.logoUrl)} alt={form.name || 'Store logo'} />
                    ) : (
                      <span>{initials(form.name)}</span>
                    )}
                  </div>
                  <div>
                    <p className="page-subtitle" style={{ marginBottom: 12 }}>
                      Shown in your store console and next to your products.
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
                  <label htmlFor="name">Store name</label>
                  <input id="name" value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="tagline">Tagline</label>
                  <input
                    id="tagline"
                    value={form.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    placeholder="Your vision, our craft"
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
                <div className="field">
                  <label htmlFor="businessPermit">Business permit / DTI or SEC number</label>
                  <input
                    id="businessPermit"
                    value={form.businessPermit}
                    onChange={(e) => updateField('businessPermit', e.target.value)}
                  />
                  <small className="muted">Helps the admin verify your store.</small>
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
                    <input id="phone" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="address">Address</label>
                  <input id="address" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
                </div>
                <div className="form-grid-2">
                  <div className="field">
                    <label htmlFor="city">City</label>
                    <input id="city" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
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
                    <input id="facebook" value={form.facebook} onChange={(e) => updateField('facebook', e.target.value)} />
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

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-dark" disabled={saving || uploading || resubmitting}>
                {saving ? 'Saving…' : 'Save store profile'}
              </button>
              {store?.status === 'rejected' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleResubmit}
                  disabled={saving || uploading || resubmitting}
                >
                  {resubmitting ? 'Submitting…' : 'Save and resubmit for review'}
                </button>
              ) : null}
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
