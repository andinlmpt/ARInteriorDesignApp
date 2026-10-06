import { FormEvent, useEffect, useState } from 'react';
import { api, type FurnitureItem } from '../api/client';
import { resolveAssetUrl } from '../utils/assetUrl';
import { Modal } from './Modal';

const CATEGORIES = [
  { value: 'chair', label: 'Chair' },
  { value: 'sofa', label: 'Sofa' },
  { value: 'beds', label: 'Beds' },
];

const DESIGN_STYLES = [
  'Minimalist',
  'Modern',
  'Scandinavian',
  'Industrial',
  'Contemporary',
  'Traditional',
  'Rustic',
];

const ROOM_TYPES = [
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Dining Room',
  'Office',
  'Bathroom',
];

const emptyForm: Partial<FurnitureItem> = {
  displayName: '',
  category: 'chair',
  glbUrl: '',
  thumbnailUrl: '',
  width: 2,
  height: 0.85,
  depth: 0.9,
  dimensionLabel: '',
  lengthIn: 0,
  widthIn: 0,
  heightIn: 0,
  quantity: 0,
  availableColors: [],
  active: true,
  sortOrder: 0,
  pricePhp: 0,
  styles: [],
  roomTypes: [],
};

type FurnitureFormModalProps = {
  open: boolean;
  item?: FurnitureItem | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function FurnitureFormModal({ open, item, onClose, onSaved }: FurnitureFormModalProps) {
  const isEdit = Boolean(item?.id);
  const [form, setForm] = useState<Partial<FurnitureItem>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingGlb, setUploadingGlb] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setMessage('');
    setForm(item ? { ...item } : { ...emptyForm });
  }, [open, item]);

  function updateField<K extends keyof FurnitureItem>(key: K, value: FurnitureItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleListValue(key: 'styles' | 'roomTypes', value: string) {
    setForm((prev) => {
      const list = Array.isArray(prev[key]) ? [...(prev[key] as string[])] : [];
      const index = list.indexOf(value);
      if (index >= 0) list.splice(index, 1);
      else list.push(value);
      return { ...prev, [key]: list, ...(key === 'roomTypes' ? { rooms: list } : {}) };
    });
  }

  async function handleGlbUpload(file: File | null) {
    if (!file) return;
    setUploadingGlb(true);
    setError('');
    try {
      const res = await api.uploadGlb(file);
      updateField('glbUrl', res.url);
      setMessage(`GLB uploaded (${res.filename})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GLB upload failed');
    } finally {
      setUploadingGlb(false);
    }
  }

  async function handleThumbUpload(file: File | null) {
    if (!file) return;
    setUploadingThumb(true);
    setError('');
    try {
      const res = await api.uploadThumbnail(file);
      updateField('thumbnailUrl', res.url);
      setMessage(`Thumbnail uploaded (${res.filename})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thumbnail upload failed');
    } finally {
      setUploadingThumb(false);
    }
  }

  function buildPayload(): Partial<FurnitureItem> {
    return {
      displayName: form.displayName?.trim() || '',
      category: form.category || CATEGORIES[0].value,
      glbUrl: form.glbUrl || '',
      thumbnailUrl: form.thumbnailUrl || '',
      width: Number(form.width) || 0,
      height: Number(form.height) || 0,
      depth: Number(form.depth) || 0,
      dimensionLabel: form.dimensionLabel || '',
      lengthIn: Number(form.lengthIn) || 0,
      widthIn: Number(form.widthIn) || 0,
      heightIn: Number(form.heightIn) || 0,
      quantity: Math.max(0, Math.floor(Number(form.quantity) || 0)),
      availableColors: Array.isArray(form.availableColors) ? form.availableColors : [],
      pricePhp: Math.max(0, Math.round(Number(form.pricePhp) || 0)),
      styles: Array.isArray(form.styles) ? form.styles : [],
      roomTypes: Array.isArray(form.roomTypes) ? form.roomTypes : [],
      rooms: Array.isArray(form.roomTypes) ? form.roomTypes : [],
      active: form.active !== false,
      sortOrder: Number(form.sortOrder) || 0,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = buildPayload();
      if (isEdit && item?.id) {
        await api.updateFurniture(item.id, payload);
        onSaved(`Updated ${payload.displayName || item.id}`);
      } else {
        await api.createFurniture(payload);
        onSaved(`Created ${payload.displayName || 'product'}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      wide
      title={isEdit ? 'Edit product' : 'Add product'}
      subtitle="Upload GLB and thumbnail files, then publish to the mobile app."
      onClose={saving ? () => undefined : onClose}
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="modal-displayName">Display name</label>
          <input
            id="modal-displayName"
            value={form.displayName || ''}
            onChange={(e) => updateField('displayName', e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="modal-category">Category</label>
          <select
            id="modal-category"
            value={form.category || CATEGORIES[0].value}
            onChange={(e) => updateField('category', e.target.value)}
          >
            {form.category && !CATEGORIES.some((cat) => cat.value === form.category) ? (
              <option value={form.category} disabled>
                {form.category} (choose a new category)
              </option>
            ) : null}
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="modal-pricePhp">Price (₱)</label>
          <input
            id="modal-pricePhp"
            type="number"
            min={0}
            step={100}
            value={form.pricePhp ?? 0}
            onChange={(e) => updateField('pricePhp', Math.max(0, Math.round(Number(e.target.value) || 0)))}
            placeholder="e.g. 18999"
          />
          <small style={{ color: 'var(--muted)' }}>Used for budget-aware AI layouts. 0 = mock price on mobile.</small>
        </div>

        <div className="field">
          <label>Design styles</label>
          <div className="chip-row">
            {DESIGN_STYLES.map((style) => {
              const selected = (form.styles || []).includes(style);
              return (
                <button
                  key={style}
                  type="button"
                  className={`chip-toggle${selected ? ' chip-toggle-active' : ''}`}
                  onClick={() => toggleListValue('styles', style)}
                >
                  {style}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label>Suitable rooms</label>
          <div className="chip-row">
            {ROOM_TYPES.map((room) => {
              const selected = (form.roomTypes || form.rooms || []).includes(room);
              return (
                <button
                  key={room}
                  type="button"
                  className={`chip-toggle${selected ? ' chip-toggle-active' : ''}`}
                  onClick={() => toggleListValue('roomTypes', room)}
                >
                  {room}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label htmlFor="modal-quantity">Quantity</label>
          <input
            id="modal-quantity"
            type="number"
            min={0}
            step={1}
            value={form.quantity ?? 0}
            onChange={(e) => updateField('quantity', Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            placeholder="0"
          />
        </div>

        <div className="field">
          <label htmlFor="modal-availableColors">Available colors</label>
          <input
            id="modal-availableColors"
            value={(form.availableColors || []).join(', ')}
            onChange={(e) =>
              updateField(
                'availableColors',
                e.target.value
                  .split(',')
                  .map((color) => color.trim())
                  .filter(Boolean)
              )
            }
            placeholder="e.g. Taupe, Light Gray, Mocha Beige, Dark Gray"
          />
          <small style={{ color: 'var(--muted)' }}>Separate colors with commas.</small>
        </div>

        <div className="field">
          <label>GLB file</label>
          <input
            type="file"
            accept=".glb,.gltf"
            onChange={(e) => handleGlbUpload(e.target.files?.[0] || null)}
            disabled={uploadingGlb}
          />
          {form.glbUrl ? (
            <small style={{ color: 'var(--muted)' }}>{form.glbUrl}</small>
          ) : (
            <small style={{ color: 'var(--danger)' }}>Upload a GLB before saving</small>
          )}
        </div>

        <div className="field">
          <label>Thumbnail</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleThumbUpload(e.target.files?.[0] || null)}
            disabled={uploadingThumb}
          />
          {form.thumbnailUrl ? (
            <img
              src={resolveAssetUrl(form.thumbnailUrl)}
              alt="Thumbnail preview"
              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, marginTop: 8 }}
            />
          ) : null}
        </div>

        <div className="form-grid-3">
          <div className="field">
            <label htmlFor="modal-width">Width (m)</label>
            <input
              id="modal-width"
              type="number"
              step="0.01"
              value={form.width ?? 0}
              onChange={(e) => updateField('width', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="modal-height">Height (m)</label>
            <input
              id="modal-height"
              type="number"
              step="0.01"
              value={form.height ?? 0}
              onChange={(e) => updateField('height', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="modal-depth">Depth (m)</label>
            <input
              id="modal-depth"
              type="number"
              step="0.01"
              value={form.depth ?? 0}
              onChange={(e) => updateField('depth', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="modal-dimensionLabel">Dimension label</label>
          <input
            id="modal-dimensionLabel"
            value={form.dimensionLabel || ''}
            onChange={(e) => updateField('dimensionLabel', e.target.value)}
            placeholder='e.g. 84" W x 36" D x 34" H'
          />
        </div>

        <div className="form-grid-3">
          <div className="field">
            <label htmlFor="modal-lengthIn">Length (in)</label>
            <input
              id="modal-lengthIn"
              type="number"
              value={form.lengthIn ?? 0}
              onChange={(e) => updateField('lengthIn', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="modal-widthIn">Width (in)</label>
            <input
              id="modal-widthIn"
              type="number"
              value={form.widthIn ?? 0}
              onChange={(e) => updateField('widthIn', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="modal-heightIn">Height (in)</label>
            <input
              id="modal-heightIn"
              type="number"
              value={form.heightIn ?? 0}
              onChange={(e) => updateField('heightIn', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="field">
            <label htmlFor="modal-sortOrder">Sort order</label>
            <input
              id="modal-sortOrder"
              type="number"
              value={form.sortOrder ?? 0}
              onChange={(e) => updateField('sortOrder', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="modal-active">Active in mobile app</label>
            <select
              id="modal-active"
              value={form.active ? 'true' : 'false'}
              onChange={(e) => updateField('active', e.target.value === 'true')}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <div className="modal-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || uploadingGlb || uploadingThumb}
          >
            {saving ? 'Saving…' : isEdit ? 'Update product' : 'Create product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
