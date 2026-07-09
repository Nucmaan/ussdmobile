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
