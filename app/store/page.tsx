'use client';

import { useEffect, useState, useCallback } from 'react';
import { publicApi, PublicCompany, PublicPackage, PublicBundle, PublicPayment } from '@/lib/api';
import { BRAND } from '@/lib/brand';

type Step = 'company' | 'package' | 'bundle' | 'checkout' | 'instructions' | 'status';

const PENDING = ['AWAITING_PAYMENT', 'PAID', 'DISPATCHED'];

export default function StorePage() {
  const [catalog, setCatalog] = useState<PublicCompany[]>([]);
  const [payInfo, setPayInfo] = useState<{ paymentNumber: string; paymentLabel: string }>({ paymentNumber: '', paymentLabel: '' });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [step, setStep] = useState<Step>('company');
  const [company, setCompany] = useState<PublicCompany | null>(null);
  const [pkg, setPkg] = useState<PublicPackage | null>(null);
  const [bundle, setBundle] = useState<PublicBundle | null>(null);
  const [recipient, setRecipient] = useState('');
  const [payer, setPayer] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [payment, setPayment] = useState<PublicPayment | null>(null);

  useEffect(() => {
    Promise.all([publicApi.catalog(), publicApi.paymentInfo().catch(() => ({ paymentNumber: '', paymentLabel: '' }))])
      .then(([c, info]) => {
        setCatalog(c.catalog);
        setPayInfo(info);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const money = (b: PublicBundle) => (b.price ? `${b.currency} ${b.price}` : 'Free');

  function toInstructions() {
    setErr('');
    if (recipient.trim().length < 4) return setErr('Enter the number to receive the data');
    if (payer.trim().length < 4) return setErr('Enter the number you will pay from');
    setStep('instructions');
  }

  // "I have paid" — create the pending payment; the SMS match delivers the data.
  async function iHavePaid() {
    if (!bundle) return;
    setErr('');
    setSubmitting(true);
    try {
      const res = await publicApi.pay(bundle.id, recipient.trim(), payer.trim());
      setPaymentId(res.paymentId);
      setPayment({
        paymentId: res.paymentId,
        status: 'AWAITING_PAYMENT',
        message: '',
        bundleName: bundle.name,
        companyName: company?.name ?? '',
        recipientPhone: recipient.trim(),
        amount: res.amount,
        currency: res.currency,
        orderId: '',
        expiresAt: new Date(Date.now() + 2 * 60_000).toISOString(),
      });
      setStep('status');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start payment');
    } finally {
      setSubmitting(false);
    }
  }

  // Poll the payment until it settles.
  const poll = useCallback(async (id: string) => {
    try {
      const { payment } = await publicApi.paymentStatus(id);
      setPayment(payment);
      return payment.status;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (step !== 'status' || !paymentId) return;
    if (payment && !PENDING.includes(payment.status)) return;
    const t = setInterval(async () => {
      const s = await poll(paymentId);
      if (s && !PENDING.includes(s)) clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, [step, paymentId, payment, poll]);

  function reset() {
    setStep('company');
    setCompany(null);
    setPkg(null);
    setBundle(null);
    setRecipient('');
    setPayer('');
    setPaymentId('');
    setPayment(null);
    setErr('');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '20px 16px 40px' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="brand-mark">{BRAND.slice(0, 1)}</div>
          <div>
            <div className="font-semibold leading-tight">{BRAND}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>Buy data instantly</div>
          </div>
        </div>

        {step !== 'status' && step !== 'instructions' && (
          <div className="flex items-center gap-1 text-xs mb-4 flex-wrap" style={{ color: 'var(--muted)' }}>
            <Crumb active={step === 'company'} done={!!company} onClick={() => setStep('company')}>{company?.name ?? 'Network'}</Crumb>
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

        {step === 'company' && (
          <div className="grid grid-cols-2 gap-3">
            {catalog.map((c) => (
              <button key={c.id} className="card card-interactive p-5 text-left" onClick={() => { setCompany(c); setStep('package'); }}>
                <div className="brand-mark mb-2" style={{ background: 'linear-gradient(135deg,#334155,#475569)' }}>{c.name.slice(0, 1)}</div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{c.packages.length} packages</div>
              </button>
            ))}
          </div>
        )}

        {step === 'package' && company && (
          <div className="flex flex-col gap-2">
            {company.packages.map((p) => (
              <button key={p.id} className="card card-interactive p-4 text-left flex items-center justify-between" onClick={() => { setPkg(p); setStep('bundle'); }}>
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{p.bundles.length} bundles</div>
                </div>
                <span style={{ color: 'var(--muted)' }}>›</span>
              </button>
            ))}
          </div>
        )}

        {step === 'bundle' && pkg && (
          <div className="flex flex-col gap-2">
            {pkg.bundles.map((b) => (
              <button key={b.id} className="card card-interactive p-4 text-left" onClick={() => { setBundle(b); setStep('checkout'); }}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{b.name}</div>
                  <div className="font-semibold" style={{ color: 'var(--accent-2)' }}>{money(b)}</div>
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  {b.description}{b.validity ? ` · ${b.validity}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}

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

            <label className="label">Number to receive the data</label>
            <input className="input mb-3" inputMode="numeric" placeholder="61XXXXXXX" value={recipient} onChange={(e) => setRecipient(e.target.value)} autoFocus />

            <label className="label">Number you will pay from</label>
            <input className="input mb-1" inputMode="numeric" placeholder="61XXXXXXX" value={payer} onChange={(e) => setPayer(e.target.value)} />
            <div className="help mb-4">We match your payment by this number, so enter the exact number you send the money from.</div>

            <button className="btn btn-primary w-full" onClick={toInstructions}>Pay {money(bundle)}</button>
            <button className="btn btn-ghost w-full mt-2" onClick={() => setStep('bundle')}>Back</button>
          </div>
        )}

        {step === 'instructions' && bundle && (
          <div className="card p-5 text-center">
            <div className="eyebrow">Amount to pay</div>
            <div className="text-3xl font-bold mt-1" style={{ color: 'var(--good)' }}>{bundle.currency} {bundle.price}</div>

            <div className="card-flat p-4 mt-4 text-left" style={{ background: 'var(--panel-2)' }}>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Send the money to</div>
              {payInfo.paymentNumber ? (
                <>
                  <div className="text-2xl font-bold mono mt-1" style={{ letterSpacing: '0.02em' }}>{payInfo.paymentNumber}</div>
                  {payInfo.paymentLabel && <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{payInfo.paymentLabel}</div>}
                </>
              ) : (
                <div className="text-sm mt-1" style={{ color: 'var(--warn)' }}>Payment number not configured — contact support.</div>
              )}
            </div>

            <div className="text-sm mt-4 text-left" style={{ color: 'var(--muted)' }}>
              1. Send <b style={{ color: 'var(--foreground)' }}>{bundle.currency} {bundle.price}</b> from <b style={{ color: 'var(--foreground)' }}>{payer}</b>.<br />
              2. Tap <b style={{ color: 'var(--foreground)' }}>I have paid</b> below.<br />
              3. Your data arrives on <b style={{ color: 'var(--foreground)' }}>{recipient}</b> automatically.
            </div>

            <button className="btn btn-success w-full mt-5" onClick={iHavePaid} disabled={submitting || !payInfo.paymentNumber}>
              {submitting ? 'Please wait…' : 'I have paid'}
            </button>
            <button className="btn btn-ghost w-full mt-2" onClick={() => setStep('checkout')}>Back</button>
          </div>
        )}

        {step === 'status' && payment && <PaymentResult payment={payment} onDone={reset} />}
      </div>
    </div>
  );
}

function PaymentResult({ payment, onDone }: { payment: PublicPayment; onDone: () => void }) {
  const s = payment.status;
  const waiting = s === 'AWAITING_PAYMENT';
  const delivering = s === 'PAID' || s === 'DISPATCHED';
  const delivered = s === 'DELIVERED';
  const pending = waiting || delivering;

  const color = delivered ? 'var(--good)' : pending ? 'var(--warn)' : 'var(--danger)';
  const emoji = delivered ? '✅' : delivering ? '⏳' : waiting ? '💳' : '⚠️';
  const title = delivered
    ? 'Data delivered 🎉'
    : delivering
    ? 'Payment received — delivering…'
    : waiting
    ? 'Waiting for your payment…'
    : s === 'EXPIRED'
    ? 'Payment not received in time'
    : s === 'REFUNDED'
    ? 'Delivery failed'
    : 'Something went wrong';

  const detail = delivered
    ? payment.message || 'Your data has been delivered.'
    : delivering
    ? 'We received your payment and are sending the data now.'
    : waiting
    ? 'Once your payment arrives we deliver automatically. This can take a moment.'
    : payment.message || 'Please contact support if money was deducted.';

  return (
    <div className="card p-6 text-center">
      <div style={{ fontSize: 44 }}>{emoji}</div>
      <div className="text-lg font-semibold mt-2" style={{ color }}>{title}</div>
      <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{detail}</div>

      <div className="card-flat p-3 mt-4 text-sm text-left" style={{ background: 'var(--panel-2)' }}>
        <Row k="Bundle" v={payment.bundleName} />
        <Row k="Network" v={payment.companyName} />
        <Row k="Deliver to" v={payment.recipientPhone} />
        <Row k="Amount" v={`${payment.currency} ${payment.amount}`} />
        {payment.orderId && <Row k="Order" v={payment.orderId} mono />}
      </div>

      {pending && <div className="text-xs mt-3" style={{ color: 'var(--muted)' }}>This updates automatically.</div>}
      <button className="btn btn-primary w-full mt-4" onClick={onDone} disabled={pending}>
        {pending ? 'Working…' : 'Buy another'}
      </button>
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
      style={{ color: active ? 'var(--accent)' : done ? 'var(--foreground)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}
    >
      {children}
    </button>
  );
}
