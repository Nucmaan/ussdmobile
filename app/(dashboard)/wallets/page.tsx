'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, WalletRow, Order, LedgerEntry } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge, timeAgo, Pagination, useDebounced } from '@/lib/ui';

const PAGE_SIZE = 25;
const ORDER_STATUSES = ['', 'DISPATCHED', 'SUCCESS', 'REFUNDED', 'INSUFFICIENT_FUNDS', 'NO_GATEWAY', 'UNAVAILABLE'];

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [topupFor, setTopupFor] = useState<WalletRow | null>(null);
  const [ledgerFor, setLedgerFor] = useState<WalletRow | null>(null);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const debouncedPhone = useDebounced(phone, 350);

  const loadWallets = useCallback(async () => {
    const { wallets } = await api.listWallets();
    setWallets(wallets);
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (status) params.status = status;
      if (debouncedPhone) params.phone = debouncedPhone;
      const res = await api.listOrders(params);
      setOrders(res.orders);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, status, debouncedPhone]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);
  useEffect(() => {
    setPage(1);
  }, [status, debouncedPhone]);

  useLiveFeed(
    useCallback(
      (e: LiveEvent) => {
        if (e.type === 'ORDER_NEW' || e.type === 'ORDER_UPDATE') {
          loadOrders();
          loadWallets();
        }
      },
      [loadOrders, loadWallets],
    ),
  );

  const totalFloat = wallets.reduce((a, w) => a + w.balance, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Wallet balances */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Float balances (per company)</div>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Total: <span className="font-semibold" style={{ color: 'var(--foreground)' }}>${totalFloat.toFixed(2)}</span></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {wallets.map((w) => (
            <div key={w.companyId} className="card p-4">
              <div className="text-sm" style={{ color: 'var(--muted)' }}>{w.companyName}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: w.balance > 0 ? 'var(--good)' : 'var(--danger)' }}>
                {w.currency} {w.balance.toFixed(2)}
              </div>
              <div className="flex gap-2 mt-3">
                <button className="btn btn-primary px-2 py-1 text-xs flex-1" onClick={() => setTopupFor(w)}>+ Top up</button>
                <button className="btn px-2 py-1 text-xs" onClick={() => setLedgerFor(w)}>History</button>
              </div>
            </div>
          ))}
          {wallets.length === 0 && (
            <div className="card p-6 text-center col-span-full" style={{ color: 'var(--muted)' }}>
              No companies yet. Create companies in the Catalog to get wallets.
            </div>
          )}
        </div>
      </div>

      {/* Orders */}
      <div>
        <div className="card p-3 mb-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="label">Search recipient number</label>
            <input className="input" placeholder="61…" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="min-w-[160px]">
            <label className="label">Status</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={loadOrders} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
        </div>

        <div className="card p-2">
          <div className="overflow-x-auto" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Recipient</th>
                  <th>Company</th>
                  <th>Bundle</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="mono text-xs">{o.orderId}</td>
                    <td className="mono">{o.recipientPhone}</td>
                    <td>{o.companyName}</td>
                    <td>{o.bundleName}</td>
                    <td>{o.price ? `${o.currency} ${o.price}` : '—'}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ color: 'var(--muted)' }}>{timeAgo(o.createdAt)}</td>
                  </tr>
                ))}
                {orders.length === 0 && !loading && (
                  <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No orders yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-2">
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
          </div>
        </div>
      </div>

      {topupFor && (
        <TopupModal
          wallet={topupFor}
          onClose={() => setTopupFor(null)}
          onDone={async () => {
            setTopupFor(null);
            await loadWallets();
          }}
        />
      )}
      {ledgerFor && <LedgerModal wallet={ledgerFor} onClose={() => setLedgerFor(null)} />}
    </div>
  );
}

function TopupModal({ wallet, onClose, onDone }: { wallet: WalletRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Enter a positive amount');
    setError('');
    setBusy(true);
    try {
      await api.topupWallet(wallet.companyId, amt, note || undefined);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top up failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Top up ${wallet.companyName}`} onClose={onClose}>
      <div className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
        Current balance: <span style={{ color: 'var(--foreground)' }}>{wallet.currency} {wallet.balance.toFixed(2)}</span>
      </div>
      <label className="label">Amount to add</label>
      <input className="input mb-3" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50" autoFocus />
      <label className="label">Note (optional)</label>
      <input className="input mb-4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. loaded Somtel SIM" />
      {error && <div className="badge badge-red mb-3 w-full justify-center py-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Adding…' : 'Add funds'}</button>
      </div>
    </Modal>
  );
}

function LedgerModal({ wallet, onClose }: { wallet: WalletRow; onClose: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  useEffect(() => {
    api.walletLedger(wallet.companyId).then((r) => setEntries(r.entries)).catch(() => {});
  }, [wallet.companyId]);

  const color = (t: string) => (t === 'TOPUP' ? 'var(--good)' : t === 'REFUND' ? 'var(--info)' : 'var(--danger)');
  const sign = (t: string) => (t === 'DEBIT' ? '−' : '+');

  return (
    <Modal title={`${wallet.companyName} — history`} onClose={onClose}>
      <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
        {entries.map((e) => (
          <div key={e._id} className="flex items-center justify-between py-2 text-sm" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ color: color(e.type) }}>{e.type}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{timeAgo(e.createdAt)} {e.note && `· ${e.note}`}</div>
            </div>
            <div className="text-right">
              <div style={{ color: color(e.type) }}>{sign(e.type)} {e.amount}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>bal {e.balanceAfter}</div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>No history yet.</div>}
      </div>
      <div className="flex justify-end mt-4">
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="font-medium mb-4">{title}</div>
        {children}
      </div>
    </div>
  );
}
