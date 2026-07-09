'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { BRAND, BRAND_SHORT, BRAND_TAGLINE } from '@/lib/brand';

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
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="brand-mark" style={{ width: 44, height: 44, fontSize: '1.2rem' }}>
            {BRAND_SHORT.slice(0, 1)}
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">{BRAND}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>{BRAND_TAGLINE}</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="card p-8">
          <div className="mb-5">
            <h1 className="text-lg font-semibold">Sign in</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Access your control panel</p>
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

          {error && <div className="badge badge-red mb-4 w-full justify-center py-2">{error}</div>}

          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="text-center text-xs mt-4" style={{ color: 'var(--muted-2)' }}>
          {BRAND} · secure admin access
        </div>
      </div>
    </div>
  );
}
