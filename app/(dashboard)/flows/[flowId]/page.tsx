'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, Flow, FlowStep, StepAction } from '@/lib/api';

const ACTIONS: { value: StepAction; label: string; needsValue: 'none' | 'text' | 'variable' | 'button' }[] = [
  { value: 'DIAL_USSD', label: 'Dial USSD code', needsValue: 'text' },
  { value: 'WAIT_RESPONSE', label: 'Wait for response', needsValue: 'none' },
  { value: 'ENTER_TEXT', label: 'Enter fixed text', needsValue: 'text' },
  { value: 'ENTER_VARIABLE', label: 'Enter variable', needsValue: 'variable' },
  { value: 'CLICK_BUTTON', label: 'Click button', needsValue: 'button' },
  { value: 'READ_RESPONSE', label: 'Read response', needsValue: 'none' },
  { value: 'FINISH', label: 'Finish', needsValue: 'none' },
];

const emptyFlow: Flow = {
  flowId: '',
  name: '',
  description: '',
  startingCode: '',
  defaultSimSlot: 1,
  variables: [],
  steps: [{ order: 1, action: 'WAIT_RESPONSE', value: '' }],
  active: true,
};

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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
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
          <label className="label">Description</label>
          <input
            className="input"
            value={flow.description}
            onChange={(e) => setFlow({ ...flow, description: e.target.value })}
          />
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
            const meta = ACTIONS.find((a) => a.value === step.action)!;
            return (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded"
                style={{ background: 'var(--panel-2)', border: '1px solid var(--border)' }}
              >
                <div
                  className="mono text-xs w-6 text-center shrink-0"
                  style={{ color: 'var(--muted)' }}
                >
                  {idx + 1}
                </div>
                <select
                  className="select"
                  style={{ maxWidth: 190 }}
                  value={step.action}
                  onChange={(e) => setStep(idx, { action: e.target.value as StepAction, value: '' })}
                >
                  {ACTIONS.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>

                {meta.needsValue === 'none' ? (
                  <div className="flex-1 text-xs" style={{ color: 'var(--muted)' }}>no input</div>
                ) : (
                  <input
                    className="input mono flex-1"
                    value={step.value}
                    placeholder={
                      meta.needsValue === 'text'
                        ? step.action === 'DIAL_USSD' ? '*300#' : '2'
                        : meta.needsValue === 'variable'
                        ? 'phone'
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
