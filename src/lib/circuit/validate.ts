/**
 * Pre-simulation validation.
 *
 * Produces friendly, actionable hints before the solver runs.  Issues are
 * graded so nothing that can plausibly be solved ever blocks the user:
 *
 *  - **error** — reserved for the rare case where no result at all is possible.
 *  - **warning** — imperfections worth knowing about (no ground symbol yet,
 *    floating nodes, unconnected terminals).  These are shown as hints and the
 *    simulation runs regardless; the solver inserts shunt conductances (GMIN)
 *    where needed so the matrix stays solvable.
 */
import type { Circuit } from './types.ts';
import type { CompiledCircuit } from './netlist.ts';
import { REGISTRY } from '../components/registry.ts';

export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  message: string;
  detail?: string;
  /** Component ids this issue relates to (for highlighting). */
  refs?: string[];
}

/** Elements that provide a DC conduction path between their two nodes. */
function dcConnects(kind: string, props: Record<string, unknown>): boolean {
  switch (kind) {
    case 'capacitor':
      return false; // open at DC
    case 'switch':
      return Boolean(props.closed);
    default:
      return true;
  }
}

/**
 * Identify which node numbers have no DC path to the 0 V reference.
 * Returned set is empty when every node is reachable or there is no reference.
 */
export function findFloatingNodes(circuit: Circuit, compiled: CompiledCircuit): Set<number> {
  if (compiled.groundNode < 0) return new Set();

  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
    (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
  };
  for (const comp of circuit.components) {
    const terms = compiled.nodeMap.get(comp.id);
    if (!terms || !dcConnects(comp.kind, comp.props)) continue;
    const nodes = [...terms.values()];
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) link(nodes[i], nodes[j]);
  }
  // BFS from ground.
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
  }
  const floating = new Set<number>();
  for (const terms of compiled.nodeMap.values())
    for (const n of terms.values())
      if (n !== 0 && !seen.has(n)) floating.add(n);
  return floating;
}

export function validate(circuit: Circuit, compiled: CompiledCircuit): Issue[] {
  const issues: Issue[] = [];

  if (circuit.components.length === 0) {
    return [{ severity: 'warning', message: 'Nothing on the canvas yet — drop in a couple of components and wire them together.' }];
  }

  // Ground symbol — helpful, but never a requirement.  Without one the
  // compiler elects a net as the reference, so simulation proceeds and we just
  // leave a friendly note.
  const hasGroundSymbol = circuit.components.some((c) => c.kind === 'ground');
  if (!hasGroundSymbol && compiled.implicitGround) {
    issues.push({
      severity: 'warning',
      message: 'No ground symbol yet — voltages are being read from an automatically chosen reference.',
      detail: 'The simulation still runs; only the absolute numbers shift (voltage differences stay exact). Drop a Ground symbol onto the return path and every reading will line up with the usual 0 V convention.',
    });
  }

  // A node is shared when something else also lands on it (a second terminal or
  // a wire).
  const nodeTermCount = new Map<number, number>();
  for (const [, terms] of compiled.nodeMap) {
    for (const node of terms.values()) nodeTermCount.set(node, (nodeTermCount.get(node) ?? 0) + 1);
  }
  const wireNodes = new Set(compiled.wireNode.values());
  const isShared = (node: number) => (nodeTermCount.get(node) ?? 0) > 1 || wireNodes.has(node);

  // A component that touches nothing else — freshly dropped and left sitting on
  // its own — is not worth nagging about. Stay quiet about it until the user
  // wires it into something.
  const connected = new Map<string, boolean>();
  for (const comp of circuit.components) {
    const terms = compiled.nodeMap.get(comp.id);
    connected.set(comp.id, Boolean(terms && [...terms.values()].some(isShared)));
  }

  // Loose terminals on a part that *is* wired in → hint only (never blocks).
  for (const comp of circuit.components) {
    if (!connected.get(comp.id)) continue;
    const def = REGISTRY[comp.kind];
    if (!def) continue;
    const terms = compiled.nodeMap.get(comp.id);
    if (!terms) continue;
    for (const [tname, node] of terms) {
      if (!isShared(node) && node !== 0) {
        const label = comp.props.label ? String(comp.props.label) : def.name;
        issues.push({
          severity: 'warning',
          message: `${label}: terminal "${tname}" is not connected to anything.`,
          refs: [comp.id],
        });
      }
    }
  }

  // Floating nodes → hint only.  The solver will add GMIN shunts to keep the
  // matrix non-singular, so simulation still proceeds. Nodes that belong purely
  // to not-yet-connected parts are skipped for the same reason as above.
  if (compiled.groundNode >= 0) {
    const floating = findFloatingNodes(circuit, compiled);
    for (const n of floating) {
      let touchesWiredPart = false;
      for (const [compId, terms] of compiled.nodeMap) {
        for (const node of terms.values()) {
          if (node === n && connected.get(compId)) { touchesWiredPart = true; break; }
        }
        if (touchesWiredPart) break;
      }
      if (!touchesWiredPart) continue;
      issues.push({
        severity: 'warning',
        message: `Part of the circuit is floating (node ${n}) — connect it back to the rest for accurate readings.`,
        detail: 'The simulator adds a tiny shunt conductance so the run can finish; results on this node may be off until it is connected.',
      });
    }
  }

  return issues;
}
