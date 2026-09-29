import type { ComponentType } from 'react';
import type { ActivityEntry, ActivityKind, AsyncSection } from '../../types/dashboard';
import { formatRelativeTime } from '../../utils/dashboard';
import { IconAdmins, IconProducts, IconUsers } from '../NavIcons';
import { DashboardPanel, SkeletonRows } from './DashboardPanel';

const ICONS: Record<ActivityKind, ComponentType<{ className?: string }>> = {
  'product-added': IconProducts,
  'product-updated': IconProducts,
  'product-deactivated': IconProducts,
  'user-registered': IconUsers,
  'admin-created': IconAdmins,
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
          const Icon = ICONS[entry.kind];
          return (
            <li key={entry.id} className="activity-row">
              <span className="quick-link-icon activity-icon" aria-hidden="true">
                <Icon className="nav-icon" />
              </span>
              <div className="activity-copy">
                <p>{entry.description}</p>
                <time dateTime={entry.timestamp} title={new Date(entry.timestamp).toLocaleString()}>
                  {formatRelativeTime(entry.timestamp)}
                </time>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
