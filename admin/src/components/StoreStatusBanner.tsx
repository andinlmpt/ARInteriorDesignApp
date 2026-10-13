import { Link } from 'react-router-dom';
import type { Store } from '../api/client';

/** Explains what a store can do while it isn't approved. Renders nothing for approved stores. */
export function StoreStatusBanner({ store }: { store: Store }) {
  if (store.status === 'approved') return null;

  if (store.status === 'pending') {
    return (
      <div className="status-banner status-banner-pending" role="status">
        <strong>Waiting for admin approval.</strong> An admin is reviewing your store registration. You can
        complete your <Link to="/profile">store profile</Link> now; you can add products once your store is
        accepted.
      </div>
    );
  }

  if (store.status === 'rejected') {
    return (
      <div className="status-banner status-banner-danger" role="alert">
        <strong>Registration not accepted.</strong> {store.statusNote ? `Reason: ${store.statusNote}. ` : ''}
        Update your <Link to="/profile">store profile</Link> and resubmit it for review.
      </div>
    );
  }

  return (
    <div className="status-banner status-banner-danger" role="alert">
      <strong>Store suspended.</strong> {store.statusNote ? `Reason: ${store.statusNote}. ` : ''}
      Your products are hidden from the mobile app. Contact the platform admin for help.
    </div>
  );
}
