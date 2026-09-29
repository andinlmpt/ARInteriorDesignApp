import type { AsyncSection, CategoryCount } from '../../types/dashboard';
import { DashboardPanel, SkeletonRows } from './DashboardPanel';

interface ProductOverviewProps {
  section: AsyncSection<{ items: CategoryCount[]; total: number }>;
  onRetry: () => void;
}

export function ProductOverview({ section, onRetry }: ProductOverviewProps) {
  const items = section.data?.items ?? [];
  const total = section.data?.total ?? 0;
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <DashboardPanel
      title="Product Overview"
      subtitle={`${total} active product${total === 1 ? '' : 's'}`}
      loading={section.loading}
      error={section.error}
      isEmpty={items.length === 0}
      emptyMessage="No products available"
      onRetry={onRetry}
      skeleton={<SkeletonRows count={5} />}
      footerLink={{ to: '/products', label: 'Manage products' }}
    >
      <ul className="category-list">
        {items.map((item) => {
          const percent = Math.round(item.share * 100);
          return (
            <li key={item.category} className="category-row">
              <div className="category-row-top">
                <span className="category-name">{item.label}</span>
                <span className="category-count">
                  {item.count}
                  <span className="category-share"> · {percent}%</span>
                </span>
              </div>
              <div
                className="category-bar"
                role="progressbar"
                aria-label={`${item.label}: ${item.count} of ${total} products`}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={item.count}
              >
                <span style={{ width: `${(item.count / max) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
