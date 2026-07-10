'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, Transaction, Device, Flow } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge, timeAgo, Pagination, useDebounced } from '@/lib/ui';

const STATUS_OPTIONS = ['', 'SUCCESS', 'FAILED', 'TIMEOUT', 'QUEUED', 'DISPATCHED', 'RECEIVED', 'DIALING_USSD', 'ENTERING_INPUT'];
const PAGE_SIZE = 25;

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [status, setStatus] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [flowId, setFlowId] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);

  const [devices, setDevices] = useState<Device[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);

  // Load filter option lists once.
  useEffect(() => {
    api.listDevices().then((d) => setDevices(d.devices)).catch(() => {});
    api.listFlows().then((f) => setFlows(f.flows)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (status) params.status = status;
      if (deviceId) params.deviceId = deviceId;
      if (flowId) params.flowId = flowId;
      if (debouncedSearch) params.q = debouncedSearch;
      const res = await api.listTransactions(params);
      setTxs(res.transactions);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, status, deviceId, flowId, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [status, deviceId, flowId, debouncedSearch]);

  // Debounced live refresh so a burst of events triggers at most one reload.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveFeed(
    useCallback(
      (e: LiveEvent) => {
        if (e.type !== 'TX_UPDATE' && e.type !== 'TX_RESULT') return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => load(), 800);
      },
      [load],
    ),
  );

  async function openTx(id: string) {
    try {
      const { transaction } = await api.getTransaction(id);
      setSelected(transaction);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not load transaction');
    }
  }

  function resetFilters() {
    setStatus('');
    setDeviceId('');
    setFlowId('');
    setSearch('');
  }

  const hasFilters = status || deviceId || flowId || search;

  return (
    <div>
      {/* Filter bar */}
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="label">Search transaction ID</label>
          <input className="input" placeholder="TXN_…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-w-[150px]">
          <label className="label">Status</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="label">Device</label>
          <select className="select" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">All devices</option>
            {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.name || d.deviceId}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="label">Flow</label>
          <select className="select" value={flowId} onChange={(e) => setFlowId(e.target.value)}>
            <option value="">All flows</option>
            {flows.map((f) => <option key={f.flowId} value={f.flowId}>{f.name}</option>)}
          </select>
        </div>
        {hasFilters && <button className="btn" onClick={resetFilters}>Clear</button>}
        <button className="btn btn-primary" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <div className="card p-2">
        <div className="overflow-x-auto" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
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
                <tr key={t.transactionId} style={{ cursor: 'pointer' }} onClick={() => openTx(t.transactionId)}>
                  <td className="mono">{t.transactionId}</td>
                  <td>{t.flowId}</td>
                  <td className="mono text-xs">{t.deviceId}</td>
                  <td>SIM {t.simSlot}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{t.durationMs ? `${(t.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{timeAgo(t.createdAt)}</td>
                </tr>
              ))}
              {txs.length === 0 && !loading && (
                <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No transactions match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      </div>

      {selected && <TxDrawer tx={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TxDrawer({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const canRetry = ['FAILED', 'TIMEOUT', 'CANCELLED'].includes(tx.status);

  async function retry() {
    if (!confirm('Retry this transaction? Only do this after confirming the customer did not receive it.')) return;
    setRetrying(true);
    try {
      const r = await api.retryTransaction(tx.transactionId);
      alert(r.kind === 'order' ? `Re-ordered (${r.orderId ?? ''}) — ${r.status}` : `Retry queued (${r.transactionId ?? ''})`);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="fixed inset-0 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="h-full w-full max-w-md p-6 overflow-y-auto"
        style={{ background: 'var(--panel)', borderLeft: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="mono font-medium">{tx.transactionId}</div>
          <div className="flex gap-2">
            {canRetry && (
              <button className="btn btn-primary px-3" onClick={retry} disabled={retrying}>
                {retrying ? 'Retrying…' : '↻ Retry'}
              </button>
            )}
            <button className="btn px-2" onClick={onClose}>✕</button>
          </div>
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
