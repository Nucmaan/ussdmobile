'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, Device, Transaction, Flow } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge } from '@/lib/ui';

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

export default function OverviewPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    const [d, f, t] = await Promise.all([
      api.listDevices(),
      api.listFlows(),
      api.listTransactions({ limit: '10' }),
    ]);
    setDevices(d.devices);
    setFlows(f.flows);
    setTxs(t.transactions);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveFeed(
    useCallback(
      (e: LiveEvent) => {
        if (e.type === 'DEVICE_STATUS' || e.type === 'TX_RESULT') load();
      },
      [load],
    ),
  );

  const online = devices.filter((d) => d.status === 'online').length;
  const succeeded = txs.filter((t) => t.status === 'SUCCESS').length;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-5">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Devices online" value={`${online}/${devices.length}`} />
        <Stat label="Active flows" value={flows.filter((f) => f.active).length} sub={`${flows.length} total`} />
        <Stat label="Recent success" value={`${succeeded}/${txs.length}`} sub="last 10 tx" />
        <Stat
          label="Avg duration"
          value={
            txs.length
              ? `${Math.round(txs.reduce((a, t) => a + (t.durationMs || 0), 0) / txs.length / 100) / 10}s`
              : '—'
          }
        />
      </div>

      <div className="card p-5">
        <div className="font-medium mb-3">Latest transactions</div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Flow</th>
                <th>Device</th>
                <th>SIM</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.transactionId}>
                  <td className="mono">{t.transactionId}</td>
                  <td>{t.flowId}</td>
                  <td className="mono">{t.deviceId}</td>
                  <td>SIM {t.simSlot}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--muted)' }}>
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
