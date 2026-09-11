import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type FurnitureItem } from '../api/client';
import { ConfirmModal } from '../components/ConfirmModal';
import { FurnitureFormModal } from '../components/FurnitureFormModal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { resolveAssetUrl } from '../utils/assetUrl';

type SortOption = 'name-asc' | 'name-desc' | 'category' | 'newest';
type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

const LOW_STOCK_MAX = 5;

function getStockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= LOW_STOCK_MAX) return 'low-stock';
  return 'in-stock';
}

function stockLabel(status: StockStatus) {
  if (status === 'out-of-stock') return 'Out of Stock';
  if (status === 'low-stock') return 'Low Stock';
  return 'In Stock';
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

export function FurnitureListPage() {
  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FurnitureItem | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<FurnitureItem | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.listFurniture(false);
      setItems(res.furniture);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load furniture');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? items.filter((item) =>
          [
            item.displayName,
            item.id,
            item.category,
            item.dimensionLabel,
            String(item.quantity ?? ''),
            ...(item.availableColors || []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(term)
        )
      : [...items];

    list.sort((a, b) => {
      if (sortBy === 'name-desc') {
        return b.displayName.localeCompare(a.displayName, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'category') {
        const byCategory = a.category.localeCompare(b.category, undefined, { sensitivity: 'base' });
        if (byCategory !== 0) return byCategory;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'newest') {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      }
      return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
    });

    return list;
  }, [items, search, sortBy]);

  function openCreate() {
    setMenuOpenId(null);
    setEditingItem(null);
    setFormOpen(true);
  }

  function openEdit(item: FurnitureItem) {
    setMenuOpenId(null);
    setEditingItem(item);
    setFormOpen(true);
  }

  function openDeactivate(item: FurnitureItem) {
    setMenuOpenId(null);
    setDeactivateTarget(item);
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setError('');
    try {
      await api.deleteFurniture(deactivateTarget.id, false);
      setMessage(`Deactivated ${deactivateTarget.displayName}`);
      setDeactivateTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="page-fill">
      <PageHeader
        title="Products"
        subtitle="Manage furniture catalog shown in the mobile app."
        actions={
          <>
            <SearchBar
              placeholder="Search products…"
              value={search}
              onChange={setSearch}
            />
            <label className="sort-control">
              <span className="sr-only">Sort products</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort products"
              >
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="category">Category</option>
                <option value="newest">Newest</option>
              </select>
            </label>
            <button type="button" className="btn btn-dark" onClick={openCreate}>
              Add product
            </button>
          </>
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="card table-card">
        {loading ? (
          <p style={{ padding: 20 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>{search ? `No matches for “${search}”.` : 'Add your first product to get started.'}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Available colors</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const qty = typeof item.quantity === 'number' ? item.quantity : 0;
                  const status = getStockStatus(qty);
                  const menuOpen = menuOpenId === item.id;

                  return (
                    <tr key={item.id}>
                      <td>
                        {item.thumbnailUrl ? (
                          <img
                            src={resolveAssetUrl(item.thumbnailUrl)}
                            alt={item.displayName}
                            className="product-preview"
                          />
                        ) : (
                          <div className="product-preview product-preview-empty">No img</div>
                        )}
                      </td>
                      <td>
                        <strong>{item.displayName}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{item.id}</div>
                      </td>
                      <td>{item.category}</td>
                      <td>{qty}</td>
                      <td style={{ maxWidth: 220 }}>
                        {(item.availableColors || []).length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {item.availableColors.map((color) => (
                              <span key={color} className="badge badge-user">
                                {color}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div
                          className="status-cell"
                          ref={menuOpen ? menuRef : undefined}
                        >
                          <span className={`badge badge-stock badge-${status}`}>
                            {stockLabel(status)}
                          </span>
                          <div className="row-menu">
                            <button
                              type="button"
                              className="row-menu-trigger"
                              aria-label={`Actions for ${item.displayName}`}
                              aria-expanded={menuOpen}
                              onClick={() => setMenuOpenId(menuOpen ? null : item.id)}
                            >
                              <IconMore />
                            </button>
                            {menuOpen ? (
                              <div className="row-menu-dropdown">
                                <button type="button" onClick={() => openEdit(item)}>
                                  Edit
                                </button>
                                {item.active ? (
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => openDeactivate(item)}
                                  >
                                    Deactivate
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FurnitureFormModal
        open={formOpen}
        item={editingItem}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSaved={(text) => {
          setMessage(text);
          load();
        }}
      />

      <ConfirmModal
        open={Boolean(deactivateTarget)}
        title="Deactivate product"
        message={
          deactivateTarget
            ? `Deactivate “${deactivateTarget.displayName}”? It will disappear from the mobile app.`
            : ''
        }
        confirmLabel="Deactivate"
        danger
        busy={deactivating}
        onClose={() => {
          if (!deactivating) setDeactivateTarget(null);
        }}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}
