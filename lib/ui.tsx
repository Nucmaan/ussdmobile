import React from 'react';

const STATUS_BADGE: Record<string, string> = {
  online: 'badge-green',
  offline: 'badge-gray',
  disabled: 'badge-red',
  SUCCESS: 'badge-green',
  FAILED: 'badge-red',
  TIMEOUT: 'badge-red',
  CANCELLED: 'badge-gray',
  QUEUED: 'badge-gray',
  DISPATCHED: 'badge-blue',
  RECEIVED: 'badge-blue',
  DIALING_USSD: 'badge-amber',
  ENTERING_INPUT: 'badge-amber',
  READING_RESPONSE: 'badge-amber',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'badge-gray';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Compact pagination control. `total` may be a count (server) or list length. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between mt-3">
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn px-2 py-1 text-xs" disabled={page <= 1} onClick={() => onPage(1)}>« First</button>
        <button className="btn px-2 py-1 text-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Page {page} / {pages}</span>
        <button className="btn px-2 py-1 text-xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
        <button className="btn px-2 py-1 text-xs" disabled={page >= pages} onClick={() => onPage(pages)}>Last »</button>
      </div>
    </div>
  );
}

/** Debounce a changing value (e.g. a search box) to avoid refetch-per-keystroke. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Shimmering placeholder block. Pass width/height or a className. */
export function Skeleton({
  w,
  h = 14,
  className,
  style,
}: {
  w?: number | string;
  h?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`skeleton ${className ?? ''}`}
      style={{ display: 'block', width: w ?? '100%', height: h, ...style }}
    />
  );
}

/**
 * Inline SVG sparkline. Renders a smooth area+line from a numeric series.
 * Purely presentational — no axes, no deps.
 */
export function Sparkline({
  data,
  color = 'var(--accent)',
  width = 120,
  height = 36,
  strokeWidth = 1.75,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth;
  const stepX = (width - pad * 2) / (data.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const pts = data.map((v, i) => [pad + i * stepX, y(v)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const gid = `sg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Premium metric card: icon tint, large tabular value, optional trend delta,
 * sparkline, hover lift, and an optional click target. Shows a skeleton while
 * `loading`.
 */
export function MetricCard({
  icon,
  tint = 'var(--accent)',
  label,
  value,
  sub,
  delta,
  spark,
  href,
  loading,
}: {
  icon: React.ReactNode;
  tint?: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: { value: string; up: boolean } | null;
  spark?: number[];
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <div className={`card stat ${href ? 'card-interactive' : ''}`} style={{ height: '100%' }}>
      <div className="flex items-start justify-between">
        <div className="stat-icon" style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)`, color: tint }}>
          {icon}
        </div>
        {delta && !loading && (
          <span className={`text-xs font-semibold ${delta.up ? 'trend-up' : 'trend-down'}`}>
            {delta.up ? '▲' : '▼'} {delta.value}
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton w={90} h={26} style={{ marginTop: 4 }} />
      ) : (
        <div className="stat-value">{value}</div>
      )}
      <div className="stat-label mt-1">{label}</div>
      <div className="flex items-end justify-between mt-1 gap-2">
        {sub ? <div className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</div> : <span />}
        {spark && spark.length > 1 && !loading && <Sparkline data={spark} color={tint} width={84} height={28} />}
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} style={{ display: 'block', height: '100%' }}>
        {body}
      </a>
    );
  }
  return body;
}

/** Empty-state block: icon, title, description, optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && (
        <div
          className="mb-3 grid place-items-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'var(--panel-2)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          {icon}
        </div>
      )}
      <div className="font-medium" style={{ color: 'var(--heading)' }}>{title}</div>
      {description && (
        <div className="text-sm mt-1 max-w-sm" style={{ color: 'var(--muted)' }}>{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
