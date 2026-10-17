import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, type FurnitureItem, type Store } from '../api/client';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { resolveAssetUrl } from '../utils/assetUrl';
import { compareModelSize, modelSizeWarning } from '../utils/modelSize';

const UNASSIGNED = 'unassigned';

function formatPhp(value?: number) {
  return value ? `₱${value.toLocaleString()}` : '—';
}

export function ProductsOverviewPage() {
  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeFilter, setStoreFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [takeDown, setTakeDown] = useState<FurnitureItem | null>(null);
  const [reason, setReason] = useState('');
  const [assigning, setAssigning] = useState<FurnitureItem | null>(null);
  const [assignStoreId, setAssignStoreId] = useState('');
  const [bulkStoreId, setBulkStoreId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [products, storeList] = await Promise.all([adminApi.listFurniture(), adminApi.listStores('all')]);
      setItems(products.furniture);
      setStores(storeList.stores);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const approvedStores = useMemo(() => stores.filter((s) => s.status === 'approved'), [stores]);
  const unassignedCount = useMemo(() => items.filter((item) => !item.storeId).length, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (storeFilter === UNASSIGNED && item.storeId) return false;
      if (storeFilter && storeFilter !== UNASSIGNED && item.storeId !== storeFilter) return false;
      if (!term) return true;
      return [item.displayName, item.id, item.category, item.storeName].join(' ').toLowerCase().includes(term);
    });
  }, [items, search, storeFilter]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError('');
    try {
      setMessage(await action());
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmTakeDown() {
    if (!takeDown) return;
    if (!reason.trim()) {
      setError('Add a reason so the store knows why it was taken down.');
      return;
    }
    const target = takeDown;
    const ok = await run(async () => {
      await adminApi.moderateFurniture(target.id, true, reason.trim());
      return `Took down ${target.displayName}`;
    });
    if (ok) setTakeDown(null);
  }

  function restore(item: FurnitureItem) {
    run(async () => {
      await adminApi.moderateFurniture(item.id, false);
      return `Restored ${item.displayName}`;
    });
  }

  async function confirmAssign() {
    if (!assigning || !assignStoreId) return;
    const target = assigning;
    const ok = await run(async () => {
      const res = await adminApi.assignFurnitureStore(target.id, assignStoreId);
      return `${target.displayName} now belongs to ${res.furniture.storeName}`;
    });
    if (ok) setAssigning(null);
  }

  function assignAllUnassigned() {
    if (!bulkStoreId) return;
    const store = stores.find((s) => s.id === bulkStoreId);
    run(async () => {
      const res = await adminApi.assignUnassignedFurniture(bulkStoreId);
      return `Assigned ${res.assigned} products to ${store?.name ?? 'the store'}`;
    });
  }

  return (
    <div className="page-fill">
      <PageHeader
        title="Products"
        subtitle="Every store's products. Stores add and edit their own; you can take a product down."
        actions={
          <>
            <SearchBar placeholder="Search products or stores…" value={search} onChange={setSearch} />
            <select
              className="filter-select"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              aria-label="Filter by store"
            >
              <option value="">All stores</option>
              <option value={UNASSIGNED}>No store yet</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </>
        }
      />

      {error && !takeDown ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      {unassignedCount > 0 ? (
        <div className="status-banner status-banner-pending">
          <div className="inline-assign">
            <span>
              <strong>{unassignedCount} products aren’t linked to a store yet.</strong> They still show in the app.
              Assign them to the store that sells them:
            </span>
            <select
              value={bulkStoreId}
              onChange={(e) => setBulkStoreId(e.target.value)}
              aria-label="Store to assign products to"
            >
              <option value="">Choose an approved store…</option>
              {approvedStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-dark" disabled={!bulkStoreId || busy} onClick={assignAllUnassigned}>
              Assign all
            </button>
          </div>
        </div>
      ) : null}

      <div className="card table-card">
        {loading ? (
          <p style={{ padding: 20 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>{search ? `No matches for “${search}”.` : 'Products added by stores will appear here.'}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Name</th>
                  <th>Store</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const sizeWarning = modelSizeWarning(compareModelSize(item.modelSize, item));
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.thumbnailUrl ? (
                          <img src={resolveAssetUrl(item.thumbnailUrl)} alt={item.displayName} className="product-preview" />
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
                      <td>
                        {item.storeId ? item.storeName : <span className="badge badge-unassigned">No store</span>}
                      </td>
                      <td>{item.category}</td>
                      <td>{formatPhp(item.pricePhp)}</td>
                      <td>{item.quantity}</td>
                      <td>
                        <div className="table-actions">
                          {item.takenDown ? (
                            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => restore(item)}>
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                setReason('');
                                setError('');
                                setTakeDown(item);
                              }}
                            >
                              Take down
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setAssignStoreId(item.storeId || '');
                              setAssigning(item);
                            }}
                          >
                            {item.storeId ? 'Change store' : 'Assign store'}
                          </button>
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

      <Modal
        open={Boolean(takeDown)}
        title="Take down product"
        subtitle={takeDown ? `${takeDown.displayName}${takeDown.storeName ? ` · ${takeDown.storeName}` : ''}` : undefined}
        onClose={() => {
          if (!busy) setTakeDown(null);
        }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setTakeDown(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmTakeDown} disabled={busy}>
              {busy ? 'Please wait…' : 'Take down'}
            </button>
          </>
        }
      >
        {error && takeDown ? <div className="alert alert-error">{error}</div> : null}
        <p className="confirm-message" style={{ marginBottom: 12 }}>
          The product disappears from the mobile app. The store keeps it and sees your reason.
        </p>
        <div className="field">
          <label htmlFor="takedown-reason">Reason (shown to the store)</label>
          <textarea
            id="takedown-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The 3D model doesn't match the photo"
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(assigning)}
        title={assigning?.storeId ? 'Change store' : 'Assign store'}
        subtitle={assigning?.displayName}
        onClose={() => {
          if (!busy) setAssigning(null);
        }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAssigning(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-dark"
              onClick={confirmAssign}
              disabled={busy || !assignStoreId || assignStoreId === assigning?.storeId}
            >
              {busy ? 'Please wait…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="assign-store">Store that sells this product</label>
          <select id="assign-store" value={assignStoreId} onChange={(e) => setAssignStoreId(e.target.value)}>
            <option value="">Choose a store…</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
                {store.status !== 'approved' ? ` (${store.status})` : ''}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
