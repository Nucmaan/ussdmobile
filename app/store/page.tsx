'use client';

import { useEffect, useState, useCallback } from 'react';
import { publicApi, PublicCompany, PublicPackage, PublicBundle, PublicOrder } from '@/lib/api';
import { BRAND } from '@/lib/brand';

type Step = 'company' | 'package' | 'bundle' | 'checkout' | 'result';

export default function StorePage() {
  const [catalog, setCatalog] = useState<PublicCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [step, setStep] = useState<Step>('company');
  const [company, setCompany] = useState<PublicCompany | null>(null);
  const [pkg, setPkg] = useState<PublicPackage | null>(null);
  const [bundle, setBundle] = useState<PublicBundle | null>(null);
  const [phone, setPhone] = useState('');

  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<PublicOrder | null>(null);

  useEffect(() => {
    publicApi
      .catalog()
      .then((r) => setCatalog(r.catalog))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const money = (b: PublicBundle) => (b.price ? `${b.currency} ${b.price}` : 'Free');

  async function buy() {
    if (!bundle) return;
    if (phone.trim().length < 4) return setErr('Enter a valid phone number');
    setErr('');
    setPlacing(true);
    try {
      const res = await publicApi.order(bundle.id, phone.trim());
      setStep('result');
      // Seed a minimal order view, then poll for the final state.
      setOrder({
        orderId: res.orderId,
        status: res.status,
        message: res.message,
        bundleName: bundle.name,
        companyName: company?.name ?? '',
        price: bundle.price,
        currency: bundle.currency,
        recipientPhone: phone.trim(),
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setPlacing(false);
    }
  }

  // Poll the order until it reaches a terminal state.
  const poll = useCallback(async (orderId: string) => {
    try {
      const { order } = await publicApi.orderStatus(orderId);
      setOrder(order);
      return order.status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (step !== 'result' || !order) return;
    if (!['DISPATCHED', 'PENDING'].includes(order.status)) return;
    const t = setInterval(async () => {
      const s = await poll(order.orderId);
      if (s && !['DISPATCHED', 'PENDING'].includes(s)) clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, [step, order, poll]);

  function reset() {
    setStep('company');
    setCompany(null);
    setPkg(null);
    setBundle(null);
    setPhone('');
    setOrder(null);
    setErr('');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '20px 16px 40px' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="brand-mark">{BRAND.slice(0, 1)}</div>
          <div>
            <div className="font-semibold leading-tight">{BRAND}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Buy data instantly</div>
          </div>
        </div>

        {/* Breadcrumb */}
        {step !== 'result' && (
          <div className="flex items-center gap-1 text-xs mb-4 flex-wrap" style={{ color: 'var(--muted)' }}>
            <Crumb active={step === 'company'} done={!!company} onClick={() => { setStep('company'); }}>{company?.name ?? 'Network'}</Crumb>
            <span>›</span>
            <Crumb active={step === 'package'} done={!!pkg} onClick={() => company && setStep('package')}>{pkg?.name ?? 'Package'}</Crumb>
            <span>›</span>
            <Crumb active={step === 'bundle' || step === 'checkout'} done={!!bundle}>{bundle?.name ?? 'Bundle'}</Crumb>
          </div>
        )}

        {err && <div className="badge badge-red mb-4 w-full justify-center py-2">{err}</div>}

        {loading && <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Loading…</div>}

        {!loading && catalog.length === 0 && step === 'company' && (
          <div className="card p-8 text-center" style={{ color: 'var(--muted)' }}>No bundles available right now.</div>
        )}

        {/* Company */}
        {step === 'company' && (
          <div className="grid grid-cols-2 gap-3">
            {catalog.map((c) => (
              <button key={c.id} className="card p-5 text-left" onClick={() => { setCompany(c); setStep('package'); }}>
                <div className="brand-mark mb-2" style={{ background: 'linear-gradient(135deg,#334155,#475569)' }}>{c.name.slice(0, 1)}</div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{c.packages.length} packages</div>
              </button>
            ))}
          </div>
        )}

        {/* Package */}
        {step === 'package' && company && (
          <div className="flex flex-col gap-2">
            {company.packages.map((p) => (
              <button key={p.id} className="card p-4 text-left flex items-center justify-between" onClick={() => { setPkg(p); setStep('bundle'); }}>
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{p.bundles.length} bundles</div>
                </div>
                <span style={{ color: 'var(--muted)' }}>›</span>
              </button>
            ))}
          </div>
        )}

        {/* Bundle */}
        {step === 'bundle' && pkg && (
          <div className="flex flex-col gap-2">
            {pkg.bundles.map((b) => (
              <button key={b.id} className="card p-4 text-left" onClick={() => { setBundle(b); setStep('checkout'); }}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{b.name}</div>
                  <div className="font-semibold" style={{ color: 'var(--accent-2, #7c5cff)' }}>{money(b)}</div>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {b.description}{b.validity ? ` · ${b.validity}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Checkout */}
        {step === 'checkout' && bundle && (
          <div className="card p-5">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>{company?.name} · {pkg?.name}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-lg font-semibold">{bundle.name}</div>
              <div className="text-lg font-bold" style={{ color: 'var(--good)' }}>{money(bundle)}</div>
            </div>
            <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              {bundle.description}{bundle.validity ? ` · ${bundle.validity}` : ''}
            </div>

            <label className="label">Phone number to receive the data</label>
            <input
              className="input mb-4"
              inputMode="numeric"
              placeholder="61XXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary w-full" onClick={buy} disabled={placing}>
              {placing ? 'Placing order…' : `Buy for ${money(bundle)}`}
            </button>
            <button className="btn btn-ghost w-full mt-2" onClick={() => setStep('bundle')}>Back</button>
          </div>
        )}

        {/* Result */}
        {step === 'result' && order && <Result order={order} onDone={reset} />}
      </div>
    </div>
  );
}

function Result({ order, onDone }: { order: PublicOrder; onDone: () => void }) {
  const pending = ['DISPATCHED', 'PENDING'].includes(order.status);
  const success = order.status === 'SUCCESS';
  const color = success ? 'var(--good)' : pending ? 'var(--warn)' : 'var(--danger)';
  const title = success
    ? 'Data delivered 🎉'
    : pending
    ? 'Processing your order…'
    : order.status === 'INSUFFICIENT_FUNDS' || order.status === 'NO_GATEWAY' || order.status === 'UNAVAILABLE'
    ? 'Not available right now'
    : 'Order failed';

  return (
    <div className="card p-6 text-center">
      <div style={{ fontSize: 44 }}>{success ? '✅' : pending ? '⏳' : '⚠️'}</div>
      <div className="text-lg font-semibold mt-2" style={{ color }}>{title}</div>
      <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{order.message}</div>

      <div className="card-flat p-3 mt-4 text-sm text-left" style={{ background: 'var(--panel-2)' }}>
        <Row k="Bundle" v={order.bundleName} />
        <Row k="Network" v={order.companyName} />
        <Row k="Number" v={order.recipientPhone} />
        <Row k="Order" v={order.orderId} mono />
      </div>

      {pending && <div className="text-xs mt-3" style={{ color: 'var(--muted)' }}>This updates automatically.</div>}
      <button className="btn btn-primary w-full mt-4" onClick={onDone}>Buy another</button>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span className={mono ? 'mono text-xs' : ''}>{v}</span>
    </div>
  );
}

function Crumb({ children, active, done, onClick }: { children: React.ReactNode; active?: boolean; done?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        color: active ? 'var(--accent)' : done ? 'var(--foreground)' : 'var(--muted)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
