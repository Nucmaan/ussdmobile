'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api, Device, Flow } from '@/lib/api';
import { useLiveFeed, LiveEvent } from '@/lib/useLiveFeed';
import { StatusBadge, timeAgo, Pagination, useDebounced } from '@/lib/ui';

const PAGE_SIZE = 10;

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [runFor, setRunFor] = useState<Device | null>(null);
  const [pinFor, setPinFor] = useState<Device | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'online' | 'offline' | 'disabled'>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([api.listDevices(), api.listFlows()]);
      setDevices(d.devices);
      setFlows(f.flows);
    } finally {
      setLoading(false);
    }
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

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return devices.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (d.name ?? '').toLowerCase().includes(q) ||
        d.deviceId.toLowerCase().includes(q) ||
        (d.model ?? '').toLowerCase().includes(q) ||
        d.sims.some((s) => (s.number ?? '').includes(q))
      );
    });
  }, [devices, debouncedSearch, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input className="input" placeholder="Name, device ID, model, or SIM number" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="min-w-[150px]">
          <label className="label">Status</label>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{filtered.length} devices</div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>

      {error && <div className="badge badge-red mb-4">{error}</div>}

      <div className="card overflow-x-auto" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
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
            {paged.map((d) => {
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
                  <td className="mono text-xs">{sim1 ? `${sim1.number || '—'} ${sim1.carrier}${sim1.pinSet ? ' 🔒' : ''}` : '—'}</td>
                  <td className="mono text-xs">{sim2 ? `${sim2.number || '—'} ${sim2.carrier}${sim2.pinSet ? ' 🔒' : ''}` : '—'}</td>
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
                      <button className="btn" onClick={() => setPinFor(d)}>
                        SIM PINs
                      </button>
                      <button className="btn" onClick={() => act(() => api.restartDevice(d.deviceId))}>
                        Restart
                      </button>
                      {d.disabled ? (
                        <button className="btn" onClick={() => act(() => api.enableDevice(d.deviceId))}>
                          Enable
                        </button>
                      ) : (
                        <button className="btn" onClick={() => act(() => api.disableDevice(d.deviceId))}>
                          Disable
                        </button>
                      )}
                      <button
                        className="btn btn-danger"
                        onClick={() => {
                          if (confirm(`Delete device "${d.name || d.deviceId}"? This removes it from the panel. If the phone is still running it will be disconnected; it can re-register later.`)) {
                            act(() => api.deleteDevice(d.deviceId));
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: 'var(--muted)' }}>
                  {devices.length === 0
                    ? 'No devices registered yet. Register the Android gateway to see it here.'
                    : 'No devices match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />

      {runFor && (
        <RunModal device={runFor} flows={flows} onClose={() => setRunFor(null)} />
      )}
      {pinFor && (
        <SimPinModal
          device={pinFor}
          onClose={() => setPinFor(null)}
          onSaved={async () => {
            await load();
          }}
        />
      )}
    </div>
  );
}

/**
 * Save / clear the mobile-money PIN per SIM slot. Write-only: the API never
 * returns a saved PIN, only whether one is set.
 */
function SimPinModal({
  device,
  onClose,
  onSaved,
}: {
  device: Device;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [sims, setSims] = useState(device.sims);
  const [pins, setPins] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const slots: (1 | 2)[] = [1, 2];

  async function save(slot: 1 | 2, pin: string) {
    setError('');
    setOk('');
    setBusy(true);
    try {
      const res = await api.setSimPin(device.deviceId, slot, pin);
      setSims(res.device.sims);
      setPins((p) => ({ ...p, [slot]: '' }));
      setOk(pin ? `SIM ${slot} PIN saved` : `SIM ${slot} PIN cleared`);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PIN');
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
        <div className="font-medium mb-1">SIM PINs — {device.name || device.deviceId}</div>
        <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          The PIN is stored encrypted and used automatically as {'{pin}'} when this SIM runs a flow.
          It is never shown again after saving.
        </div>

        {slots.map((slot) => {
          const sim = sims.find((s) => s.slot === slot);
          return (
            <div key={slot} className="mb-4">
              <label className="label">
                SIM {slot} {sim?.carrier ? `· ${sim.carrier}` : ''}{' '}
                {sim?.pinSet ? (
                  <span className="badge badge-green ml-1">PIN saved</span>
                ) : (
                  <span className="badge badge-amber ml-1">no PIN</span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  className="input mono flex-1"
                  type="password"
                  inputMode="numeric"
                  placeholder={sim?.pinSet ? 'Enter new PIN to replace' : 'Enter PIN'}
                  value={pins[slot] ?? ''}
                  onChange={(e) => setPins((p) => ({ ...p, [slot]: e.target.value.replace(/\D/g, '') }))}
                />
                <button
                  className="btn btn-primary"
                  disabled={busy || !(pins[slot] ?? '')}
                  onClick={() => save(slot, pins[slot] ?? '')}
                >
                  Save
                </button>
                {sim?.pinSet && (
                  <button
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Clear the saved PIN for SIM ${slot}?`)) save(slot, '');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {error && <div className="badge badge-red mb-3 w-full justify-center py-2">{error}</div>}
        {ok && <div className="badge badge-green mb-3 w-full justify-center py-2">{ok}</div>}

        <div className="flex justify-end">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
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
  // {pin} is auto-filled server-side when the selected SIM has a saved PIN.
  const pinSaved = !!device.sims.find((s) => s.slot === simCard)?.pinSet;

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

        {flow?.variables
          .filter((v) => !(v === 'provider_price' && flow.bundle)) // bundle-linked: backend fills it
          .filter((v) => !(v === 'pin' && pinSaved)) // saved SIM PIN: backend fills it
          .map((v) => (
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
        {!!flow?.bundle && flow.variables.includes('provider_price') && (
          <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            <span className="badge badge-blue mr-1">auto</span>
            provider_price is filled from the linked bundle&apos;s provider price
          </div>
        )}
        {pinSaved && flow?.variables.includes('pin') && (
          <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            <span className="badge badge-blue mr-1">auto</span>
            pin is filled from SIM {simCard}&apos;s saved PIN
          </div>
        )}

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
