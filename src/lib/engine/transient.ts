/**
 * Transient (time-domain) analysis using Backward-Euler companion models.
 *
 * Capacitors and inductors are replaced each timestep by a conductance in
 * parallel with a current source derived from their previous state. Diodes are
 * handled with the same Newton-Raphson companion approach as DC. Backward Euler
 * is A-stable and non-oscillatory, which keeps RC/RL/RLC waveforms clean for
 * teaching without the ringing trapezoidal integration can introduce.
 */
import { solve } from './linalg.ts';
import { MNASystem, elementVoltage } from './mna.ts';
import type { Netlist, TransientPoint, TransientResult } from './types.ts';

const VT_DEFAULT = 0.025852;
const GMIN = 1e-12;
const SW_CLOSED_R = 1e-3;
const SW_OPEN_R = 1e12;
const MAX_STEPS = 200000;

/** SPICE pn-junction limiting (shared behaviour with the DC solver). */
function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    } else {
      vnew = vt * Math.log(Math.max(vnew, 1e-12) / vt);
    }
  }
  return vnew;
}

export interface TransientOptions {
  tStop: number;
  tStep: number;
  tStart?: number;
  /** Cap the number of returned points (decimation) to keep payloads small. */
  maxPoints?: number;
}

export function sourceValueAt(
  el: Netlist['elements'][number],
  t: number
): number {
  if (el.type === 'VPULSE') {
    const { v1, v2, delay, rise, fall, width, period } = el;
    if (t < delay) return v1;
    let td = t - delay;
    if (period > 0) td = td % period;
    if (td < rise) return v1 + ((v2 - v1) * td) / (rise || 1e-18);
    if (td < rise + width) return v2;
    if (td < rise + width + fall)
      return v2 + ((v1 - v2) * (td - rise - width)) / (fall || 1e-18);
    return v1;
  }
  if (el.type === 'VSIN') {
    const ph = ((el.phase ?? 0) * Math.PI) / 180;
    return el.offset + el.amplitude * Math.sin(2 * Math.PI * el.freq * t + ph);
  }
  if (el.type === 'V') return el.value;
  return 0;
}

function branchIdsFor(net: Netlist): string[] {
  const ids: string[] = [];
  for (const el of net.elements) {
    if (el.type === 'V' || el.type === 'VPULSE' || el.type === 'VSIN') ids.push(el.id);
    else if (el.type === 'SW' && el.closed) ids.push(el.id);
  }
  return ids;
}

export function transientAnalysis(net: Netlist, opts: TransientOptions): TransientResult {
  const { tStop, tStep } = opts;
  const tStart = opts.tStart ?? 0;
  const n = net.nodeCount - 1;
  if (n <= 0) return { ok: false, points: [], error: 'Circuit has no nodes above ground.' };
  if (tStep <= 0 || tStop <= 0) return { ok: false, points: [], error: 'Invalid time settings.' };

  const steps = Math.floor(tStop / tStep);
  if (steps > MAX_STEPS)
    return { ok: false, points: [], error: 'Too many time steps — increase the step size.' };

  const branchIds = branchIdsFor(net);
  const hasDiode = net.elements.some((e) => e.type === 'D');

  // State from initial conditions.
  const capV = new Map<string, number>();
  const indI = new Map<string, number>();
  for (const el of net.elements) {
    if (el.type === 'C') capV.set(el.id, el.ic ?? 0);
    if (el.type === 'L') indI.set(el.id, el.ic ?? 0);
  }

  const points: TransientPoint[] = [];
  const vdPrev = new Map<string, number>();
  let v = new Array<number>(net.nodeCount).fill(0);
  const h = tStep;

  for (let step = 0; step <= steps; step++) {
    const t = step * tStep;
    let x: number[] | null = null;
    const maxIter = hasDiode ? 100 : 1;

    for (let iter = 0; iter < maxIter; iter++) {
      const sys = new MNASystem(n, branchIds);
      let limitedThisIter = false;

      for (const el of net.elements) {
        switch (el.type) {
          case 'R':
            sys.stampConductance(el.nodes[0], el.nodes[1], 1 / safeR(el.resistance));
            break;
          case 'SW':
            sys.stampConductance(el.nodes[0], el.nodes[1], 1 / (el.closed ? SW_CLOSED_R : SW_OPEN_R));
            break;
          case 'I':
            sys.stampCurrent(el.nodes[0], el.nodes[1], el.value);
            break;
          case 'V':
          case 'VPULSE':
          case 'VSIN':
            sys.stampVoltageSource(el.nodes[0], el.nodes[1], sourceValueAt(el, t), el.id);
            break;
          case 'C': {
            const geq = el.capacitance / h;
            const vprev = capV.get(el.id) ?? 0;
            sys.stampConductance(el.nodes[0], el.nodes[1], geq);
            sys.stampCurrent(el.nodes[1], el.nodes[0], geq * vprev);
            break;
          }
          case 'L': {
            const geq = h / Math.max(el.inductance, 1e-18);
            const iprev = indI.get(el.id) ?? 0;
            sys.stampConductance(el.nodes[0], el.nodes[1], geq);
            sys.stampCurrent(el.nodes[0], el.nodes[1], iprev);
            break;
          }
          case 'D': {
            const vt = el.vt ?? VT_DEFAULT;
            const nvt = el.n * vt;
            const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * el.is));
            const vdRaw = elementVoltage(el, v);
            const vd = pnjlim(vdRaw, vdPrev.get(el.id) ?? 0, nvt, vcrit);
            if (Math.abs(vd - vdRaw) > 1e-9) limitedThisIter = true;
            vdPrev.set(el.id, vd);
            const evd = Math.exp(Math.min(vd / nvt, 80));
            const id = el.is * (evd - 1);
            const geq = (el.is / nvt) * evd + GMIN;
            const ieq = id - geq * vd;
            sys.stampConductance(el.nodes[0], el.nodes[1], geq);
            sys.stampCurrent(el.nodes[0], el.nodes[1], ieq);
            break;
          }
        }
      }

      x = solve(sys.A, sys.z);
      if (!x) return { ok: false, points, error: 'Singular matrix during transient step.' };

      const vNew = new Array<number>(net.nodeCount).fill(0);
      for (let node = 1; node < net.nodeCount; node++) vNew[node] = x[node - 1];

      if (!hasDiode) {
        v = vNew;
        break;
      }
      let converged = !limitedThisIter;
      for (let node = 1; node < net.nodeCount && converged; node++) {
        const tol = 1e-6 + 1e-3 * Math.abs(vNew[node]);
        if (Math.abs(vNew[node] - v[node]) > tol) converged = false;
      }
      v = vNew;
      if (converged) break;
    }

    // Record before updating state.
    if (t >= tStart) {
      points.push({ t, nodeVoltages: v.slice(), currents: branchCurrents(net, v, x!, capV, indI, h) });
    }

    // Update reactive state for next step.
    for (const el of net.elements) {
      if (el.type === 'C') capV.set(el.id, elementVoltage(el, v));
      if (el.type === 'L') {
        const geq = h / Math.max(el.inductance, 1e-18);
        const iprev = indI.get(el.id) ?? 0;
        indI.set(el.id, geq * elementVoltage(el, v) + iprev);
      }
    }
  }

  return { ok: true, points: decimate(points, opts.maxPoints) };
}

function branchCurrents(
  net: Netlist,
  v: number[],
  x: number[],
  capV: Map<string, number>,
  indI: Map<string, number>,
  h: number
): Record<string, number> {
  const branchIds = branchIdsFor(net);
  const currents: Record<string, number> = {};
  for (const el of net.elements) {
    const vAcross = elementVoltage(el, v);
    switch (el.type) {
      case 'R':
        currents[el.id] = vAcross / safeR(el.resistance);
        break;
      case 'SW':
        currents[el.id] = vAcross / (el.closed ? SW_CLOSED_R : SW_OPEN_R);
        break;
      case 'I':
        currents[el.id] = el.value;
        break;
      case 'C':
        currents[el.id] = (el.capacitance / h) * (vAcross - (capV.get(el.id) ?? 0));
        break;
      case 'L':
        currents[el.id] = indI.get(el.id) ?? 0;
        break;
      case 'D': {
        const vt = el.vt ?? VT_DEFAULT;
        const nvt = el.n * vt;
        currents[el.id] = el.is * (Math.exp(Math.min(vAcross / nvt, 80)) - 1);
        break;
      }
      case 'V':
      case 'VPULSE':
      case 'VSIN': {
        const k = branchIds.indexOf(el.id);
        currents[el.id] = k >= 0 ? x[net.nodeCount - 1 + k] : 0;
        break;
      }
    }
  }
  return currents;
}

function decimate(points: TransientPoint[], maxPoints?: number): TransientPoint[] {
  if (!maxPoints || points.length <= maxPoints) return points;
  const stride = Math.ceil(points.length / maxPoints);
  const out: TransientPoint[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

function safeR(r: number): number {
  return Number.isFinite(r) && r > 0 ? r : 1e-6;
}
