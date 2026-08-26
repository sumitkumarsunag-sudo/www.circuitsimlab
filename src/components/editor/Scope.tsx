import React, { useMemo } from 'react';
import type { RunResult } from './sim.ts';
import type { Circuit } from '../../lib/circuit/types.ts';
import { formatValue } from '../../lib/units.ts';

interface Trace {
  channel: 1 | 2;
  label: string;
  unit: string;
  color: string;
  points: { t: number; v: number }[];
}

const CH_COLOR: Record<number, string> = { 1: '#e0a32e', 2: '#0e7490' };

/** Extract oscilloscope traces from probes + transient data (real values only). */
function extractTraces(run: RunResult, circuit: Circuit): Trace[] {
  if (!run.transient) return [];
  const pts = run.transient.points;
  const traces: Trace[] = [];
  for (const comp of circuit.components) {
    if (comp.kind !== 'voltage_probe' && comp.kind !== 'current_probe') continue;
    const ch = Number(comp.props.channel ?? 0);
    if (ch !== 1 && ch !== 2) continue;
    const label = String(comp.props.label ?? (comp.kind === 'voltage_probe' ? 'V' : 'I'));
    if (comp.kind === 'voltage_probe') {
      const node = run.compiled.nodeMap.get(comp.id)?.get('p');
      if (node === undefined) continue;
      traces.push({
        channel: ch, label, unit: 'V', color: CH_COLOR[ch],
        points: pts.map((p) => ({ t: p.t, v: p.nodeVoltages[node] ?? 0 })),
      });
    } else {
      traces.push({
        channel: ch, label, unit: 'A', color: CH_COLOR[ch],
        points: pts.map((p) => ({ t: p.t, v: p.currents[comp.id] ?? 0 })),
      });
    }
  }
  return traces.sort((a, b) => a.channel - b.channel);
}

function stats(points: { t: number; v: number }[]) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (const p of points) { min = Math.min(min, p.v); max = Math.max(max, p.v); sum += p.v; }
  return { min, max, mean: sum / (points.length || 1), pp: max - min };
}

export function Scope({ run, circuit, frame, onClose }: {
  run: RunResult | null;
  circuit: Circuit;
  frame: number;
  onClose: () => void;
}) {
  const traces = useMemo(() => (run ? extractTraces(run, circuit) : []), [run, circuit]);
  const W = 560, H = 220, padL = 44, padR = 12, padT = 12, padB = 24;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const tMax = run?.transient?.points.at(-1)?.t ?? 1;
  const allV = traces.flatMap((tr) => tr.points.map((p) => p.v));
  let vMin = Math.min(0, ...allV), vMax = Math.max(0, ...allV);
  if (!isFinite(vMin) || vMin === vMax) { vMin = -1; vMax = 1; }
  const vPad = (vMax - vMin) * 0.1 || 0.1;
  vMin -= vPad; vMax += vPad;

  const xOf = (t: number) => padL + (t / tMax) * plotW;
  const yOf = (v: number) => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

  const cursorT = run?.transient && frame >= 0 ? run.transient.points[Math.min(frame, run.transient.points.length - 1)]?.t : undefined;

  return (
    <div className="border-t border-line bg-[#0b1220] text-[#c8d2df]">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-y-1 border-b border-white/10 px-3 py-1 md:h-9 md:flex-nowrap md:py-0">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Oscilloscope</span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {traces.length === 0 && <span className="text-white/40">Add a voltage/current probe and run a transient</span>}
          {traces.map((tr) => {
            const s = stats(tr.points);
            return (
              <span key={tr.label} className="inline-flex items-center gap-1.5 tnum" style={{ color: tr.color }}>
                <span className="h-2 w-3 rounded-sm" style={{ background: tr.color }} />
                CH{tr.channel} {tr.label} · Vpp {formatValue(s.pp, tr.unit)}
              </span>
            );
          })}
          <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="Close oscilloscope">✕</button>
        </div>
      </div>
      <div className="p-2 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 260 }} role="img" aria-label="Oscilloscope waveforms">
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="#0d1626" stroke="#1d2b40" />
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={padL + (i / 8) * plotW} y1={padT} x2={padL + (i / 8) * plotW} y2={padT + plotH} stroke="#152036" strokeWidth={1} />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1={padL} y1={padT + (i / 4) * plotH} x2={padL + plotW} y2={padT + (i / 4) * plotH} stroke="#152036" strokeWidth={1} />
          ))}
          {/* zero line */}
          <line x1={padL} y1={yOf(0)} x2={padL + plotW} y2={yOf(0)} stroke="#33465f" strokeWidth={1} strokeDasharray="3 3" />
          {/* axis labels */}
          <text x={padL - 6} y={yOf(vMax) + 4} fill="#5b6b82" fontSize="9" textAnchor="end" className="tnum">{vMax.toPrecision(2)}</text>
          <text x={padL - 6} y={yOf(vMin) + 4} fill="#5b6b82" fontSize="9" textAnchor="end" className="tnum">{vMin.toPrecision(2)}</text>
          <text x={padL + plotW} y={H - 8} fill="#5b6b82" fontSize="9" textAnchor="end" className="tnum">{formatValue(tMax, 's')}</text>
          {traces.map((tr) => (
            <polyline key={tr.label} fill="none" stroke={tr.color} strokeWidth={1.5}
              points={tr.points.map((p) => `${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ')} />
          ))}
          {cursorT !== undefined && (
            <line x1={xOf(cursorT)} y1={padT} x2={xOf(cursorT)} y2={padT + plotH} stroke="#e0a32e" strokeWidth={1} opacity={0.6} />
          )}
        </svg>
      </div>
    </div>
  );
}
