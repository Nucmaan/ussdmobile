'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, GatewayUser } from '@/lib/api';
import { timeAgo } from '@/lib/ui';

export default function GatewayUsersPage() {
  const [users, setUsers] = useState<GatewayUser[]>([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<GatewayUser | null>(null);

  const load = useCallback(async () => {
    const { users } = await api.listGatewayUsers();
    setUsers(users);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm" style={{ color: 'var(--muted)' }}>{users.length} gateway operators</div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New user</button>
      </div>

      <div className="card-flat p-3 mb-4 text-xs" style={{ color: 'var(--muted)', background: 'var(--panel-2)' }}>
        These are the accounts your gateway phones log in with (phone + password). Disabling an account
        immediately disconnects all of its phones.
      </div>

      {error && <div className="badge badge-red mb-4">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Phone (login)</th>
              <th>Name</th>
              <th>Phones</th>
              <th>Status</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="mono">{u.phone}</td>
                <td>{u.name || '—'}</td>
                <td>{u.deviceCount}</td>
                <td>
                  <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                    {u.active ? 'active' : 'disabled'}
                  </span>
                </td>
                <td style={{ color: 'var(--muted)' }}>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'never'}</td>
                <td>
                  <div className="flex gap-2 justify-end">
                    <button className="btn" onClick={() => setResetFor(u)}>Reset password</button>
                    {u.active ? (
                      <button className="btn" onClick={() => act(() => api.updateGatewayUser(u.id, { active: false }))}>
                        Disable
                      </button>
                    ) : (
                      <button className="btn" onClick={() => act(() => api.updateGatewayUser(u.id, { active: true }))}>
                        Enable
                      </button>
                    )}
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        if (confirm(`Delete operator "${u.phone}"? Their phones will be disconnected.`)) {
                          act(() => api.deleteGatewayUser(u.id));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No gateway users yet. Create one so your phone can log in.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            await load();
          }}
        />
      )}
      {resetFor && (
        <ResetModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => setResetFor(null)}
        />
      )}
    </div>
  );
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (phone.trim().length < 3 || password.length < 4) return setError('Phone and a password (min 4 chars) required');
    setError('');
    setBusy(true);
    try {
      await api.createGatewayUser({ phone: phone.trim(), password, name: name.trim() || undefined });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New gateway user" onClose={onClose}>
      <label className="label">Phone number (used to log in)</label>
      <input className="input mb-3 mono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="615000000" autoFocus />
      <label className="label">Name (optional)</label>
      <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shop 1 phone" />
      <label className="label">Password</label>
      <input className="input mb-4" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="give it to the operator" />
      {error && <div className="badge badge-red mb-3 w-full justify-center py-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
      </div>
    </Modal>
  );
}

function ResetModal({ user, onClose, onDone }: { user: GatewayUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (password.length < 4) return setError('Password must be at least 4 characters');
    setError('');
    setBusy(true);
    try {
      await api.resetGatewayUserPassword(user.id, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reset password — ${user.phone}`} onClose={onClose}>
      {done ? (
        <>
          <div className="badge badge-green mb-4 w-full justify-center py-2">Password updated</div>
          <div className="flex justify-end"><button className="btn btn-primary" onClick={onDone}>Done</button></div>
        </>
      ) : (
        <>
          <label className="label">New password</label>
          <input className="input mb-4" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          {error && <div className="badge badge-red mb-3 w-full justify-center py-2">{error}</div>}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
          </div>
        </>
      )}
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
