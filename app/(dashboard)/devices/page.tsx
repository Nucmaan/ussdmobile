'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, Device, Flow } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge, timeAgo } from '@/lib/ui';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [runFor, setRunFor] = useState<Device | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [d, f] = await Promise.all([api.listDevices(), api.listFlows()]);
    setDevices(d.devices);
    setFlows(f.flows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveFeed(
    useCallback(
      (e: LiveEvent) => {
        if (e.type === 'DEVICE_STATUS') load();
      },
      [load],
    ),
  );

  async function act(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">Devices</h1>
        <button className="btn" onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="badge badge-red mb-4">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Model</th>
              <th>Android</th>
              <th>SIM 1</th>
              <th>SIM 2</th>
              <th>Status</th>
              <th>Heartbeat</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const sim1 = d.sims.find((s) => s.slot === 1);
              const sim2 = d.sims.find((s) => s.slot === 2);
              return (
                <tr key={d.deviceId}>
                  <td>
                    <div>{d.name || '—'}</div>
                    <div className="mono text-xs" style={{ color: 'var(--muted)' }}>{d.deviceId}</div>
                  </td>
                  <td>{d.model || '—'}</td>
                  <td>{d.androidVersion || '—'}</td>
                  <td className="mono text-xs">{sim1 ? `${sim1.number || '—'} ${sim1.carrier}` : '—'}</td>
                  <td className="mono text-xs">{sim2 ? `${sim2.number || '—'} ${sim2.carrier}` : '—'}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td style={{ color: 'var(--muted)' }}>{timeAgo(d.lastHeartbeatAt)}</td>
                  <td>
                    <div className="flex gap-2 justify-end">
                      <button
                        className="btn btn-primary"
                        disabled={d.status !== 'online'}
                        onClick={() => setRunFor(d)}
                      >
                        Run USSD
                      </button>
                      <button className="btn" onClick={() => act(() => api.restartDevice(d.deviceId))}>
                        Restart
                      </button>
                      {d.disabled ? (
                        <button className="btn" onClick={() => act(() => api.enableDevice(d.deviceId))}>
                          Enable
                        </button>
                      ) : (
                        <button className="btn btn-danger" onClick={() => act(() => api.disableDevice(d.deviceId))}>
                          Disable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {devices.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: 'var(--muted)' }}>
                  No devices registered yet. Register the Android gateway to see it here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {runFor && (
        <RunModal device={runFor} flows={flows} onClose={() => setRunFor(null)} />
      )}
    </div>
  );
}

function RunModal({ device, flows, onClose }: { device: Device; flows: Flow[]; onClose: () => void }) {
  const [flowId, setFlowId] = useState(flows[0]?.flowId ?? '');
  const [simCard, setSimCard] = useState<1 | 2>(1);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const flow = flows.find((f) => f.flowId === flowId);

  async function run() {
    setError('');
    setResult('');
    setBusy(true);
    try {
      const res = await api.executeUssd({ deviceId: device.deviceId, flowId, simCard, variables: vars });
      setResult(`Queued ${res.transactionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="font-medium mb-1">Run USSD on {device.name || device.deviceId}</div>
        <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>{device.deviceId}</div>

        <label className="label">Flow</label>
        <select className="select mb-3" value={flowId} onChange={(e) => setFlowId(e.target.value)}>
          {flows.map((f) => (
            <option key={f.flowId} value={f.flowId}>{f.name} ({f.startingCode})</option>
          ))}
        </select>

        <label className="label">SIM card</label>
        <select className="select mb-3" value={simCard} onChange={(e) => setSimCard(Number(e.target.value) as 1 | 2)}>
          <option value={1}>SIM 1</option>
          <option value={2}>SIM 2</option>
        </select>

        {flow?.variables.map((v) => (
          <div key={v} className="mb-3">
            <label className="label">{v}</label>
            <input
              className="input"
              type={/pin|password|otp/i.test(v) ? 'password' : 'text'}
              value={vars[v] ?? ''}
              onChange={(e) => setVars((p) => ({ ...p, [v]: e.target.value }))}
            />
          </div>
        ))}

        {error && <div className="badge badge-red mb-3 w-full justify-center py-2">{error}</div>}
        {result && <div className="badge badge-green mb-3 w-full justify-center py-2">{result}</div>}

        <div className="flex gap-2 justify-end mt-2">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={run} disabled={busy || !flowId}>
            {busy ? 'Sending…' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}
