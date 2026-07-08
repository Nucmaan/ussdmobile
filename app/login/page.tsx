'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@sender.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      router.push('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">USSD Gateway</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Admin control panel
          </p>
        </div>

        <label className="label">Email</label>
        <input
          className="input mb-4"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />

        <label className="label">Password</label>
        <input
          className="input mb-5"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && (
          <div className="badge badge-red mb-4 w-full justify-center py-2">{error}</div>
        )}

        <button className="btn btn-primary w-full justify-center" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
