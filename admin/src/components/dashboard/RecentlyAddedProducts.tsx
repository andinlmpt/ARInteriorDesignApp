import type { FurnitureItem } from '../../api/client';
import type { AsyncSection } from '../../types/dashboard';
import { resolveAssetUrl } from '../../utils/assetUrl';
import { formatCategoryLabel, formatRelativeTime } from '../../utils/dashboard';
import { DashboardPanel } from './DashboardPanel';

interface RecentlyAddedProductsProps {
  section: AsyncSection<FurnitureItem[]>;
  onRetry: () => void;
}

function ProductSkeletons() {
  return (
    <div className="recent-products">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="recent-product">
          <span className="skeleton recent-product-image" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line skeleton-line-short" />
        </div>
      ))}
    </div>
  );
}

export function RecentlyAddedProducts({ section, onRetry }: RecentlyAddedProductsProps) {
  const items = section.data ?? [];

  return (
    <DashboardPanel
      title="Recently Added Products"
      loading={section.loading}
      error={section.error}
      isEmpty={items.length === 0}
      emptyMessage="No products have been added yet."
      onRetry={onRetry}
      skeleton={<ProductSkeletons />}
      footerLink={{ to: '/products', label: 'View all products' }}
    >
      <ul className="recent-products">
        {items.map((item) => (
          <li key={item.id} className="recent-product">
            {item.thumbnailUrl ? (
              <img
                src={resolveAssetUrl(item.thumbnailUrl)}
                alt={item.displayName}
                className="recent-product-image"
                loading="lazy"
              />
            ) : (
              <div className="recent-product-image product-preview-empty" aria-hidden="true">
                No img
              </div>
            )}
            <strong title={item.displayName}>{item.displayName}</strong>
            <span>
              {formatCategoryLabel(item.category)}
              {item.createdAt ? ` · ${formatRelativeTime(item.createdAt)}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}
