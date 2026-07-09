'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/api';
import { useLiveFeed } from '@/lib/useLiveFeed';
import { BRAND, BRAND_SHORT, BRAND_TAGLINE } from '@/lib/brand';

const NAV = [
  { href: '/overview', label: 'Overview', icon: '◧' },
  { href: '/devices', label: 'Devices', icon: '▤' },
  { href: '/gateway-users', label: 'Gateway Users', icon: '☺' },
  { href: '/catalog', label: 'Catalog', icon: '❏' },
  { href: '/wallets', label: 'Wallets & Orders', icon: '❖' },
  { href: '/flows', label: 'Pipelines', icon: '⑃' },
  { href: '/transactions', label: 'Transactions', icon: '⇄' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const { connected } = useLiveFeed();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  function logout() {
    clearToken();
    router.replace('/login');
  }

  const current = NAV.find((n) => pathname.startsWith(n.href));

  return (
    <div className="flex flex-1 min-h-screen">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 flex flex-col p-4 gap-2"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--panel)' }}
      >
        <div className="flex items-center gap-3 px-1 py-2 mb-3">
          <div className="brand-mark">{BRAND_SHORT.slice(0, 1)}</div>
          <div>
            <div className="font-semibold leading-tight">{BRAND}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>{BRAND_TAGLINE}</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            <span
              className="dot"
              style={{ background: connected ? 'var(--good)' : 'var(--muted-2)' }}
            />
            {connected ? 'Live · connected' : 'Reconnecting…'}
          </div>
          <button className="btn btn-ghost justify-start" onClick={logout}>
            <span className="nav-icon">⎋</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(13,18,32,0.6)', backdropFilter: 'blur(6px)' }}
        >
          <div>
            <div className="text-lg font-semibold">{current?.label ?? 'Dashboard'}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>{BRAND}</div>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <span className="dot" style={{ background: connected ? 'var(--good)' : 'var(--warn)' }} />
            {connected ? 'Realtime feed active' : 'Offline'}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
