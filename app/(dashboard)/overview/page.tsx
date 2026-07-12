'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api, Device, Transaction, Flow, CatalogTree } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge, timeAgo, MetricCard, Skeleton, EmptyState, Sparkline } from '@/lib/ui';
import { Icon } from '@/lib/icons';

// Reserved status colors (never reused as categorical series).
const OUTCOME = [
  { key: 'SUCCESS', label: 'Success', color: 'var(--good)' },
  { key: 'FAILED', label: 'Failed', color: 'var(--danger)' },
  { key: 'TIMEOUT', label: 'Timeout', color: 'var(--warn)' },
  { key: 'PENDING', label: 'In progress', color: 'var(--muted-2)' },
];

/** Bucket a set of timestamped rows into `n` equal time buckets → counts. */
function bucketByTime(items: { createdAt: string }[], n = 14): number[] {
  if (items.length === 0) return new Array(n).fill(0);
  const times = items.map((i) => new Date(i.createdAt).getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;
  const buckets = new Array(n).fill(0);
  for (const t of times) {
    const idx = Math.min(n - 1, Math.floor(((t - min) / span) * n));
    buckets[idx] += 1;
  }
  return buckets;
}

export default function OverviewPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [tree, setTree] = useState<CatalogTree>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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
    setUpdatedAt(new Date());
    setLoading(false);
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

  // Real time-series for the activity chart + card sparklines.
  const volumeSeries = useMemo(() => bucketByTime([...txs].reverse(), 16), [txs]);
  const activeFlows = flows.filter((f) => f.active).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="h-display">Overview</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Live health of your gateways, pipelines and catalog.
          </p>
        </div>
        <div className="text-xs" style={{ color: 'var(--muted-2)' }}>
          {updatedAt ? `Updated ${timeAgo(updatedAt.toISOString())}` : 'Loading…'}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Icon name="devices" size={20} />}
          tint="var(--accent)"
          label="Devices online"
          value={`${online}/${devices.length}`}
          sub="gateways connected"
          href="/devices"
          loading={loading}
        />
        <MetricCard
          icon={<Icon name="check" size={20} />}
          tint="var(--good)"
          label="Success rate"
          value={`${successRate}%`}
          sub={`last ${txs.length} runs`}
          spark={volumeSeries}
          loading={loading}
        />
        <MetricCard
          icon={<Icon name="pipeline" size={20} />}
          tint="var(--accent-2)"
          label="Active pipelines"
          value={activeFlows}
          sub={`${flows.length} total`}
          href="/flows"
          loading={loading}
        />
        <MetricCard
          icon={<Icon name="catalog" size={20} />}
          tint="var(--info)"
          label="Catalog bundles"
          value={bundles}
          sub={`${tree.length} companies · ${packages} packages`}
          href="/catalog"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity + outcomes */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="h-section">Transaction activity</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>last {txs.length} runs</div>
          </div>

          {loading ? (
            <Skeleton h={90} />
          ) : txs.length === 0 ? (
            <EmptyState icon={<Icon name="transactions" size={22} />} title="No transactions yet" description="Runs will appear here as your gateways execute flows." />
          ) : (
            <>
              <div className="mb-5">
                <Sparkline data={volumeSeries} color="var(--accent)" width={640} height={90} strokeWidth={2} />
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
                        <div className="text-sm font-semibold" style={{ color: 'var(--heading)' }}>{c}</div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{o.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 flex items-center gap-6 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Avg duration </span>
                  <span className="font-semibold" style={{ color: 'var(--heading)' }}>{avgDuration ? `${avgDuration}s` : '—'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Total runs </span>
                  <span className="font-semibold" style={{ color: 'var(--heading)' }}>{txs.length}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Device status list */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="h-section">Devices</div>
            <Link href="/devices" className="text-xs font-medium" style={{ color: 'var(--accent-hi)' }}>Manage →</Link>
          </div>
          <div className="flex flex-col gap-1">
            {loading &&
              [0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <Skeleton w={140} h={12} />
                  <Skeleton w={54} h={18} />
                </div>
              ))}
            {!loading &&
              devices.slice(0, 6).map((d) => (
                <div key={d.deviceId} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: 'var(--heading)' }}>{d.name || d.deviceId}</div>
                    <div className="text-xs mono" style={{ color: 'var(--muted)' }}>{d.deviceId}</div>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            {!loading && devices.length === 0 && (
              <EmptyState icon={<Icon name="devices" size={22} />} title="No devices" description="Register a gateway to see it here." />
            )}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="h-section">Recent transactions</div>
          <Link href="/transactions" className="text-xs font-medium" style={{ color: 'var(--accent-hi)' }}>View all →</Link>
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
              {loading &&
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    {[0, 1, 2, 3, 4, 5].map((j) => (
                      <td key={j}><Skeleton w={j === 0 ? 110 : 70} h={12} /></td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                txs.slice(0, 8).map((t) => (
                  <tr key={t.transactionId}>
                    <td className="mono">{t.transactionId}</td>
                    <td>{t.flowId}</td>
                    <td className="mono text-xs">{t.deviceId}</td>
                    <td>SIM {t.simSlot}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ color: 'var(--muted)' }}>{timeAgo(t.createdAt)}</td>
                  </tr>
                ))}
              {!loading && txs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 0 }}>
                  <EmptyState icon={<Icon name="transactions" size={22} />} title="No transactions yet" />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
