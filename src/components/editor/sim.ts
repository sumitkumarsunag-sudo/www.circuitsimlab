/**
 * Editor-side simulation glue.
 *
 * Compiles the schematic to a netlist, runs validation, invokes the solver
 * (via the worker client) and reshapes the raw result into overlay data the
 * canvas can draw: per-node voltages, per-wire current magnitude/direction and
 * per-component readouts. Nothing here fabricates values — every number comes
 * from the MNA solver.
 */
import { compileNetlist } from '../../lib/circuit/netlist.ts';
import type { CompiledCircuit } from '../../lib/circuit/netlist.ts';
import { validate, findFloatingNodes } from '../../lib/circuit/validate.ts';
import type { Issue } from '../../lib/circuit/validate.ts';
import type { Netlist, Element } from '../../lib/engine/types.ts';
import { getComponentDef } from '../../lib/components/registry.ts';
import { simulateDC, simulateTransient } from '../../lib/engine/simClient.ts';
import type { Circuit } from '../../lib/circuit/types.ts';
import type { DCResult, TransientResult } from '../../lib/engine/types.ts';

export type SimMode = 'dc' | 'transient';

export interface Overlay {
  /** node number -> voltage (V). */
  nodeVoltage: Map<number, number>;
  /** component id -> signed current (A) through its principal element. */
  current: Map<string, number>;
  /** component id -> power (W). */
  power: Map<string, number>;
  /** component id -> node pair for its two primary terminals. */
  totalPower: number;
}

/** Info about a detected short circuit for the blast animation. */
export interface ShortCircuitInfo {
  /** Component ids involved in the short. */
  componentIds: string[];
  /** World-space coordinates for the blast center. */
  x: number;
  y: number;
  /** Peak current that caused the short (A). */
  peakCurrent: number;
}

export interface RunResult {
  ok: boolean;
  mode: SimMode;
  compiled: CompiledCircuit;
  issues: Issue[];
  dc?: DCResult;
  transient?: TransientResult;
  overlay?: Overlay;
  error?: string;
  /** Present when a short circuit was detected — triggers the blast animation. */
  shortCircuit?: ShortCircuitInfo;
}

/**
 * Inject GMIN shunt conductances (tiny resistors to ground) for every floating
 * node.  This is the same trick real SPICE uses: it prevents the MNA matrix
 * from being singular while adding negligible error to well-connected nodes.
 */
function patchFloatingNodes(netlist: Netlist, floating: Set<number>): Netlist {
  const GMIN_R = 1e12; // 1 TΩ — effectively open but keeps the matrix non-singular
  const extra: Element[] = [];
  for (const node of floating) {
    extra.push({
      type: 'R',
      id: `__gmin_${node}`,
      nodes: [node, 0],
      resistance: GMIN_R,
    } as Element);
  }
  return {
    ...netlist,
    elements: [...netlist.elements, ...extra],
  };
}

/** Does the circuit contain energy-storage elements worth a transient run? */
export function hasDynamics(circuit: Circuit): boolean {
  return circuit.components.some((c) => {
    const def = getComponentDef(c.kind);
    return def && (c.kind === 'capacitor' || c.kind === 'inductor' ||
      c.kind === 'ac_source' || c.kind === 'pulse_source');
  });
}

function buildOverlay(dc: DCResult, compiled: CompiledCircuit): Overlay {
  const nodeVoltage = new Map<number, number>();
  dc.nodeVoltages.forEach((v, node) => nodeVoltage.set(node, v));
  const current = new Map<string, number>();
  const power = new Map<string, number>();
  // The solver keys currents/power by element id, which equals the component id
  // for single-element parts (and compId:suffix for multi-element ones).
  for (const [compId] of compiled.nodeMap) {
    let i = dc.currents[compId];
    let p = dc.power[compId];
    if (i === undefined) {
      // Sum multi-element parts (e.g. potentiometer compId:a / compId:b).
      let sumI = 0;
      let sumP = 0;
      let found = false;
      for (const key of Object.keys(dc.currents)) {
        if (key.startsWith(compId + ':')) {
          sumI = Math.max(sumI, Math.abs(dc.currents[key]));
          sumP += dc.power[key] ?? 0;
          found = true;
        }
      }
      if (found) {
        i = sumI;
        p = sumP;
      }
    }
    if (i !== undefined) current.set(compId, i);
    if (p !== undefined) power.set(compId, p);
  }
  return { nodeVoltage, current, power, totalPower: dc.totalPower };
}

/** Threshold (amps) above which we consider it a short circuit. */
const SHORT_CIRCUIT_THRESHOLD = 100;

/**
 * Detect short circuits:
 *  1. Voltage source with both terminals on the same node (direct short)
 *  2. Excessively high current through any element after solving
 */
function detectShortCircuit(
  circuit: Circuit,
  compiled: CompiledCircuit,
  dc?: DCResult
): ShortCircuitInfo | undefined {
  // Check 1: voltage source terminals shorted to the same node.
  for (const comp of circuit.components) {
    if (comp.kind === 'dc_source' || comp.kind === 'ac_source' || comp.kind === 'battery' || comp.kind === 'pulse_source') {
      const terms = compiled.nodeMap.get(comp.id);
      if (terms) {
        const nodes = [...terms.values()];
        if (nodes.length >= 2 && nodes[0] === nodes[1]) {
          return {
            componentIds: [comp.id],
            x: comp.x,
            y: comp.y,
            peakCurrent: Infinity,
          };
        }
      }
    }
  }

  // Check 2: after solving, any element drawing absurdly high current.
  if (dc?.ok && dc.currents) {
    let worstId = '';
    let worstI = 0;
    for (const [id, i] of Object.entries(dc.currents)) {
      if (id.startsWith('__gmin_')) continue; // ignore our shunt elements
      if (Math.abs(i) > worstI) {
        worstI = Math.abs(i);
        worstId = id;
      }
    }
    if (worstI > SHORT_CIRCUIT_THRESHOLD) {
      // Find the component for this element (element id = comp id or comp:suffix)
      const compId = worstId.includes(':') ? worstId.split(':')[0] : worstId;
      const comp = circuit.components.find((c) => c.id === compId);
      return {
        componentIds: [compId],
        x: comp?.x ?? 0,
        y: comp?.y ?? 0,
        peakCurrent: worstI,
      };
    }
  }

  return undefined;
}

function shortCircuitResult(
  mode: SimMode,
  compiled: CompiledCircuit,
  issues: Issue[],
  info: ShortCircuitInfo
): RunResult {
  const direct = !isFinite(info.peakCurrent);
  return {
    ok: false, mode, compiled, issues,
    shortCircuit: info,
    error: direct
      ? 'A source has both terminals wired to the same point, so current has nowhere to go.'
      : `A component is drawing ${formatCurrent(info.peakCurrent)} — far more than it can handle.`,
  };
}

export async function runSimulation(circuit: Circuit, mode: SimMode, transientOpts?: {
  tStop: number;
  tStep: number;
}): Promise<RunResult> {
  const compiled = compileNetlist(circuit);
  const issues = validate(circuit, compiled);
  const hasHardError = issues.some((i) => i.severity === 'error');

  // Hard errors are rare — everything else (missing ground symbol, floating
  // nodes, loose terminals) is a hint: the run still happens and the solver
  // adds GMIN shunts to keep the matrix solvable.
  if (hasHardError) {
    // Still check for direct shorts even before solving.
    const preShort = detectShortCircuit(circuit, compiled);
    if (preShort) return shortCircuitResult(mode, compiled, issues, preShort);
    return {
      ok: false, mode, compiled, issues,
      error: 'One thing needs fixing before this can run — see the note below.',
    };
  }
  if (compiled.netlist.nodeCount <= 1) {
    return {
      ok: false, mode, compiled, issues,
      error: 'Nothing to simulate yet — add a component or two and wire them together.',
    };
  }

  // Check for direct shorts before we even try solving.
  const preShort = detectShortCircuit(circuit, compiled);
  if (preShort) return shortCircuitResult(mode, compiled, issues, preShort);

  // Identify floating nodes and inject GMIN shunt conductances so the solver
  // doesn't hit a singular matrix for incomplete circuits.
  const floating = findFloatingNodes(circuit, compiled);
  const patchedNetlist = floating.size > 0
    ? patchFloatingNodes(compiled.netlist, floating)
    : compiled.netlist;

  try {
    const dc = await simulateDC(patchedNetlist);
    if (!dc.ok) {
      return {
        ok: false, mode, compiled, issues, dc,
        error: dc.error ?? "We couldn't solve this circuit — check your connections and try again.",
      };
    }

    // Post-solve short circuit detection (excessive current).
    const postShort = detectShortCircuit(circuit, compiled, dc);
    if (postShort) {
      // Keep the solved values so the canvas can still show what happened.
      const overlay = buildOverlay(dc, compiled);
      return {
        ...shortCircuitResult(mode, compiled, issues, postShort),
        dc,
        overlay,
      };
    }

    const overlay = buildOverlay(dc, compiled);
    if (mode === 'transient') {
      const opts = transientOpts ?? defaultTransient(circuit);
      const tr = await simulateTransient(patchedNetlist, { ...opts, maxPoints: 2000 });
      if (!tr.ok) {
        return {
          ok: false, mode, compiled, issues, dc, overlay,
          error: tr.error ?? 'The time-domain run did not finish — try adjusting the circuit or the timing settings.',
        };
      }
      return { ok: true, mode, compiled, issues, dc, transient: tr, overlay };
    }
    return { ok: true, mode, compiled, issues, dc, overlay };
  } catch (e) {
    const msg = e instanceof Error ? e.message.trim() : '';
    return {
      ok: false, mode, compiled, issues,
      error: msg || 'Something interrupted the simulation — please try running it again.',
    };
  }
}

function formatCurrent(amps: number): string {
  if (!isFinite(amps)) return '∞ A';
  if (amps >= 1000) return `${(amps / 1000).toFixed(1)} kA`;
  return `${amps.toFixed(1)} A`;
}

/** Choose sensible transient settings from the fastest source in the circuit. */
export function defaultTransient(circuit: Circuit): { tStop: number; tStep: number } {
  let fastest = 0; // Hz
  let slowestTau = 0;
  for (const c of circuit.components) {
    const f = Number((c.props.freq as string | undefined)?.toString().replace(/[^\d.eE+-]/g, '')) || 0;
    if (f > fastest) fastest = f;
  }
  if (fastest > 0) {
    const period = 1 / fastest;
    return { tStop: period * 5, tStep: period / 200 };
  }
  // No AC source — show ~5 time constants of a default RC.
  slowestTau = 1e-3;
  return { tStop: slowestTau * 5, tStep: slowestTau / 200 };
}
