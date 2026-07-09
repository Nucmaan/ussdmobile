'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, Transaction } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge, timeAgo } from '@/lib/ui';

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    const { transactions } = await api.listTransactions({ limit: '200' });
    setTxs(transactions);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: refresh list on any tx event.
  useLiveFeed(
    useCallback(
      (e: LiveEvent) => {
        if (e.type === 'TX_UPDATE' || e.type === 'TX_RESULT') load();
      },
      [load],
    ),
  );

  async function open(id: string) {
    try {
      const { transaction } = await api.getTransaction(id);
      setSelected(transaction);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not load transaction');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <button className="btn" onClick={load}>↻ Refresh</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Flow</th>
              <th>Device</th>
              <th>SIM</th>
              <th>Status</th>
              <th>Duration</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.transactionId} style={{ cursor: 'pointer' }} onClick={() => open(t.transactionId)}>
                <td className="mono">{t.transactionId}</td>
                <td>{t.flowId}</td>
                <td className="mono text-xs">{t.deviceId}</td>
                <td>SIM {t.simSlot}</td>
                <td><StatusBadge status={t.status} /></td>
                <td>{t.durationMs ? `${(t.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{timeAgo(t.createdAt)}</td>
              </tr>
            ))}
            {txs.length === 0 && (
              <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <TxDrawer tx={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TxDrawer({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-md p-6 overflow-y-auto"
        style={{ background: 'var(--panel)', borderLeft: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="mono font-medium">{tx.transactionId}</div>
          <button className="btn px-2" onClick={onClose}>✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <Field label="Flow" value={tx.flowId} />
          <Field label="Device" value={tx.deviceId} mono />
          <Field label="SIM" value={`SIM ${tx.simSlot}`} />
          <Field label="Status" value={tx.status} />
          <Field label="Attempts" value={String(tx.attempts)} />
          <Field label="Duration" value={tx.durationMs ? `${(tx.durationMs / 1000).toFixed(1)}s` : '—'} />
        </div>

        {tx.message && (
          <div className="mb-4">
            <div className="label">Message</div>
            <div className="card p-3 text-sm">{tx.message}</div>
          </div>
        )}

        {tx.response && (
          <div className="mb-4">
            <div className="label">USSD response</div>
            <div className="card p-3 text-sm mono" style={{ whiteSpace: 'pre-wrap' }}>{tx.response}</div>
          </div>
        )}

        <div className="mb-4">
          <div className="label">Variables (sensitive redacted)</div>
          <div className="card p-3 text-xs mono">
            {Object.entries(tx.variablesSafe ?? {}).length === 0 ? (
              <span style={{ color: 'var(--muted)' }}>none</span>
            ) : (
              Object.entries(tx.variablesSafe ?? {}).map(([k, v]) => (
                <div key={k}>{k}: {String(v)}</div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="label">Execution log</div>
          <div className="grid gap-1">
            {(tx.logs ?? []).map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span style={{ color: 'var(--muted)' }}>{new Date(l.at).toLocaleTimeString()}</span>
                <StatusBadge status={l.status} />
                <span style={{ color: 'var(--muted)' }}>{l.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={mono ? 'mono text-xs' : ''}>{value}</div>
    </div>
  );
}
