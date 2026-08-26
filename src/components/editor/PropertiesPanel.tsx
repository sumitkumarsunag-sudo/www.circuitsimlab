import React from 'react';
import { getComponentDef } from '../../lib/components/registry.ts';
import type { PropSpec } from '../../lib/components/primitives.ts';
import type { PlacedComponent } from '../../lib/circuit/types.ts';
import { parseEng, formatValue } from '../../lib/units.ts';
import type { Overlay } from './sim.ts';

function ValueField({ spec, value, onChange }: { spec: PropSpec; value: string; onChange: (v: string) => void }) {
  const parsed = parseEng(value);
  const invalid = value !== '' && parsed === null;
  return (
    <div>
      <div className="flex items-center rounded border border-line bg-paper focus-within:border-accent overflow-hidden">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          aria-invalid={invalid}
          className="w-full px-2 py-1.5 text-sm outline-none tnum bg-transparent"
        />
        {spec.unit && <span className="px-2 text-xs text-faint select-none">{spec.unit}</span>}
      </div>
      {invalid && <p className="mt-1 text-xs text-err">Enter a value like 4.7k, 100n, 2.2M.</p>}
    </div>
  );
}

export function PropertiesPanel({
  component,
  overlay,
  onChangeProp,
  onRotate,
  onFlip,
  onDuplicate,
  onDelete,
  onClose,
}: {
  component: PlacedComponent | null;
  overlay: Overlay | null;
  onChangeProp: (key: string, value: string | number | boolean) => void;
  onRotate: () => void;
  onFlip: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose?: () => void;
}) {
  if (!component) return null;
  const def = getComponentDef(component.kind);
  if (!def) return null;

  const current = overlay?.current.get(component.id);
  const power = overlay?.power.get(component.id);

  return (
    <aside className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70vh] flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-64 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none md:relative md:z-auto" aria-label="Properties">
      <div className="md:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
        <span className="h-1 w-9 rounded-full bg-line-strong" />
      </div>
      <div className="flex items-center justify-between px-3 h-10 border-b border-line">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">{def.name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-faint tnum">{def.ref}</span>
          {onClose && (
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center text-muted hover:text-ink md:hidden" aria-label="Close properties panel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="p-3 space-y-3">
        {def.props.map((spec) => {
          const raw = component.props[spec.key];
          const strVal = raw === undefined || raw === null ? '' : String(raw);
          return (
            <div key={spec.key} className={spec.advanced ? 'opacity-90' : ''}>
              <label className="block text-xs font-medium text-ink-2 mb-1">
                {spec.label}{spec.advanced && <span className="text-faint font-normal"> · advanced</span>}
              </label>
              {spec.type === 'value' && <ValueField spec={spec} value={strVal} onChange={(v) => onChangeProp(spec.key, v)} />}
              {spec.type === 'text' && (
                <input value={strVal} onChange={(e) => onChangeProp(spec.key, e.target.value)}
                  className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent" />
              )}
              {spec.type === 'number' && (
                <input type="number" step="any" value={strVal} onChange={(e) => onChangeProp(spec.key, e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent tnum" />
              )}
              {spec.type === 'select' && (
                <select value={strVal} onChange={(e) => onChangeProp(spec.key, e.target.value)}
                  className="w-full rounded border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent">
                  {spec.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {spec.type === 'boolean' && (
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" checked={Boolean(raw)} onChange={(e) => onChangeProp(spec.key, e.target.checked)} />
                  {spec.label}
                </label>
              )}
            </div>
          );
        })}
      </div>

      {(current !== undefined || power !== undefined) && (
        <div className="mx-3 mb-3 rounded border border-line bg-paper p-3">
          <h4 className="text-[0.7rem] font-semibold uppercase tracking-wide text-faint mb-2">Measured</h4>
          <dl className="space-y-1 text-sm">
            {current !== undefined && (
              <div className="flex justify-between"><dt className="text-muted">Current</dt><dd className="tnum text-ink">{formatValue(Math.abs(current), 'A')}</dd></div>
            )}
            {power !== undefined && (
              <div className="flex justify-between"><dt className="text-muted">Power</dt><dd className="tnum text-ink">{formatValue(Math.abs(power), 'W')}</dd></div>
            )}
          </dl>
        </div>
      )}
      </div>

      <div className="grid grid-cols-2 gap-1 border-t border-line p-2 text-sm">
        <button onClick={onRotate} className="btn btn-ghost justify-center py-2.5" title="Rotate (R)">Rotate</button>
        <button onClick={onFlip} className="btn btn-ghost justify-center py-2.5" title="Flip (F)">Flip</button>
        <button onClick={onDuplicate} className="btn btn-ghost justify-center py-2.5" title="Duplicate (Ctrl+D)">Duplicate</button>
        <button onClick={onDelete} className="btn btn-ghost justify-center py-2.5 text-err" title="Delete (Del)">Delete</button>
      </div>
    </aside>
  );
}
