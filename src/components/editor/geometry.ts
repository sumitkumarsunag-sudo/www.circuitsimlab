/**
 * Editor geometry helpers: grid snapping, world/screen transforms, terminal and
 * bounding-box computation for placed components, and hit-testing. All in the
 * schematic's world coordinate space (pixels at 1× zoom); the viewport applies
 * pan/scale on top.
 */
import { GRID } from '../../lib/components/registry.ts';
import { getComponentDef } from '../../lib/components/registry.ts';
import { terminalPosition } from '../../lib/circuit/types.ts';
import type { PlacedComponent, Rotation } from '../../lib/circuit/types.ts';

export interface Viewport {
  panX: number;
  panY: number;
  scale: number;
}

export const snap = (v: number, grid = GRID) => Math.round(v / grid) * grid;

export function worldToScreen(x: number, y: number, vp: Viewport) {
  return { x: x * vp.scale + vp.panX, y: y * vp.scale + vp.panY };
}
export function screenToWorld(x: number, y: number, vp: Viewport) {
  return { x: (x - vp.panX) / vp.scale, y: (y - vp.panY) / vp.scale };
}

export interface AbsTerminal {
  name: string;
  x: number;
  y: number;
}

export function componentTerminals(comp: PlacedComponent): AbsTerminal[] {
  const def = getComponentDef(comp.kind);
  if (!def) return [];
  return def.terminals.map((t) => {
    const p = terminalPosition(comp, { x: t.x, y: t.y });
    return { name: t.name, x: p.x, y: p.y };
  });
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned world-space bounding box for a placed component. */
export function componentBox(comp: PlacedComponent, pad = 8): Box {
  const def = getComponentDef(comp.kind);
  const hw = def ? def.bbox.w : 20;
  const hh = def ? def.bbox.h : 20;
  const rot = comp.rotation;
  const [ew, eh] = rot === 90 || rot === 270 ? [hh, hw] : [hw, hh];
  // Also include terminals so thin parts stay clickable.
  const terms = componentTerminals(comp);
  let minX = comp.x - ew;
  let maxX = comp.x + ew;
  let minY = comp.y - eh;
  let maxY = comp.y + eh;
  for (const t of terms) {
    minX = Math.min(minX, t.x);
    maxX = Math.max(maxX, t.x);
    minY = Math.min(minY, t.y);
    maxY = Math.max(maxY, t.y);
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

export function pointInBox(px: number, py: number, b: Box): boolean {
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/** Distance from point to a line segment (world units). */
export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export const nextRotation = (r: Rotation, dir: 1 | -1 = 1): Rotation =>
  (((r + dir * 90 + 360) % 360) as Rotation);

let counter = 0;
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}
