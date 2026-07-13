'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, IconName } from './icons';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  run: () => void;
}

/**
 * ⌘K / Ctrl+K command palette. Opens globally, filters commands by label,
 * arrow-key navigable, Enter to run, Esc to close.
 */
export function CommandPalette({ items }: { items: CommandItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q));
  }, [items, query]);

  const choose = useCallback(
    (item: CommandItem | undefined) => {
      if (!item) return;
      setOpen(false);
      item.run();
    },
    [],
  );

  if (!open) return null;

  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="flex items-center gap-2 px-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <Icon name="search" size={18} className="text-muted" />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search pages and actions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(filtered[active]);
              }
            }}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="py-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--muted)' }}>
              No matches for “{query}”
            </div>
          )}
          {filtered.map((item, i) => (
            <div
              key={item.id}
              className="cmdk-item"
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
            >
              <span className="text-muted"><Icon name={item.icon} size={17} /></span>
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="text-xs" style={{ color: 'var(--muted-2)' }}>{item.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Build the default navigation + action commands. */
export function useDefaultCommands(): CommandItem[] {
  const router = useRouter();
  return useMemo<CommandItem[]>(
    () => [
      { id: 'overview', label: 'Go to Overview', hint: 'Dashboard', icon: 'overview', run: () => router.push('/overview') },
      { id: 'devices', label: 'Go to Devices', hint: 'Gateways', icon: 'devices', run: () => router.push('/devices') },
      { id: 'gateway-users', label: 'Go to Gateway Users', hint: 'Operators', icon: 'users', run: () => router.push('/gateway-users') },
      { id: 'catalog', label: 'Go to Catalog', hint: 'Products', icon: 'catalog', run: () => router.push('/catalog') },
      { id: 'wallets', label: 'Go to Wallets & Orders', hint: 'Finance', icon: 'wallet', run: () => router.push('/wallets') },
      { id: 'flows', label: 'Go to Pipelines', hint: 'Flows', icon: 'pipeline', run: () => router.push('/flows') },
      { id: 'transactions', label: 'Go to Transactions', hint: 'Runs', icon: 'transactions', run: () => router.push('/transactions') },
      { id: 'settings', label: 'Go to Settings', hint: 'System', icon: 'settings', run: () => router.push('/settings') },
      { id: 'new-flow', label: 'Create new Pipeline', hint: 'Action', icon: 'plus', run: () => router.push('/flows/new') },
    ],
    [router],
  );
}
