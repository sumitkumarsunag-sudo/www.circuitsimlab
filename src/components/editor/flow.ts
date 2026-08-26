/**
 * Derive current-flow animation hints from solved results.
 *
 * Every hint is grounded in a real solved current: a component "flows" when the
 * solver reports current through it, and a wire "flows" when it is in series
 * with such a component (its endpoint coincides with that component's terminal).
 * Direction follows the passive sign convention: current enters terminal[0] and
 * leaves terminal[1] when the reported current is positive.
 */
import { getComponentDef } from '../../lib/components/registry.ts';
import type { Circuit } from '../../lib/circuit/types.ts';
import { componentTerminals } from './geometry.ts';

const FLOW_MIN = 1e-9; // amps below which we don't animate

export interface CompFlow {
  mag: number;
  /** true when conventional current runs terminal[1] → terminal[0]. */
  reverse: boolean;
}

export function componentFlow(current: Map<string, number>): Map<string, CompFlow> {
  const out = new Map<string, CompFlow>();
  for (const [id, i] of current) {
    if (Math.abs(i) > FLOW_MIN) out.set(id, { mag: Math.abs(i), reverse: i < 0 });
  }
  return out;
}

export interface WireFlow {
  mag: number;
  /** true when flow runs (x2,y2) → (x1,y1). */
  reverse: boolean;
}

const k = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;

export function wireFlow(circuit: Circuit, current: Map<string, number>): Map<string, WireFlow> {
  // Map each terminal coordinate to { current, isEntry } for the strongest part.
  const atPoint = new Map<string, { mag: number; awayFromPoint: boolean }>();
  for (const comp of circuit.components) {
    const def = getComponentDef(comp.kind);
    if (!def || def.terminals.length < 2) continue;
    const i = current.get(comp.id);
    if (i === undefined || Math.abs(i) <= FLOW_MIN) continue;
    const terms = componentTerminals(comp);
    // terminal[0] is the current-entry side when i>0 (flows in), terminal[last] is exit.
    terms.forEach((t, idx) => {
      const isFirst = idx === 0;
      // Current leaves the component (flows into the wire) at the exit terminal.
      // Positive i: enters terminal[0], leaves terminal[1] → away at terminal[1].
      const awayFromPoint = i > 0 ? !isFirst : isFirst;
      const key = k(t.x, t.y);
      const prev = atPoint.get(key);
      if (!prev || Math.abs(i) > prev.mag) atPoint.set(key, { mag: Math.abs(i), awayFromPoint });
    });
  }

  const out = new Map<string, WireFlow>();
  for (const w of circuit.wires) {
    const a = atPoint.get(k(w.x1, w.y1));
    const b = atPoint.get(k(w.x2, w.y2));
    let pick: { mag: number; reverse: boolean } | null = null;
    if (a && (!b || a.mag >= b.mag)) {
      // Flow direction relative to (x1,y1): away → p1→p2 (forward, reverse=false).
      pick = { mag: a.mag, reverse: !a.awayFromPoint };
    } else if (b) {
      // At (x2,y2): away → p2→p1 (reverse=true).
      pick = { mag: b.mag, reverse: b.awayFromPoint };
    }
    if (pick) out.set(w.id, pick);
  }
  return out;
}
