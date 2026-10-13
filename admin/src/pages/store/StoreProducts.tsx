import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { storeApi, type FurnitureItem } from '../../api/client';
import { ConfirmModal } from '../../components/ConfirmModal';
import { FurnitureFormModal } from '../../components/FurnitureFormModal';
import { PageHeader } from '../../components/PageHeader';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { compareModelSize, modelSizeWarning } from '../../utils/modelSize';
import { productVisibility } from '../../utils/productVisibility';

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

function formatPhp(value?: number) {
  return value ? `₱${value.toLocaleString()}` : '—';
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

export function StoreProductsPage() {
  const { store } = useAuth();
  const canEdit = store?.status === 'approved';
  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FurnitureItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FurnitureItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    if (canEdit) {
      setEditingItem(null);
      setFormOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
  }, [canEdit, searchParams, setSearchParams]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await storeApi.listProducts();
      setItems(res.furniture);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [message]);

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

  async function toggleVisibility(item: FurnitureItem) {
    setMenuOpenId(null);
    setError('');
    try {
      await storeApi.updateProduct(item.id, { active: !item.active });
      setMessage(item.active ? `${item.displayName} is now hidden from the app` : `${item.displayName} is now shown in the app`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await storeApi.deleteProduct(deleteTarget.id);
      setMessage(`Deleted ${deleteTarget.displayName}`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-fill">
      <PageHeader
        title="Products"
        subtitle="Your furniture catalog. Live products appear in the mobile app."
        actions={
          <>
            <SearchBar placeholder="Search products…" value={search} onChange={setSearch} />
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
            <button
              type="button"
              className="btn btn-dark"
              onClick={openCreate}
              disabled={!canEdit}
              title={canEdit ? undefined : 'Available once an admin accepts your store'}
            >
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
            <p>
              {search
                ? `No matches for “${search}”.`
                : canEdit
                  ? 'Add your first product to get started.'
                  : 'You can add products once an admin accepts your store.'}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>In the app</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const qty = typeof item.quantity === 'number' ? item.quantity : 0;
                  const status = getStockStatus(qty);
                  const visibility = productVisibility(item);
                  const sizeWarning = modelSizeWarning(compareModelSize(item.modelSize, item));
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
                        <div className="muted small">{item.id}</div>
                        {sizeWarning ? (
                          <div className="model-size-flag" title="AR shows the 3D model at its own size">
                            ⚠ {sizeWarning}
                          </div>
                        ) : null}
                      </td>
                      <td>{item.category}</td>
                      <td>{formatPhp(item.pricePhp)}</td>
                      <td>{qty}</td>
                      <td>
                        <span className={`badge badge-${visibility.tone}`} title={visibility.detail}>
                          {visibility.label}
                        </span>
                        {item.takenDown && item.takenDownReason ? (
                          <div className="muted small" style={{ maxWidth: 220 }}>
                            Admin: {item.takenDownReason}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="status-cell" ref={menuOpen ? menuRef : undefined}>
                          <span className={`badge badge-stock badge-${status}`}>{stockLabel(status)}</span>
                          {canEdit ? (
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
                                  <button type="button" onClick={() => toggleVisibility(item)}>
                                    {item.active ? 'Hide from app' : 'Show in app'}
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      setDeleteTarget(item);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
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
        onSaved={async (text) => {
          setMessage(text);
          await load();
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete product"
        message={
          deleteTarget
            ? `Permanently delete “${deleteTarget.displayName}”? It will be removed from the mobile app and can't be restored. To keep it but stop selling it, use “Hide from app” instead.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
