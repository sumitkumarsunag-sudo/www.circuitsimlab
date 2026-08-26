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
import { validate } from '../../lib/circuit/validate.ts';
import type { Issue } from '../../lib/circuit/validate.ts';
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

export interface RunResult {
  ok: boolean;
  mode: SimMode;
  compiled: CompiledCircuit;
  issues: Issue[];
  dc?: DCResult;
  transient?: TransientResult;
  overlay?: Overlay;
  error?: string;
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

export async function runSimulation(circuit: Circuit, mode: SimMode, transientOpts?: {
  tStop: number;
  tStep: number;
}): Promise<RunResult> {
  const compiled = compileNetlist(circuit);
  const issues = validate(circuit, compiled);
  const hasError = issues.some((i) => i.severity === 'error');
  if (hasError) {
    return { ok: false, mode, compiled, issues, error: 'Fix the errors below before running.' };
  }
  if (compiled.netlist.nodeCount <= 1) {
    return { ok: false, mode, compiled, issues, error: 'Nothing to simulate yet.' };
  }

  try {
    const dc = await simulateDC(compiled.netlist);
    if (!dc.ok) {
      return { ok: false, mode, compiled, issues, dc, error: dc.error ?? 'DC solve failed.' };
    }
    const overlay = buildOverlay(dc, compiled);
    if (mode === 'transient') {
      const opts = transientOpts ?? defaultTransient(circuit);
      const tr = await simulateTransient(compiled.netlist, { ...opts, maxPoints: 2000 });
      if (!tr.ok) {
        return { ok: false, mode, compiled, issues, dc, overlay, error: tr.error ?? 'Transient solve failed.' };
      }
      return { ok: true, mode, compiled, issues, dc, transient: tr, overlay };
    }
    return { ok: true, mode, compiled, issues, dc, overlay };
  } catch (e) {
    return { ok: false, mode, compiled, issues, error: e instanceof Error ? e.message : String(e) };
  }
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
