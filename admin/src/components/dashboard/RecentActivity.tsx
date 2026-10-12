import type { ComponentType } from 'react';
import type { ActivityEntry } from '../../api/client';
import type { AsyncSection } from '../../types/dashboard';
import { formatRelativeTime } from '../../utils/dashboard';
import { IconFaqs, IconProducts, IconStores, IconUsers } from '../NavIcons';
import { DashboardPanel, SkeletonRows } from './DashboardPanel';

const ICONS: Record<ActivityEntry['targetType'], ComponentType<{ className?: string }>> = {
  store: IconStores,
  product: IconProducts,
  user: IconUsers,
  content: IconFaqs,
};

interface RecentActivityProps {
  section: AsyncSection<ActivityEntry[]>;
  onRetry: () => void;
}

export function RecentActivity({ section, onRetry }: RecentActivityProps) {
  const entries = section.data ?? [];

  return (
    <DashboardPanel
      title="Recent Activity"
      loading={section.loading}
      error={section.error}
      isEmpty={entries.length === 0}
      emptyMessage="No recent activity"
      onRetry={onRetry}
      skeleton={<SkeletonRows count={5} className="dashboard-skeleton-row-icon" />}
      footerLink={{ to: '/activity-logs', label: 'View all activity' }}
    >
      <ul className="activity-list">
        {entries.map((entry) => {
          const Icon = ICONS[entry.targetType] ?? IconProducts;
          return (
            <li key={entry.id} className="activity-row">
              <span className="quick-link-icon activity-icon" aria-hidden="true">
                <Icon className="nav-icon" />
              </span>
              <div className="activity-copy">
                <p>{entry.summary}</p>
                <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()}>
                  {formatRelativeTime(entry.createdAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
