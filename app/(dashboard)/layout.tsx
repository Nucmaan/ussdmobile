'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, clearToken } from '@/lib/api';
import { useLiveFeed } from '@/lib/useLiveFeed';
import { BRAND, BRAND_SHORT, BRAND_TAGLINE } from '@/lib/brand';
import { Icon, IconName } from '@/lib/icons';
import { useTheme } from '@/lib/theme';
import { CommandPalette, useDefaultCommands } from '@/lib/CommandPalette';

interface NavEntry {
  href: string;
  label: string;
  icon: IconName;
}
const NAV_GROUPS: { section: string; items: NavEntry[] }[] = [
  {
    section: 'Operations',
    items: [
      { href: '/overview', label: 'Overview', icon: 'overview' },
      { href: '/devices', label: 'Devices', icon: 'devices' },
      { href: '/transactions', label: 'Transactions', icon: 'transactions' },
      { href: '/flows', label: 'Pipelines', icon: 'pipeline' },
    ],
  },
  {
    section: 'Commerce',
    items: [
      { href: '/catalog', label: 'Catalog', icon: 'catalog' },
      { href: '/wallets', label: 'Wallets & Orders', icon: 'wallet' },
    ],
  },
  {
    section: 'Access',
    items: [{ href: '/gateway-users', label: 'Gateway Users', icon: 'users' }],
  },
  {
    section: 'System',
    items: [{ href: '/settings', label: 'Settings', icon: 'settings' }],
  },
];
const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { connected } = useLiveFeed();
  const { theme, toggle } = useTheme();
  const commands = useDefaultCommands();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  function logout() {
    clearToken();
    router.replace('/login');
  }

  const current = ALL_NAV.find((n) => pathname.startsWith(n.href));

  return (
    <div className="flex flex-1 min-h-screen">
      <CommandPalette items={commands} />

      {/* Sidebar */}
      <aside
        className="shrink-0 flex flex-col gap-1 transition-all"
        style={{
          width: collapsed ? 72 : 'var(--sidebar-w)',
          borderRight: '1px solid var(--border)',
          background: 'var(--panel)',
          padding: '1rem 0.75rem',
        }}
      >
        <div className="flex items-center gap-3 px-1 py-1.5 mb-2" style={{ height: 44 }}>
          <div className="brand-mark">{BRAND_SHORT.slice(0, 1)}</div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold leading-tight truncate" style={{ color: 'var(--heading)' }}>{BRAND}</div>
              <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{BRAND_TAGLINE}</div>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV_GROUPS.map((group) => (
            <div key={group.section} className="flex flex-col gap-0.5">
              {!collapsed && <div className="nav-section">{group.section}</div>}
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                    style={collapsed ? { justifyContent: 'center' } : undefined}
                  >
                    <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            <span
              className={`dot ${connected ? 'dot-pulse' : ''}`}
              style={{ background: connected ? 'var(--good)' : 'var(--muted-2)' }}
            />
            {!collapsed && (connected ? 'Live · connected' : 'Reconnecting…')}
          </div>

          {!collapsed && (
            <div
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
              style={{ border: '1px solid var(--border)' }}
            >
              <div
                className="grid place-items-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent-hi)', fontWeight: 700, fontSize: 13 }}
              >
                A
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--heading)' }}>Admin</div>
                <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>Owner</div>
              </div>
              <button className="btn btn-ghost btn-icon tip" data-tip="Sign out" onClick={logout} aria-label="Sign out">
                <Icon name="logout" size={17} />
              </button>
            </div>
          )}
          {collapsed && (
            <button className="btn btn-ghost btn-icon mx-auto tip" data-tip="Sign out" onClick={logout} aria-label="Sign out">
              <Icon name="logout" size={17} />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center justify-between px-6 gap-4 sticky top-0 z-30"
          style={{
            height: 'var(--header-h)',
            borderBottom: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--bg) 75%, transparent)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Toggle sidebar"
            >
              <Icon name="sidebar" size={18} />
            </button>
            <nav className="flex items-center gap-2 text-sm min-w-0" aria-label="Breadcrumb">
              <span style={{ color: 'var(--muted)' }}>{BRAND_SHORT}</span>
              <span style={{ color: 'var(--muted-2)' }}>/</span>
              <span className="font-medium truncate" style={{ color: 'var(--heading)' }}>{current?.label ?? 'Dashboard'}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm"
              style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-2)', color: 'var(--muted)', minWidth: 200 }}
              onClick={() => {
                const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
                window.dispatchEvent(ev);
              }}
            >
              <Icon name="search" size={16} />
              <span className="flex-1 text-left">Search…</span>
              <span className="kbd">⌘K</span>
            </button>

            <div
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
              style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
            >
              <span className={`dot ${connected ? 'dot-pulse' : ''}`} style={{ background: connected ? 'var(--good)' : 'var(--warn)' }} />
              {connected ? 'Realtime' : 'Offline'}
            </div>

            <button className="btn btn-ghost btn-icon tip" data-tip="Notifications" aria-label="Notifications">
              <Icon name="bell" size={18} />
            </button>
            <button
              className="btn btn-ghost btn-icon tip"
              data-tip={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={toggle}
              aria-label="Toggle theme"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-x-auto">
          <div className="animate-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
