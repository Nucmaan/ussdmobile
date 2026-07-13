'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Skeleton } from '@/lib/ui';
import { Icon } from '@/lib/icons';

export default function SettingsPage() {
  const [paymentNumber, setPaymentNumber] = useState('');
  const [paymentLabel, setPaymentLabel] = useState('');
  const [savedNumber, setSavedNumber] = useState('');
  const [savedLabel, setSavedLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { settings } = await api.getSettings();
    setPaymentNumber(settings.paymentNumber);
    setPaymentLabel(settings.paymentLabel);
    setSavedNumber(settings.paymentNumber);
    setSavedLabel(settings.paymentLabel);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = paymentNumber !== savedNumber || paymentLabel !== savedLabel;

  async function save() {
    setBusy(true);
    setError('');
    setOk('');
    try {
      const { settings } = await api.updateSettings({ paymentNumber, paymentLabel });
      setSavedNumber(settings.paymentNumber);
      setSavedLabel(settings.paymentLabel);
      setOk('Saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="h-display">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Configuration for the storefront and payments.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-hi)', marginBottom: 0 }}>
            <Icon name="wallet" size={20} />
          </div>
          <div>
            <div className="h-section">Payment number</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Shown to customers on the store&apos;s Pay Now screen.
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="label">Payment number (customers send money here)</label>
            {loading ? (
              <Skeleton h={40} />
            ) : (
              <input
                className="input mono"
                placeholder="0616461827"
                value={paymentNumber}
                onChange={(e) => setPaymentNumber(e.target.value)}
              />
            )}
            <div className="help">
              This is display only — it&apos;s the number of the SIM in your gateway phone. Payment
              matching relies on the SMS your phone receives, not on this value, so if you swap SIMs
              just update this label.
            </div>
          </div>

          <div>
            <label className="label">Label (optional)</label>
            {loading ? (
              <Skeleton h={40} />
            ) : (
              <input
                className="input"
                placeholder="Hormuud EVC Plus"
                value={paymentLabel}
                onChange={(e) => setPaymentLabel(e.target.value)}
              />
            )}
          </div>
        </div>

        {error && <div className="badge badge-red mt-4 w-full justify-center py-2">{error}</div>}
        {ok && !dirty && <div className="badge badge-green mt-4 w-full justify-center py-2">✓ {ok}</div>}

        <div className="flex justify-end mt-5">
          <button className="btn btn-primary" onClick={save} disabled={busy || !dirty || loading}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="h-section mb-2">How customer payments work</div>
        <ol className="text-sm flex flex-col gap-2" style={{ color: 'var(--muted)', paddingLeft: '1.1rem', listStyle: 'decimal' }}>
          <li>Customer picks a bundle, enters the number to receive data and the number they&apos;ll pay from, then taps Pay Now.</li>
          <li>They send the money to the payment number above.</li>
          <li>Your gateway phone receives the confirmation SMS and forwards it here.</li>
          <li>We match the sender number and amount, then automatically deliver the data.</li>
        </ol>
      </div>
    </div>
  );
}
