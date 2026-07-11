'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, CatalogTree, Company, Package, Bundle, Device, Flow } from '@/lib/api';

type Editing =
  | { kind: 'company'; data?: Company }
  | { kind: 'package'; companyId: string; data?: Package }
  | { kind: 'bundle'; packageId: string; data?: Bundle }
  | null;

export default function CatalogPage() {
  const [tree, setTree] = useState<CatalogTree>([]);
  const [selCompany, setSelCompany] = useState<string | null>(null);
  const [selPackage, setSelPackage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [selling, setSelling] = useState<Bundle | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { tree } = await api.getCatalogTree();
    setTree(tree);
    setSelCompany((c) => c ?? tree[0]?._id ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const company = tree.find((c) => c._id === selCompany) ?? null;
  const pkg = company?.packages.find((p) => p._id === selPackage) ?? null;

  async function del(fn: () => Promise<unknown>, msg: string) {
    if (!confirm(msg)) return;
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <button className="btn" onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="badge badge-red mb-4">{error}</div>}

      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 480 }}>
        {/* Companies */}
        <Column
          title="Companies"
          onAdd={() => setEditing({ kind: 'company' })}
        >
          {tree.map((c) => (
            <Row
              key={c._id}
              active={c._id === selCompany}
              title={c.name}
              logo={c.logoUrl}
              subtitle={c.code || `${c.packages.length} packages`}
              inactive={!c.active}
              onClick={() => {
                setSelCompany(c._id);
                setSelPackage(null);
              }}
              onEdit={() => setEditing({ kind: 'company', data: c })}
              onDelete={() =>
                del(() => api.deleteCompany(c._id), `Delete "${c.name}" and all its packages/bundles?`)
              }
            />
          ))}
          {tree.length === 0 && <Empty text="No companies yet." />}
        </Column>

        {/* Packages */}
        <Column
          title={company ? `${company.name} · Packages` : 'Packages'}
          onAdd={company ? () => setEditing({ kind: 'package', companyId: company._id }) : undefined}
        >
          {company?.packages.map((p) => (
            <Row
              key={p._id}
              active={p._id === selPackage}
              title={p.name}
              subtitle={`${p.bundles.length} bundles`}
              inactive={!p.active}
              onClick={() => setSelPackage(p._id)}
              onEdit={() => setEditing({ kind: 'package', companyId: company._id, data: p })}
              onDelete={() => del(() => api.deletePackage(p._id), `Delete package "${p.name}" and its bundles?`)}
            />
          ))}
          {company && company.packages.length === 0 && <Empty text="No packages. Add one." />}
          {!company && <Empty text="Select a company." />}
        </Column>

        {/* Bundles */}
        <Column
          title={pkg ? `${pkg.name} · Bundles` : 'Bundles'}
          onAdd={pkg ? () => setEditing({ kind: 'bundle', packageId: pkg._id }) : undefined}
        >
          {pkg?.bundles.map((b) => (
            <BundleCard
              key={b._id}
              bundle={b}
              onEdit={() => setEditing({ kind: 'bundle', packageId: pkg._id, data: b })}
              onDelete={() => del(() => api.deleteBundle(b._id), `Delete bundle "${b.name}"?`)}
              onSell={() => setSelling(b)}
            />
          ))}
          {pkg && pkg.bundles.length === 0 && <Empty text="No bundles. Add one." />}
          {!pkg && <Empty text="Select a package." />}
        </Column>
      </div>

      {editing && (
        <EntityModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {selling && <SellModal bundle={selling} onClose={() => setSelling(null)} />}
    </div>
  );
}

function Column({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-sm font-medium">{title}</div>
        {onAdd && (
          <button className="btn px-2 py-1 text-xs" onClick={onAdd}>+ Add</button>
        )}
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function Row({
  title,
  subtitle,
  logo,
  active,
  inactive,
  onClick,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  logo?: string;
  active: boolean;
  inactive: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded px-3 py-2 cursor-pointer"
      style={{
        background: active ? 'var(--panel-2)' : 'transparent',
        border: `1px solid ${active ? 'var(--border)' : 'transparent'}`,
        opacity: inactive ? 0.5 : 1,
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {!!logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logo}
            alt=""
            className="rounded shrink-0"
            style={{ height: 28, width: 28, objectFit: 'contain', background: 'var(--panel-2)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div>
          <div className="text-sm">{title}</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>{subtitle}</div>
        </div>
      </div>
      <div className="flex gap-1">
        <button className="btn px-2 py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>✎</button>
        <button className="btn btn-danger px-2 py-0.5 text-xs" onClick={(e) => { e.stopPropagation(); onDelete(); }}>✕</button>
      </div>
    </div>
  );
}

function BundleCard({
  bundle,
  onEdit,
  onDelete,
  onSell,
}: {
  bundle: Bundle;
  onEdit: () => void;
  onDelete: () => void;
  onSell: () => void;
}) {
  return (
    <div
      className="rounded p-3"
      style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', opacity: bundle.active ? 1 : 0.5 }}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{bundle.name}</div>
        <div className="text-sm font-semibold" style={{ color: 'var(--accent-2)' }}>
          {bundle.price ? `${bundle.currency} ${bundle.price}` : 'free'}
        </div>
      </div>
      {!!bundle.providerPrice && (
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          provider: {bundle.currency} {bundle.providerPrice}
        </div>
      )}
      {!!bundle.description && (
        <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{bundle.description}</div>
      )}
      {!!bundle.validity && (
        <div className="text-xs" style={{ color: 'var(--muted)' }}>Validity: {bundle.validity}</div>
      )}
      <div className="text-xs mt-2">
        {bundle.flow ? (
          <span className="badge badge-blue">flow: {bundle.flow.flowId}</span>
        ) : (
          <span className="badge badge-amber">no flow linked</span>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <button className="btn btn-primary px-2 py-1 text-xs flex-1" disabled={!bundle.flow} onClick={onSell}>
          Sell
        </button>
        <button className="btn px-2 py-1 text-xs" onClick={onEdit}>Edit</button>
        <button className="btn btn-danger px-2 py-1 text-xs" onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs px-3 py-6 text-center" style={{ color: 'var(--muted)' }}>{text}</div>;
}

// ---- Create / edit modal for company | package | bundle ----
function EntityModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: NonNullable<Editing>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string | number | boolean | undefined>>(() => {
    if (editing.kind === 'company')
      return { name: editing.data?.name ?? '', code: editing.data?.code ?? '', logoUrl: editing.data?.logoUrl ?? '', description: editing.data?.description ?? '', active: editing.data?.active ?? true };
    if (editing.kind === 'package')
      return { name: editing.data?.name ?? '', description: editing.data?.description ?? '', active: editing.data?.active ?? true };
    return {
      name: editing.data?.name ?? '',
      price: editing.data?.price ?? 0,
      providerPrice: editing.data?.providerPrice ?? 0,
      currency: editing.data?.currency ?? 'USD',
      description: editing.data?.description ?? '',
      validity: editing.data?.validity ?? '',
      active: editing.data?.active ?? true,
    };
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set(k: string, v: string | number | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      if (editing.kind === 'company') {
        if (editing.data) await api.updateCompany(editing.data._id, form as Partial<Company>);
        else await api.createCompany(form as Partial<Company>);
      } else if (editing.kind === 'package') {
        const payload = { ...form, company: editing.companyId } as Partial<Package>;
        if (editing.data) await api.updatePackage(editing.data._id, payload);
        else await api.createPackage(payload);
      } else {
        const payload = {
          ...form,
          package: editing.packageId,
          price: Number(form.price),
          providerPrice: Number(form.providerPrice),
        } as Partial<Bundle>;
        if (editing.data) await api.updateBundle(editing.data._id, payload);
        else await api.createBundle(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  const title = `${editing.data ? 'Edit' : 'New'} ${editing.kind}`;

  return (
    <Modal onClose={onClose} title={title}>
      <label className="label">Name</label>
      <input className="input mb-3" value={String(form.name)} onChange={(e) => set('name', e.target.value)} />

      {editing.kind === 'company' && (
        <>
          <label className="label">Code / short code (optional)</label>
          <input className="input mb-3 mono" value={String(form.code ?? '')} onChange={(e) => set('code', e.target.value)} placeholder="*888#" />

          <label className="label">Logo URL (shown in the store)</label>
          <input
            className="input mb-2 mono"
            value={String(form.logoUrl ?? '')}
            onChange={(e) => set('logoUrl', e.target.value)}
            placeholder="https://example.com/logo.png"
          />
          {!!form.logoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={String(form.logoUrl)}
              alt="Logo preview"
              className="mb-3 rounded"
              style={{ height: 40, width: 40, objectFit: 'contain', background: 'var(--panel-2)', border: '1px solid var(--border)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
              onLoad={(e) => { (e.target as HTMLImageElement).style.opacity = '1'; }}
            />
          )}
        </>
      )}

      {editing.kind === 'bundle' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">App price (shown to clients)</label>
            <input className="input" type="number" value={String(form.price)} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div>
            <label className="label">Provider price (dialed / debited)</label>
            <input className="input" type="number" value={String(form.providerPrice)} onChange={(e) => set('providerPrice', e.target.value)} />
          </div>
          <div>
            <label className="label">Currency</label>
            <input className="input" value={String(form.currency)} onChange={(e) => set('currency', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Validity</label>
            <input className="input" value={String(form.validity)} onChange={(e) => set('validity', e.target.value)} placeholder="15 days" />
          </div>
        </div>
      )}

      <label className="label mt-3">Description</label>
      <input className="input mb-3" value={String(form.description)} onChange={(e) => set('description', e.target.value)} placeholder={editing.kind === 'bundle' ? 'unlimited data' : ''} />

      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={Boolean(form.active)} onChange={(e) => set('active', e.target.checked)} />
        Active
      </label>

      {error && <div className="badge badge-red mb-3 w-full justify-center py-2">{error}</div>}

      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !form.name}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}

// ---- Sell modal: run the bundle's linked flow on a device ----
function SellModal({ bundle, onClose }: { bundle: Bundle; onClose: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [simCard, setSimCard] = useState<1 | 2>(1);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listDevices().then((d) => {
      const online = d.devices.filter((x) => x.status === 'online');
      setDevices(online);
      setDeviceId(online[0]?.deviceId ?? '');
    });
    if (bundle.flow) api.getFlow(bundle.flow.flowId).then((r) => setFlow(r.flow));
  }, [bundle]);

  async function sell() {
    if (!bundle.flow) return;
    setError('');
    setResult('');
    setBusy(true);
    try {
      const res = await api.executeUssd({ deviceId, flowId: bundle.flow.flowId, simCard, variables: vars });
      setResult(`Queued ${res.transactionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Sell: ${bundle.name}`}>
      <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        {bundle.description} {bundle.validity && `· ${bundle.validity}`} · {bundle.currency} {bundle.price}
      </div>

      <label className="label">Gateway device (online)</label>
      <select className="select mb-3" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>{d.name || d.deviceId}</option>
        ))}
        {devices.length === 0 && <option value="">No online devices</option>}
      </select>

      <label className="label">SIM card</label>
      <select className="select mb-3" value={simCard} onChange={(e) => setSimCard(Number(e.target.value) as 1 | 2)}>
        <option value={1}>SIM 1</option>
        <option value={2}>SIM 2</option>
      </select>

      {flow?.variables
        .filter((v) => v !== 'provider_price') // auto-filled by the backend from the bundle
        .map((v) => (
          <div key={v} className="mb-3">
            <label className="label">{v}</label>
            <input
              className="input"
              type={/pin|password|otp/i.test(v) ? 'password' : 'text'}
              value={vars[v] ?? ''}
              onChange={(e) => setVars((p) => ({ ...p, [v]: e.target.value }))}
            />
          </div>
        ))}
      {flow?.variables.includes('provider_price') && (
        <div className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          <span className="badge badge-blue mr-1">auto</span>
          provider_price is filled from the bundle&apos;s provider price
        </div>
      )}

      {error && <div className="badge badge-red mb-3 w-full justify-center py-2">{error}</div>}
      {result && <div className="badge badge-green mb-3 w-full justify-center py-2">{result}</div>}

      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={sell} disabled={busy || !deviceId}>
          {busy ? 'Selling…' : 'Sell / Run'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="font-medium mb-4 capitalize">{title}</div>
        {children}
      </div>
    </div>
  );
}
