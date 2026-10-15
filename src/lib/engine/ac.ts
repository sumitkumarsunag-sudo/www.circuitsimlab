/**
 * AC (frequency-domain) small-signal analysis.
 *
 * The circuit is linearised (diodes use their small-signal conductance at the DC
 * operating point) and solved with complex MNA at each frequency in a sweep.
 * Reactive elements contribute complex admittances: a capacitor is jωC, an
 * inductor is 1/(jωL). Independent voltage sources carry their AC magnitude and
 * phase; DC-only sources act as shorts (0 V AC).
 */
import {
  cAbs,
  cPhaseDeg,
  solveComplex,
  type Complex,
} from './linalg.ts';
import { dcOperatingPoint } from './dc.ts';
import { branchElements, elementVoltage } from './mna.ts';
import type { ACPoint, ACResult, Netlist } from './types.ts';

const VT_DEFAULT = 0.025852;

export interface ACOptions {
  fStart: number;
  fStop: number;
  /** Points per decade for a logarithmic sweep. */
  pointsPerDecade?: number;
  /** Total linear points (used when sweep is 'lin'). */
  points?: number;
  sweep?: 'dec' | 'lin';
}

function frequencies(opts: ACOptions): number[] {
  const sweep = opts.sweep ?? 'dec';
  if (sweep === 'lin') {
    const pts = opts.points ?? 100;
    const out: number[] = [];
    for (let i = 0; i < pts; i++) {
      out.push(opts.fStart + ((opts.fStop - opts.fStart) * i) / Math.max(pts - 1, 1));
    }
    return out;
  }
  const ppd = opts.pointsPerDecade ?? 20;
  const decades = Math.log10(opts.fStop / opts.fStart);
  const total = Math.max(1, Math.round(decades * ppd));
  const out: number[] = [];
  for (let i = 0; i <= total; i++) {
    out.push(opts.fStart * Math.pow(10, (decades * i) / total));
  }
  return out;
}

export function acAnalysis(net: Netlist, opts: ACOptions): ACResult {
  const n = net.nodeCount - 1;
  if (n <= 0) return { ok: false, points: [], error: 'Nothing to simulate yet — add a component and wire it up.' };
  if (opts.fStart <= 0 || opts.fStop <= opts.fStart)
    return { ok: false, points: [], error: 'The frequency range needs a stop value above the start value.' };

  // Diode small-signal conductances from the DC operating point.
  const dc = dcOperatingPoint(net);
  const diodeG = new Map<string, number>();
  for (const el of net.elements) {
    if (el.type === 'D' && dc.ok) {
      const nvt = el.n * (el.vt ?? VT_DEFAULT);
      const vd = elementVoltage(el, dc.nodeVoltages);
      diodeG.set(el.id, (el.is / nvt) * Math.exp(Math.min(vd / nvt, 80)));
    }
  }

  const branchIds = branchElements(net, { inductorAsShort: false });
  const m = branchIds.length;
  const size = n + m;
  const branchOf = new Map<string, number>();
  branchIds.forEach((id, k) => branchOf.set(id, n + k));

  const idx = (node: number) => (node === 0 ? -1 : node - 1);
  const freqs = frequencies(opts);
  const points: ACPoint[] = [];

  for (const f of freqs) {
    const w = 2 * Math.PI * f;
    const A: Complex[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => [0, 0] as Complex)
    );
    const z: Complex[] = Array.from({ length: size }, () => [0, 0] as Complex);

    const addY = (a: number, b: number, y: Complex) => {
      const ia = idx(a);
      const ib = idx(b);
      if (ia >= 0) A[ia][ia] = [A[ia][ia][0] + y[0], A[ia][ia][1] + y[1]];
      if (ib >= 0) A[ib][ib] = [A[ib][ib][0] + y[0], A[ib][ib][1] + y[1]];
      if (ia >= 0 && ib >= 0) {
        A[ia][ib] = [A[ia][ib][0] - y[0], A[ia][ib][1] - y[1]];
        A[ib][ia] = [A[ib][ia][0] - y[0], A[ib][ia][1] - y[1]];
      }
    };

    for (const el of net.elements) {
      switch (el.type) {
        case 'R':
          addY(el.nodes[0], el.nodes[1], [1 / (el.resistance || 1e-6), 0]);
          break;
        case 'C':
          addY(el.nodes[0], el.nodes[1], [0, w * el.capacitance]);
          break;
        case 'L':
          addY(el.nodes[0], el.nodes[1], [0, -1 / (w * Math.max(el.inductance, 1e-18))]);
          break;
        case 'SW':
          addY(el.nodes[0], el.nodes[1], [el.closed ? 1e3 : 1e-12, 0]);
          break;
        case 'D':
          addY(el.nodes[0], el.nodes[1], [diodeG.get(el.id) ?? 0, 0]);
          break;
        case 'I':
          if (idx(el.nodes[0]) >= 0) z[idx(el.nodes[0])] = [z[idx(el.nodes[0])][0] - el.value, 0];
          if (idx(el.nodes[1]) >= 0) z[idx(el.nodes[1])] = [z[idx(el.nodes[1])][0] + el.value, 0];
          break;
        case 'V':
        case 'VPULSE':
        case 'VSIN': {
          const p = branchOf.get(el.id)!;
          const ia = idx(el.nodes[0]);
          const ib = idx(el.nodes[1]);
          if (ia >= 0) {
            A[ia][p] = [A[ia][p][0] + 1, A[ia][p][1]];
            A[p][ia] = [A[p][ia][0] + 1, A[p][ia][1]];
          }
          if (ib >= 0) {
            A[ib][p] = [A[ib][p][0] - 1, A[ib][p][1]];
            A[p][ib] = [A[p][ib][0] - 1, A[p][ib][1]];
          }
          const acMag =
            el.type === 'V' ? el.acMag ?? 0 : el.type === 'VSIN' ? el.amplitude : 0;
          const phaseDeg =
            el.type === 'V' ? el.acPhase ?? 0 : el.type === 'VSIN' ? el.phase ?? 0 : 0;
          const phase = (phaseDeg * Math.PI) / 180;
          z[p] = [acMag * Math.cos(phase), acMag * Math.sin(phase)];
          break;
        }
      }
    }

    const x = solveComplex(A, z);
    if (!x) return { ok: false, points, error: 'We could not solve this circuit across frequencies — check your connections and try again.' };

    const nodeMag = new Array<number>(net.nodeCount).fill(0);
    const nodePhase = new Array<number>(net.nodeCount).fill(0);
    for (let node = 1; node < net.nodeCount; node++) {
      nodeMag[node] = cAbs(x[node - 1]);
      nodePhase[node] = cPhaseDeg(x[node - 1]);
    }
    points.push({ freq: f, nodeMag, nodePhase });
  }

  return { ok: true, points };
}
