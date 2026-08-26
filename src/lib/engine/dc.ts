/**
 * DC operating-point analysis.
 *
 * Linear circuits are solved in a single MNA pass. Circuits containing diodes /
 * LEDs are solved with Newton-Raphson iteration using companion (linearised)
 * models with SPICE-style junction voltage limiting for reliable convergence.
 */
import { solve } from './linalg.ts';
import { MNASystem, branchElements, elementVoltage } from './mna.ts';
import type { DCResult, Element, Netlist } from './types.ts';

const GMIN = 1e-12; // shunt conductance across junctions to avoid singular matrices
const MAX_ITER = 200;
const VT_DEFAULT = 0.025852; // thermal voltage at ~300 K
const SW_CLOSED_R = 1e-3;
const SW_OPEN_R = 1e12;

/** SPICE pn-junction limiting to keep Newton steps sane. */
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

function nodeVoltagesFrom(x: number[], nodeCount: number): number[] {
  const v = new Array<number>(nodeCount).fill(0);
  for (let node = 1; node < nodeCount; node++) v[node] = x[node - 1];
  return v;
}

export function dcOperatingPoint(net: Netlist): DCResult {
  const n = net.nodeCount - 1; // non-ground nodes
  const branchIds = branchElements(net, { inductorAsShort: true });
  const hasNonlinear = net.elements.some((e) => e.type === 'D');

  if (n <= 0) {
    return emptyResult('Circuit has no nodes above ground.');
  }

  // Previous diode voltages for limiting.
  const vdPrev = new Map<string, number>();
  let v = new Array<number>(net.nodeCount).fill(0);
  let x: number[] | null = null;
  let iterations = 0;

  const maxIter = hasNonlinear ? MAX_ITER : 1;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const sys = new MNASystem(n, branchIds);
    stampLinear(sys, net);
    const limited = stampNonlinear(sys, net, v, vdPrev);

    x = solve(sys.A, sys.z);
    if (!x) {
      return {
        ...emptyResult('The circuit has no unique solution (singular matrix).'),
        iterations,
      };
    }

    const vNew = nodeVoltagesFrom(x, net.nodeCount);
    if (!hasNonlinear) {
      v = vNew;
      break;
    }

    // Convergence test on node voltages. Junction limiting must be inactive:
    // a limited step means the operating point is still being ramped in.
    let converged = !limited;
    for (let node = 1; node < net.nodeCount && converged; node++) {
      const tol = 1e-6 + 1e-3 * Math.abs(vNew[node]);
      if (Math.abs(vNew[node] - v[node]) > tol) converged = false;
    }
    v = vNew;
    if (converged) break;
    if (iter === maxIter - 1) {
      return {
        ...buildResult(net, v, x),
        ok: false,
        iterations,
        error: 'Solver did not converge. Check for missing connections or extreme component values.',
      };
    }
  }

  return { ...buildResult(net, v, x!), iterations };
}

function stampLinear(sys: MNASystem, net: Netlist): void {
  for (const el of net.elements) {
    switch (el.type) {
      case 'R':
        sys.stampConductance(el.nodes[0], el.nodes[1], 1 / clampR(el.resistance));
        break;
      case 'SW':
        sys.stampConductance(
          el.nodes[0],
          el.nodes[1],
          1 / (el.closed ? SW_CLOSED_R : SW_OPEN_R)
        );
        break;
      case 'C':
        // Open circuit in DC — no stamp.
        break;
      case 'L':
        // Short circuit in DC — 0 V source branch.
        sys.stampVoltageSource(el.nodes[0], el.nodes[1], 0, el.id);
        break;
      case 'I':
        sys.stampCurrent(el.nodes[0], el.nodes[1], el.value);
        break;
      case 'V':
        sys.stampVoltageSource(el.nodes[0], el.nodes[1], el.value, el.id);
        break;
      case 'VPULSE':
        sys.stampVoltageSource(el.nodes[0], el.nodes[1], el.v1, el.id);
        break;
      case 'VSIN':
        sys.stampVoltageSource(el.nodes[0], el.nodes[1], el.offset, el.id);
        break;
    }
  }
}

function stampNonlinear(
  sys: MNASystem,
  net: Netlist,
  v: number[],
  vdPrev: Map<string, number>
): boolean {
  let limited = false;
  for (const el of net.elements) {
    if (el.type !== 'D') continue;
    const vt = el.vt ?? VT_DEFAULT;
    const nvt = el.n * vt;
    const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * el.is));

    const vdRaw = elementVoltage(el, v);
    const vold = vdPrev.get(el.id) ?? 0;
    const vd = pnjlim(vdRaw, vold, nvt, vcrit);
    if (Math.abs(vd - vdRaw) > 1e-9) limited = true;
    vdPrev.set(el.id, vd);

    const evd = Math.exp(Math.min(vd / nvt, 80)); // clamp exponent to avoid Infinity
    const id = el.is * (evd - 1);
    const geq = (el.is / nvt) * evd + GMIN;
    const ieq = id - geq * vd;

    sys.stampConductance(el.nodes[0], el.nodes[1], geq);
    // Companion current source: the linearised diode current Ieq flows from
    // anode to cathode, so it is removed from the anode node.
    sys.stampCurrent(el.nodes[0], el.nodes[1], ieq);
  }
  return limited;
}

function clampR(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return 1e-6;
  return r;
}

function buildResult(net: Netlist, v: number[], x: number[]): DCResult {
  const currents: Record<string, number> = {};
  const power: Record<string, number> = {};
  let totalSourcePower = 0;

  for (const el of net.elements) {
    const vAcross = elementVoltage(el, v);
    let i = 0; // current from nodes[0] -> nodes[1] through element
    switch (el.type) {
      case 'R':
        i = vAcross / clampR(el.resistance);
        break;
      case 'SW':
        i = vAcross / (el.closed ? SW_CLOSED_R : SW_OPEN_R);
        break;
      case 'C':
        i = 0;
        break;
      case 'I':
        i = el.value;
        break;
      case 'D': {
        const vt = el.vt ?? VT_DEFAULT;
        const nvt = el.n * vt;
        i = el.is * (Math.exp(Math.min(vAcross / nvt, 80)) - 1);
        break;
      }
      case 'L':
      case 'V':
      case 'VPULSE':
      case 'VSIN': {
        const branch = sys_branchIndex(net, el);
        i = branch >= 0 ? x[branch] : 0;
        break;
      }
    }
    currents[el.id] = i;
    const absorbed = vAcross * i;
    power[el.id] = absorbed;
    if ((el.type === 'V' || el.type === 'VPULSE' || el.type === 'VSIN' || el.type === 'I') && absorbed < 0) {
      totalSourcePower += -absorbed;
    }
  }

  return {
    ok: true,
    nodeVoltages: v,
    currents,
    power,
    totalPower: totalSourcePower,
    iterations: 0,
  };
}

/** Recompute a branch index the same way MNASystem does (order matters). */
function sys_branchIndex(net: Netlist, el: Element): number {
  const branchIds = branchElements(net, { inductorAsShort: true });
  const k = branchIds.indexOf(el.id);
  return k < 0 ? -1 : net.nodeCount - 1 + k;
}

function emptyResult(error: string): DCResult {
  return {
    ok: false,
    nodeVoltages: [],
    currents: {},
    power: {},
    totalPower: 0,
    iterations: 0,
    error,
  };
}
