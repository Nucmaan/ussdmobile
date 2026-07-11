'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Flow, FlowStep, StepAction, CatalogTree, Device } from '@/lib/api';

// The variable name the storefront fills with the customer's number.
const CUSTOMER_VAR = 'phone';

// UI step "kinds". CUSTOMER_NUMBER is a friendly wrapper that stores an
// ENTER_VARIABLE step with value `phone` — so admins never type a magic word.
type StepKind = StepAction | 'CUSTOMER_NUMBER';
const STEP_KINDS: { kind: StepKind; label: string; input: 'none' | 'text' | 'variable' | 'button' | 'customer' }[] = [
  { kind: 'DIAL_USSD', label: 'Dial USSD code', input: 'text' },
  { kind: 'WAIT_RESPONSE', label: 'Wait for response', input: 'none' },
  { kind: 'ENTER_TEXT', label: 'Enter fixed text', input: 'text' },
  { kind: 'CUSTOMER_NUMBER', label: '★ Enter customer number', input: 'customer' },
  { kind: 'ENTER_VARIABLE', label: 'Enter variable (advanced)', input: 'variable' },
  { kind: 'CLICK_BUTTON', label: 'Click button', input: 'button' },
  { kind: 'READ_RESPONSE', label: 'Read response', input: 'none' },
  { kind: 'FINISH', label: 'Finish', input: 'none' },
];

/** Map a stored step to its UI kind. */
function kindOf(step: FlowStep): StepKind {
  if (step.action === 'ENTER_VARIABLE' && step.value === CUSTOMER_VAR) return 'CUSTOMER_NUMBER';
  return step.action;
}

/** Turn a chosen UI kind into the concrete stored step fields. */
function stepFromKind(kind: StepKind): Partial<FlowStep> {
  if (kind === 'CUSTOMER_NUMBER') return { action: 'ENTER_VARIABLE', value: CUSTOMER_VAR };
  return { action: kind as StepAction, value: '' };
}

const emptyFlow: Flow = {
  flowId: '',
  name: '',
  description: '',
  startingCode: '',
  defaultSimSlot: 1,
  variables: [],
  steps: [{ order: 1, action: 'WAIT_RESPONSE', value: '' }],
  active: true,
  bundle: null,
  device: '',
};

/** Flatten the catalog tree into selectable bundle options for the dropdown. */
interface BundleOption {
  id: string;
  label: string;
  takenBy: string | null; // flowId already linked to this bundle, if any
}
function flattenBundles(tree: CatalogTree): BundleOption[] {
  const out: BundleOption[] = [];
  for (const c of tree) {
    for (const p of c.packages) {
      for (const b of p.bundles) {
        out.push({
          id: b._id,
          label: `${c.name} / ${p.name} / ${b.name}`,
          takenBy: b.flow?.flowId ?? null,
        });
      }
    }
  }
  return out;
}

/** Derive the variable list from any {var} tokens and ENTER_VARIABLE steps. */
function deriveVariables(steps: FlowStep[]): string[] {
  const set = new Set<string>();
  for (const s of steps) {
    if (s.action === 'ENTER_VARIABLE' && s.value) set.add(s.value.replace(/[{}]/g, '').trim());
    const matches = s.value.match(/\{([a-zA-Z0-9_]+)\}/g);
    matches?.forEach((m) => set.add(m.replace(/[{}]/g, '')));
  }
  return [...set];
}

export default function FlowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.flowId as string;
  const isNew = flowId === 'new';

  const [flow, setFlow] = useState<Flow>(emptyFlow);
  const [bundleOptions, setBundleOptions] = useState<BundleOption[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ tree }, dev] = await Promise.all([api.getCatalogTree(), api.listDevices()]);
    setBundleOptions(flattenBundles(tree));
    setDevices(dev.devices);
    if (isNew) return;
    const { flow } = await api.getFlow(flowId);
    setFlow(flow);
  }, [flowId, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  function setStep(idx: number, patch: Partial<FlowStep>) {
    setFlow((f) => {
      const steps = f.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...f, steps, variables: deriveVariables(steps) };
    });
  }

  function addStep() {
    setFlow((f) => ({
      ...f,
      steps: [...f.steps, { order: f.steps.length + 1, action: 'WAIT_RESPONSE', value: '' }],
    }));
  }

  function removeStep(idx: number) {
    setFlow((f) => {
      const steps = f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
      return { ...f, steps, variables: deriveVariables(steps) };
    });
  }

  function move(idx: number, dir: -1 | 1) {
    setFlow((f) => {
      const steps = [...f.steps];
      const j = idx + dir;
      if (j < 0 || j >= steps.length) return f;
      [steps[idx], steps[j]] = [steps[j], steps[idx]];
      return { ...f, steps: steps.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      const payload = { ...flow, variables: deriveVariables(flow.steps) };
      if (isNew) await api.createFlow(payload);
      else await api.updateFlow(flowId, payload);
      router.push('/flows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">{isNew ? 'New flow' : `Edit: ${flow.name}`}</h1>
        <button className="btn" onClick={() => router.push('/flows')}>← Back</button>
      </div>

      {error && <div className="badge badge-red mb-4">{error}</div>}

      <div className="card p-5 mb-5 grid grid-cols-2 gap-4">
        <div>
          <label className="label">Flow ID (immutable key)</label>
          <input
            className="input"
            value={flow.flowId}
            disabled={!isNew}
            placeholder="customer_transfer"
            onChange={(e) => setFlow({ ...flow, flowId: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Service name</label>
          <input
            className="input"
            value={flow.name}
            placeholder="Customer Transfer"
            onChange={(e) => setFlow({ ...flow, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Starting USSD code</label>
          <input
            className="input mono"
            value={flow.startingCode}
            placeholder="*300#"
            onChange={(e) => setFlow({ ...flow, startingCode: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Default SIM</label>
          <select
            className="select"
            value={flow.defaultSimSlot}
            onChange={(e) => setFlow({ ...flow, defaultSimSlot: Number(e.target.value) as 1 | 2 })}
          >
            <option value={1}>SIM 1</option>
            <option value={2}>SIM 2</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Gateway device</label>
          <select
            className="select"
            value={flow.device ?? ''}
            onChange={(e) => setFlow({ ...flow, device: e.target.value })}
          >
            <option value="">— Any / auto (pick at run time · by carrier for store) —</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.name || d.deviceId} ({d.status})
              </option>
            ))}
          </select>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Leave on Auto unless this flow must run on a specific phone. Store orders fall back to
            another gateway on the same carrier if the chosen one is offline.
          </div>
        </div>
        <div className="col-span-2">
          <label className="label">Description</label>
          <input
            className="input"
            value={flow.description}
            onChange={(e) => setFlow({ ...flow, description: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <label className="label">Linked bundle (this flow buys)</label>
          <select
            className="select"
            value={flow.bundle ?? ''}
            onChange={(e) => setFlow({ ...flow, bundle: e.target.value || null })}
          >
            <option value="">— not linked —</option>
            {bundleOptions.map((b) => {
              const taken = b.takenBy && b.takenBy !== flow.flowId;
              return (
                <option key={b.id} value={b.id} disabled={!!taken}>
                  {b.label}{taken ? ` (linked to ${b.takenBy})` : ''}
                </option>
              );
            })}
          </select>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Pick which catalog bundle this flow purchases. Each bundle can be linked to only one flow.
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={flow.active}
            onChange={(e) => setFlow({ ...flow, active: e.target.checked })}
          />
          <span className="text-sm">Active</span>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium">Steps</div>
          <button className="btn" onClick={addStep}>+ Add step</button>
        </div>

        <div className="grid gap-2">
          {flow.steps.map((step, idx) => {
            const kind = kindOf(step);
            const meta = STEP_KINDS.find((a) => a.kind === kind)!;
            const isCustomer = kind === 'CUSTOMER_NUMBER';
            return (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded"
                style={{
                  background: isCustomer ? 'rgba(91,140,255,0.08)' : 'var(--panel-2)',
                  border: `1px solid ${isCustomer ? 'rgba(91,140,255,0.4)' : 'var(--border)'}`,
                }}
              >
                <div className="mono text-xs w-6 text-center shrink-0" style={{ color: 'var(--muted)' }}>
                  {idx + 1}
                </div>
                <select
                  className="select"
                  style={{ maxWidth: 210 }}
                  value={kind}
                  onChange={(e) => setStep(idx, stepFromKind(e.target.value as StepKind))}
                >
                  {STEP_KINDS.map((a) => (
                    <option key={a.kind} value={a.kind}>{a.label}</option>
                  ))}
                </select>

                {meta.input === 'none' ? (
                  <div className="flex-1 text-xs" style={{ color: 'var(--muted)' }}>no input</div>
                ) : meta.input === 'customer' ? (
                  <div className="flex-1 text-xs flex items-center gap-2" style={{ color: '#93c5fd' }}>
                    <span className="badge badge-blue">auto</span>
                    Uses the number the customer enters in the store
                  </div>
                ) : (
                  <input
                    className="input mono flex-1"
                    value={step.value}
                    placeholder={
                      meta.input === 'text'
                        ? step.action === 'DIAL_USSD' ? '*300#' : '2'
                        : meta.input === 'variable'
                        ? 'variable name'
                        : 'SEND / OK / CONTINUE'
                    }
                    onChange={(e) => setStep(idx, { value: e.target.value })}
                  />
                )}

                <div className="flex gap-1 shrink-0">
                  <button className="btn px-2" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
                  <button className="btn px-2" onClick={() => move(idx, 1)} disabled={idx === flow.steps.length - 1}>↓</button>
                  <button className="btn btn-danger px-2" onClick={() => removeStep(idx)}>✕</button>
                </div>
              </div>
            );
          })}
        </div>

        <FlowWarnings flow={flow} />

        {flow.variables.length > 0 && (
          <div className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>
            Detected variables:{' '}
            {flow.variables.map((v) => (
              <span key={v} className="badge badge-blue mr-1 mono">{v}</span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button className="btn" onClick={() => router.push('/flows')}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save flow'}
        </button>
      </div>
    </div>
  );
}

/** Guardrails so a sellable flow can't quietly ship the wrong recipient. */
function FlowWarnings({ flow }: { flow: Flow }) {
  const hasCustomerStep = flow.steps.some(
    (s) => s.action === 'ENTER_VARIABLE' && s.value === CUSTOMER_VAR,
  );
  // A fixed-text step that looks like a phone number is almost certainly a
  // recipient hardcoded by mistake.
  const hardcodedNumbers = flow.steps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.action === 'ENTER_TEXT' && /^\d{7,}$/.test(s.value.trim()));

  const warnings: string[] = [];
  if (flow.bundle && !hasCustomerStep) {
    warnings.push(
      "This flow is linked to a bundle but has no “Enter customer number” step — customers' numbers won't be delivered. Add one where the recipient should go.",
    );
  }
  for (const { s, i } of hardcodedNumbers) {
    warnings.push(
      `Step ${i + 1} enters a fixed number (${s.value}). If that is the customer's number, switch it to “Enter customer number” so each buyer's own number is used.`,
    );
  }

  if (warnings.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className="text-xs p-3 rounded"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: '#fcd34d' }}
        >
          ⚠ {w}
        </div>
      ))}
    </div>
  );
}
