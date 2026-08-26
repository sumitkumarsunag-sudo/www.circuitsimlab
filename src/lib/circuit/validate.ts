/**
 * Pre-simulation validation.
 *
 * Produces friendly, actionable diagnostics before the solver runs so users see
 * "Node N is floating" rather than a raw singular-matrix failure. Each issue
 * carries a plain-language message plus an optional technical detail for the
 * "Technical details" disclosure.
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

export function validate(circuit: Circuit, compiled: CompiledCircuit): Issue[] {
  const issues: Issue[] = [];

  if (circuit.components.length === 0) {
    return [{ severity: 'warning', message: 'The canvas is empty. Add components and wire them up to simulate.' }];
  }

  // Ground reference.
  const hasGround = circuit.components.some((c) => c.kind === 'ground');
  if (!hasGround) {
    issues.push({
      severity: 'error',
      message: 'No ground reference. Add a Ground component so voltages have a 0 V reference.',
      detail: 'Modified nodal analysis measures every node voltage relative to ground (node 0).',
    });
  }

  // Unconnected terminals: a node touched by exactly one terminal and no wire.
  const nodeTermCount = new Map<number, number>();
  for (const [, terms] of compiled.nodeMap) {
    for (const node of terms.values()) nodeTermCount.set(node, (nodeTermCount.get(node) ?? 0) + 1);
  }
  const wireNodes = new Set(compiled.wireNode.values());
  for (const comp of circuit.components) {
    const def = REGISTRY[comp.kind];
    if (!def) continue;
    const terms = compiled.nodeMap.get(comp.id);
    if (!terms) continue;
    for (const [tname, node] of terms) {
      const count = nodeTermCount.get(node) ?? 0;
      if (count <= 1 && !wireNodes.has(node) && node !== 0) {
        const label = comp.props.label ? String(comp.props.label) : def.name;
        issues.push({
          severity: 'warning',
          message: `${label}: terminal “${tname}” is not connected to anything.`,
          refs: [comp.id],
        });
      }
    }
  }

  // Floating nodes: no DC path to ground.
  if (hasGround) {
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
    const allNodes = new Set<number>();
    for (const terms of compiled.nodeMap.values()) for (const n of terms.values()) allNodes.add(n);
    for (const n of allNodes) {
      if (n !== 0 && !seen.has(n)) {
        issues.push({
          severity: 'error',
          message: `Node ${n} is floating. Connect it to ground or another part of the circuit through a resistor or wire.`,
          detail: 'A node with no DC path to ground makes the nodal-analysis matrix singular.',
        });
      }
    }
  }

  return issues;
}
