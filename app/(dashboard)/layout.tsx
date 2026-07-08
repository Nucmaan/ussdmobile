'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/api';
import { useLiveFeed } from '@/lib/useLiveFeed';

const NAV = [
  { href: '/overview', label: 'Overview', icon: '▦' },
  { href: '/devices', label: 'Devices', icon: '▤' },
  { href: '/flows', label: 'USSD Flows', icon: '⑃' },
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

  return (
    <div className="flex flex-1 min-h-screen">
      <aside
        className="w-60 shrink-0 flex flex-col p-4 gap-1"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--panel)' }}
      >
        <div className="px-2 py-3 mb-2">
          <div className="font-semibold">USSD Gateway</div>
          <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: connected ? 'var(--accent-2)' : 'var(--muted)',
                display: 'inline-block',
              }}
            />
            {connected ? 'Live' : 'Reconnecting…'}
          </div>
        </div>

        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="btn justify-start"
              style={{
                background: active ? 'var(--panel-2)' : 'transparent',
                borderColor: active ? 'var(--border)' : 'transparent',
              }}
            >
              <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <div className="mt-auto">
          <button className="btn justify-start w-full" onClick={logout}>
            <span style={{ width: 18, textAlign: 'center' }}>⎋</span> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-x-auto">{children}</main>
    </div>
  );
}
