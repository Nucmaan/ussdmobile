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
