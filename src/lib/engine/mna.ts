/**
 * Modified Nodal Analysis (MNA) assembler.
 *
 * Builds the [G  B; C  D]·x = [i; e] system for a netlist. Node 0 is ground and
 * is not represented in the matrix. Voltage-source-like elements (independent
 * voltage sources, inductors in DC, closed ideal switches modelled as 0 V
 * sources) each add one extra "branch current" unknown appended after the node
 * unknowns.
 *
 * The assembler is analysis-agnostic: DC, transient and AC all build on the same
 * stamping primitives.
 */
import type { Element, Netlist } from './types.ts';

export class MNASystem {
  readonly n: number; // number of non-ground nodes
  readonly m: number; // number of extra (branch-current) unknowns
  readonly size: number;
  readonly A: number[][];
  readonly z: number[];
  /** Map element id -> its branch-current row index (absolute matrix index). */
  readonly branchOf: Map<string, number>;

  constructor(n: number, branchIds: string[]) {
    this.n = n;
    this.m = branchIds.length;
    this.size = n + this.m;
    this.A = Array.from({ length: this.size }, () => new Array<number>(this.size).fill(0));
    this.z = new Array<number>(this.size).fill(0);
    this.branchOf = new Map();
    branchIds.forEach((id, k) => this.branchOf.set(id, n + k));
  }

  /** Matrix index for a node (ground -> -1, meaning "skip"). */
  private idx(node: number): number {
    return node === 0 ? -1 : node - 1;
  }

  /** Stamp a conductance `g` between nodes a and b. */
  stampConductance(a: number, b: number, g: number): void {
    const ia = this.idx(a);
    const ib = this.idx(b);
    if (ia >= 0) this.A[ia][ia] += g;
    if (ib >= 0) this.A[ib][ib] += g;
    if (ia >= 0 && ib >= 0) {
      this.A[ia][ib] -= g;
      this.A[ib][ia] -= g;
    }
  }

  /** Inject a current source of `i` amps flowing out of node a into node b. */
  stampCurrent(a: number, b: number, i: number): void {
    const ia = this.idx(a);
    const ib = this.idx(b);
    if (ia >= 0) this.z[ia] -= i;
    if (ib >= 0) this.z[ib] += i;
  }

  /**
   * Stamp a voltage constraint V(a) - V(b) = value onto branch `branchId`.
   * The branch current is defined flowing from a to b through the element.
   */
  stampVoltageSource(a: number, b: number, value: number, branchId: string): void {
    const p = this.branchOf.get(branchId)!;
    const ia = this.idx(a);
    const ib = this.idx(b);
    if (ia >= 0) {
      this.A[ia][p] += 1;
      this.A[p][ia] += 1;
    }
    if (ib >= 0) {
      this.A[ib][p] -= 1;
      this.A[p][ib] -= 1;
    }
    this.z[p] += value;
  }

  /** Add a value directly into the branch row's RHS (companion sources). */
  addToRhs(index: number, value: number): void {
    this.z[index] += value;
  }
}

/** Elements that require an extra branch-current unknown in a given analysis. */
export function branchElements(
  net: Netlist,
  opts: { inductorAsShort?: boolean } = {}
): string[] {
  const ids: string[] = [];
  for (const el of net.elements) {
    if (el.type === 'V' || el.type === 'VPULSE' || el.type === 'VSIN') ids.push(el.id);
    else if (el.type === 'L' && opts.inductorAsShort) ids.push(el.id);
    else if (el.type === 'SW' && el.closed) ids.push(el.id);
  }
  return ids;
}

/** Voltage across an element's two terminals given a node-voltage vector. */
export function elementVoltage(el: Element, v: number[]): number {
  const va = el.nodes[0] === 0 ? 0 : v[el.nodes[0]];
  const vb = el.nodes[1] === 0 ? 0 : v[el.nodes[1]];
  return va - vb;
}
