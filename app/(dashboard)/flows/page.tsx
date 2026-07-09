'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { api, Flow } from '@/lib/api';
import { Pagination, useDebounced } from '@/lib/ui';

const PAGE_SIZE = 8;

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [active, setActive] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { flows } = await api.listFlows();
      setFlows(flows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return flows.filter((f) => {
      if (active === 'active' && !f.active) return false;
      if (active === 'inactive' && f.active) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.flowId.toLowerCase().includes(q) ||
        f.startingCode.toLowerCase().includes(q)
      );
    });
  }, [flows, debouncedSearch, active]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, active]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function remove(flowId: string) {
    if (!confirm(`Delete flow "${flowId}"? This cannot be undone.`)) return;
    setError('');
    try {
      await api.deleteFlow(flowId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm" style={{ color: 'var(--muted)' }}>{filtered.length} flows</div>
        <Link href="/flows/new" className="btn btn-primary">+ New flow</Link>
      </div>

      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input className="input" placeholder="Name, flow ID, or USSD code" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-w-[150px]">
          <label className="label">Status</label>
          <select className="select" value={active} onChange={(e) => setActive(e.target.value as typeof active)}>
            <option value="">All</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>

      {error && <div className="badge badge-red mb-4">{error}</div>}

      <div className="grid gap-3">
        {paged.map((f) => (
          <div key={f.flowId} className="card p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{f.name}</span>
                <span className={`badge ${f.active ? 'badge-green' : 'badge-gray'}`}>
                  {f.active ? 'active' : 'inactive'}
                </span>
                {f.bundle && <span className="badge badge-blue">linked to bundle</span>}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                <span className="mono">{f.flowId}</span> · dials{' '}
                <span className="mono">{f.startingCode}</span> · {f.steps.length} steps · SIM {f.defaultSimSlot}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/flows/${f.flowId}`} className="btn">Edit</Link>
              <button className="btn btn-danger" onClick={() => remove(f.flowId)}>Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card p-8 text-center" style={{ color: 'var(--muted)' }}>
            {flows.length === 0 ? 'No flows yet. Create your first USSD flow.' : 'No flows match your filters.'}
          </div>
        )}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
    </div>
  );
}
