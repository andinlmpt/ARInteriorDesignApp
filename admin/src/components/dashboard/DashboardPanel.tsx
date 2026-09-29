import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface DashboardPanelProps {
  title: string;
  subtitle?: string;
  loading: boolean;
  error: string;
  isEmpty: boolean;
  emptyMessage: string;
  onRetry: () => void;
  skeleton: ReactNode;
  footerLink?: { to: string; label: string };
  className?: string;
  children: ReactNode;
}

export function DashboardPanel({
  title,
  subtitle,
  loading,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  skeleton,
  footerLink,
  className = '',
  children,
}: DashboardPanelProps) {
  const headingId = `dashboard-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  let body: ReactNode;
  if (loading) {
    body = (
      <div aria-busy="true" aria-label={`Loading ${title.toLowerCase()}`}>
        {skeleton}
      </div>
    );
  } else if (error) {
    body = (
      <div className="dashboard-panel-state" role="alert">
        <p>{error}</p>
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  } else if (isEmpty) {
    body = (
      <div className="dashboard-panel-state">
        <p>{emptyMessage}</p>
      </div>
    );
  } else {
    body = children;
  }

  return (
    <section className={`card dashboard-panel ${className}`.trim()} aria-labelledby={headingId}>
      <header className="dashboard-panel-header">
        <h2 id={headingId} className="section-title">
          {title}
        </h2>
        {subtitle && !loading && !error ? <span className="dashboard-panel-subtitle">{subtitle}</span> : null}
      </header>

      <div className="dashboard-panel-body">{body}</div>

      {footerLink ? (
        <footer className="dashboard-panel-footer">
          <Link to={footerLink.to} className="dashboard-panel-link">
            {footerLink.label}
          </Link>
        </footer>
      ) : null}
    </section>
  );
}

export function SkeletonRows({ count, className = '' }: { count: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`dashboard-skeleton-row ${className}`.trim()}>
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line skeleton-line-short" />
        </div>
      ))}
    </>
  );
}
