'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, LedgerEntry } from '@/lib/api';
import { Pagination, timeAgo } from '@/lib/ui';

const PAGE_SIZE = 25;
const TYPES = ['', 'TOPUP', 'DEBIT', 'REFUND'];

const money = (n: number) => n.toFixed(2);

const TYPE_COLOR: Record<string, string> = {
  TOPUP: 'var(--good)',
  REFUND: 'var(--info)',
  DEBIT: 'var(--danger)',
};

export default function WalletHistoryPage() {
  const params = useParams();
  const companyId = params.companyId as string;

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (type) p.type = type;
      const res = await api.walletLedger(companyId, p);
      setEntries(res.entries);
      setTotal(res.total);
      setCompanyName(res.companyName);
    } finally {
      setLoading(false);
    }
  }, [companyId, page, type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [type]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/wallets" className="text-xs" style={{ color: 'var(--accent)' }}>← Wallets &amp; Orders</Link>
          <h1 className="text-xl font-semibold mt-1">{companyName || 'Wallet'} — history</h1>
        </div>
      </div>

      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[160px]">
          <label className="label">Type</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t || 'All types'}</option>)}
          </select>
        </div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{total} entries</div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>

      <div className="card p-2">
        <div className="overflow-x-auto" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Balance after</th>
                <th>Note</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id}>
                  <td>
                    <span style={{ color: TYPE_COLOR[e.type] ?? 'var(--muted)', fontWeight: 600, fontSize: '0.78rem' }}>
                      {e.type}
                    </span>
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: e.type === 'DEBIT' ? 'var(--danger)' : 'var(--good)' }}>
                    {e.type === 'DEBIT' ? '−' : '+'} {money(e.amount)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--muted)' }}>{money(e.balanceAfter)}</td>
                  <td style={{ color: 'var(--muted)', maxWidth: 360 }}>{e.note || '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{timeAgo(e.createdAt)}</td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No history entries.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}
