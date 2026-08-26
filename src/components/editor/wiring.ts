/**
 * Wire-drawing helpers: connection-point snapping, orthogonal routing between
 * anchor points, and voltage → colour mapping for the node heat overlay.
 */
import { GRID } from '../../lib/components/registry.ts';
import type { Circuit } from '../../lib/circuit/types.ts';
import { componentTerminals, snap } from './geometry.ts';

export interface Pt {
  x: number;
  y: number;
}

export function collectConnectionPoints(circuit: Circuit): Pt[] {
  const pts: Pt[] = [];
  for (const c of circuit.components) for (const t of componentTerminals(c)) pts.push({ x: t.x, y: t.y });
  for (const w of circuit.wires) {
    pts.push({ x: w.x1, y: w.y1 });
    pts.push({ x: w.x2, y: w.y2 });
  }
  return pts;
}

/** Snap a world point to the nearest terminal/endpoint, else to the grid. */
export function snapPoint(world: Pt, conns: Pt[], threshold = GRID * 0.6): { pt: Pt; onConnection: boolean } {
  let best: Pt | null = null;
  let bestD = threshold;
  for (const p of conns) {
    const d = Math.hypot(p.x - world.x, p.y - world.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best) return { pt: { x: best.x, y: best.y }, onConnection: true };
  return { pt: { x: snap(world.x), y: snap(world.y) }, onConnection: false };
}

/** Expand a chain of anchor points into orthogonal (H-then-V) segments. */
export function expandOrthogonal(anchors: Pt[]): [Pt, Pt][] {
  const segs: [Pt, Pt][] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (a.x === b.x || a.y === b.y) {
      if (a.x !== b.x || a.y !== b.y) segs.push([a, b]);
    } else {
      const mid = { x: b.x, y: a.y };
      segs.push([a, mid]);
      segs.push([mid, b]);
    }
  }
  return segs;
}

/** Blue (low) → grey (mid) → red (high) heat colour for a node voltage. */
export function voltageColor(v: number, min: number, max: number): string {
  if (max - min < 1e-9) return '#6a7788';
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  // Interpolate neg(blue) → muted → pos(red).
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  if (t < 0.5) {
    const k = t / 0.5;
    return `rgb(${lerp(47, 120, k)},${lerp(111, 128, k)},${lerp(237, 140, k)})`;
  }
  const k = (t - 0.5) / 0.5;
  return `rgb(${lerp(120, 214, k)},${lerp(128, 69, k)},${lerp(140, 69, k)})`;
}
