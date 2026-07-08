'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, Flow } from '@/lib/api';

export default function FlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { flows } = await api.listFlows();
    setFlows(flows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">USSD Flows</h1>
        <Link href="/flows/new" className="btn btn-primary">+ New flow</Link>
      </div>

      {error && <div className="badge badge-red mb-4">{error}</div>}

      <div className="grid gap-3">
        {flows.map((f) => (
          <div key={f.flowId} className="card p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{f.name}</span>
                <span className={`badge ${f.active ? 'badge-green' : 'badge-gray'}`}>
                  {f.active ? 'active' : 'inactive'}
                </span>
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
        {flows.length === 0 && (
          <div className="card p-8 text-center" style={{ color: 'var(--muted)' }}>
            No flows yet. Create your first USSD flow.
          </div>
        )}
      </div>
    </div>
  );
}
