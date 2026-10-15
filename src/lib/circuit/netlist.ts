/**
 * Netlist compiler: turns the geometric editor circuit into an electrical
 * netlist for the solver.
 *
 * Connectivity is resolved with a union-find over connection points. Two pins at
 * the same coordinate are connected; a wire connects its two endpoints; and a
 * pin lying on the interior of a wire forms a T-junction. The ground component
 * pins the reference node (0). When no ground is placed the compiler elects the
 * best-connected net as an implicit reference so the circuit can still solve —
 * only the absolute readings shift, every voltage difference stays exact.
 */
import { REGISTRY } from '../components/registry.ts';
import type { CompileContext } from '../components/primitives.ts';
import type { Circuit, PlacedComponent } from './types.ts';
import { terminalPosition } from './types.ts';
import type { Element, Netlist } from '../engine/types.ts';

const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;

class UnionFind {
  private parent = new Map<string, string>();
  find(a: string): string {
    let root = a;
    while (this.parent.get(root) !== undefined && this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression.
    let cur = a;
    while (this.parent.get(cur) !== undefined && this.parent.get(cur) !== cur) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  add(a: string) {
    if (!this.parent.has(a)) this.parent.set(a, a);
  }
  union(a: string, b: string) {
    this.add(a);
    this.add(b);
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  has(a: string) {
    return this.parent.has(a);
  }
}

/** Is point q on the interior of segment p1→p2 (collinear, strictly between)? */
function onSegment(qx: number, qy: number, x1: number, y1: number, x2: number, y2: number): boolean {
  const cross = (qx - x1) * (y2 - y1) - (qy - y1) * (x2 - x1);
  if (Math.abs(cross) > 0.5) return false;
  const dot = (qx - x1) * (x2 - x1) + (qy - y1) * (y2 - y1);
  const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  return dot > 0.5 && dot < len2 - 0.5;
}

export interface CompiledCircuit {
  netlist: Netlist;
  /** compId -> (terminalName -> node number). */
  nodeMap: Map<string, Map<string, number>>;
  /** wire id -> node number. */
  wireNode: Map<string, number>;
  /** node number -> list of coordinate keys on that net. */
  netCoords: Map<number, string[]>;
  groundNode: number;
  /** True when no Ground component was placed and a net was elected as 0 V. */
  implicitGround: boolean;
}

export function compileNetlist(circuit: Circuit): CompiledCircuit {
  const uf = new UnionFind();

  // 1. Register all connection coordinates.
  const termCoords: { comp: PlacedComponent; term: string; x: number; y: number }[] = [];
  for (const comp of circuit.components) {
    const def = REGISTRY[comp.kind];
    if (!def) continue;
    for (const t of def.terminals) {
      const p = terminalPosition(comp, { x: t.x, y: t.y });
      uf.add(key(p.x, p.y));
      termCoords.push({ comp, term: t.name, x: p.x, y: p.y });
    }
  }
  for (const w of circuit.wires) {
    uf.union(key(w.x1, w.y1), key(w.x2, w.y2));
  }

  // 2. T-junctions: any registered coordinate lying on a wire interior joins it.
  const coords = new Set<string>();
  for (const tc of termCoords) coords.add(key(tc.x, tc.y));
  for (const w of circuit.wires) {
    coords.add(key(w.x1, w.y1));
    coords.add(key(w.x2, w.y2));
  }
  for (const ck of coords) {
    const [cx, cy] = ck.split(',').map(Number);
    for (const w of circuit.wires) {
      if (onSegment(cx, cy, w.x1, w.y1, w.x2, w.y2)) {
        uf.union(ck, key(w.x1, w.y1));
      }
    }
  }

  // 3. Identify ground net root(s).
  const groundRoots = new Set<string>();
  for (const tc of termCoords) {
    if (tc.comp.kind === 'ground') groundRoots.add(uf.find(key(tc.x, tc.y)));
  }

  // 3b. No Ground symbol placed? Elect the best-connected net (most terminals,
  // first-seen wins ties) as the 0 V reference instead. Simulation then runs as
  // normal and the UI simply notes that the reference was chosen automatically.
  let implicitGround = false;
  if (groundRoots.size === 0 && termCoords.length > 0) {
    const weight = new Map<string, number>();
    for (const tc of termCoords) {
      const r = uf.find(key(tc.x, tc.y));
      weight.set(r, (weight.get(r) ?? 0) + 1);
    }
    let best = '';
    let bestWeight = -1;
    for (const tc of termCoords) {
      const r = uf.find(key(tc.x, tc.y));
      const w = weight.get(r)!;
      if (w > bestWeight) { best = r; bestWeight = w; }
    }
    groundRoots.add(best);
    implicitGround = true;
  }

  // 4. Assign node numbers (ground = 0).
  const rootToNode = new Map<string, number>();
  for (const r of groundRoots) rootToNode.set(r, 0);
  let next = 1;
  const nodeForRoot = (root: string): number => {
    if (!rootToNode.has(root)) rootToNode.set(root, next++);
    return rootToNode.get(root)!;
  };

  const netCoords = new Map<number, string[]>();
  for (const ck of coords) {
    const node = groundRoots.has(uf.find(ck)) ? 0 : nodeForRoot(uf.find(ck));
    (netCoords.get(node) ?? netCoords.set(node, []).get(node)!).push(ck);
  }

  // 5. Build element list.
  const nodeMap = new Map<string, Map<string, number>>();
  const elements: Element[] = [];
  for (const comp of circuit.components) {
    const def = REGISTRY[comp.kind];
    if (!def) continue;
    const termToNode = new Map<string, number>();
    for (const t of def.terminals) {
      const p = terminalPosition(comp, { x: t.x, y: t.y });
      const root = uf.find(key(p.x, p.y));
      const node = groundRoots.has(root) ? 0 : nodeForRoot(root);
      termToNode.set(t.name, node);
    }
    nodeMap.set(comp.id, termToNode);
    const ctx: CompileContext = {
      id: comp.id,
      nodeOf: (name) => termToNode.get(name) ?? 0,
    };
    elements.push(...def.toElements(comp, ctx));
  }

  const wireNode = new Map<string, number>();
  for (const w of circuit.wires) {
    const root = uf.find(key(w.x1, w.y1));
    wireNode.set(w.id, groundRoots.has(root) ? 0 : nodeForRoot(root));
  }

  const netlist: Netlist = { nodeCount: next, elements };
  return {
    netlist,
    nodeMap,
    wireNode,
    netCoords,
    groundNode: groundRoots.size ? 0 : -1,
    implicitGround,
  };
}
