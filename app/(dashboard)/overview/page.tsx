'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, Device, Transaction, Flow, CatalogTree } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge, timeAgo } from '@/lib/ui';

// Reserved status colors (never reused as categorical series).
const OUTCOME = [
  { key: 'SUCCESS', label: 'Success', color: 'var(--good)' },
  { key: 'FAILED', label: 'Failed', color: 'var(--danger)' },
  { key: 'TIMEOUT', label: 'Timeout', color: 'var(--warn)' },
  { key: 'PENDING', label: 'In progress', color: 'var(--muted-2)' },
];

function StatTile({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="card stat">
      <div className="stat-icon" style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label mt-1">{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

export default function OverviewPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [tree, setTree] = useState<CatalogTree>([]);

  const load = useCallback(async () => {
    const [d, f, t, c] = await Promise.all([
      api.listDevices(),
      api.listFlows(),
      api.listTransactions({ limit: '100' }),
      api.getCatalogTree(),
    ]);
    setDevices(d.devices);
    setFlows(f.flows);
    setTxs(t.transactions);
    setTree(c.tree);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveFeed(
    useCallback(
      (e: LiveEvent) => {
        if (e.type === 'DEVICE_STATUS' || e.type === 'TX_RESULT' || e.type === 'TX_UPDATE') load();
      },
      [load],
    ),
  );

  const online = devices.filter((d) => d.status === 'online').length;

  // Outcome distribution over the recent window.
  const counts = { SUCCESS: 0, FAILED: 0, TIMEOUT: 0, PENDING: 0 };
  for (const t of txs) {
    if (t.status === 'SUCCESS') counts.SUCCESS++;
    else if (t.status === 'FAILED') counts.FAILED++;
    else if (t.status === 'TIMEOUT') counts.TIMEOUT++;
    else counts.PENDING++;
  }
  const total = txs.length || 1;
  const successRate = Math.round((counts.SUCCESS / total) * 100);

  const packages = tree.reduce((a, c) => a + c.packages.length, 0);
  const bundles = tree.reduce((a, c) => a + c.packages.reduce((x, p) => x + p.bundles.length, 0), 0);
  const avgDuration = txs.length
    ? Math.round(txs.reduce((a, t) => a + (t.durationMs || 0), 0) / txs.length / 100) / 10
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon="▤" tint="var(--accent)" label="Devices online" value={`${online}/${devices.length}`} sub="gateways connected" />
        <StatTile icon="✓" tint="var(--good)" label="Success rate" value={`${successRate}%`} sub={`last ${txs.length} transactions`} />
        <StatTile icon="⑃" tint="var(--accent-2)" label="Active flows" value={flows.filter((f) => f.active).length} sub={`${flows.length} total`} />
        <StatTile icon="❏" tint="var(--info)" label="Catalog bundles" value={bundles} sub={`${tree.length} companies · ${packages} packages`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Outcome meter */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="font-medium">Transaction outcomes</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>last {txs.length} runs</div>
          </div>

          <div className="meter mb-4">
            {OUTCOME.map((o) => {
              const c = counts[o.key as keyof typeof counts];
              const pct = (c / total) * 100;
              if (pct === 0) return null;
              return <div key={o.key} className="meter-seg" style={{ width: `${pct}%`, background: o.color }} title={`${o.label}: ${c}`} />;
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {OUTCOME.map((o) => {
              const c = counts[o.key as keyof typeof counts];
              return (
                <div key={o.key} className="flex items-center gap-2">
                  <span className="dot" style={{ background: o.color }} />
                  <div>
                    <div className="text-sm font-semibold">{c}</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>{o.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 flex items-center gap-6 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <span style={{ color: 'var(--muted)' }}>Avg duration </span>
              <span className="font-semibold">{avgDuration ? `${avgDuration}s` : '—'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)' }}>Total runs </span>
              <span className="font-semibold">{txs.length}</span>
            </div>
          </div>
        </div>

        {/* Device status list */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">Devices</div>
            <Link href="/devices" className="text-xs" style={{ color: 'var(--accent)' }}>Manage →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {devices.slice(0, 5).map((d) => (
              <div key={d.deviceId} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm truncate">{d.name || d.deviceId}</div>
                  <div className="text-xs mono" style={{ color: 'var(--muted)' }}>{d.deviceId}</div>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))}
            {devices.length === 0 && <div className="text-xs" style={{ color: 'var(--muted)' }}>No devices yet.</div>}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Recent transactions</div>
          <Link href="/transactions" className="text-xs" style={{ color: 'var(--accent)' }}>View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Flow</th>
                <th>Device</th>
                <th>SIM</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {txs.slice(0, 8).map((t) => (
                <tr key={t.transactionId}>
                  <td className="mono">{t.transactionId}</td>
                  <td>{t.flowId}</td>
                  <td className="mono text-xs">{t.deviceId}</td>
                  <td>SIM {t.simSlot}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td style={{ color: 'var(--muted)' }}>{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No transactions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
