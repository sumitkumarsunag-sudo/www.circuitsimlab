/**
 * Schematic symbol primitives and component-definition types.
 *
 * Symbols are described as small arrays of drawing primitives in a local
 * coordinate frame centred on the component origin (0,0). The editor renders
 * them inside a rotatable/flippable <g>. Keeping symbols as data (not raw SVG
 * strings) lets the same definitions drive the canvas, the palette thumbnails
 * and the static component pages.
 */
import type { Element } from '../engine/types.ts';
import type { PlacedComponent } from '../circuit/types.ts';

export type Prim =
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill?: boolean }
  | { t: 'path'; d: string; fill?: boolean }
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill?: boolean }
  | { t: 'poly'; pts: [number, number][]; fill?: boolean; closed?: boolean }
  | { t: 'text'; x: number; y: number; s: string; size?: number };

export type Category =
  | 'passive'
  | 'sources'
  | 'semiconductor'
  | 'digital'
  | 'output'
  | 'measurement';

export interface Terminal {
  name: string;
  x: number;
  y: number;
}

export type PropType = 'value' | 'text' | 'number' | 'select' | 'boolean';

export interface PropSpec {
  key: string;
  label: string;
  type: PropType;
  unit?: string;
  options?: { value: string; label: string }[];
  /** For 'value' props: the SI unit used when parsing/formatting. */
  siUnit?: string;
  advanced?: boolean;
}

export interface CompileContext {
  /** Resolve a terminal name to its electrical node number. */
  nodeOf: (terminalName: string) => number;
  /** Stable unique id for the generated element(s). */
  id: string;
}

export interface ComponentDef {
  kind: string;
  name: string;
  category: Category;
  /** Short description used on component pages and tooltips. */
  description: string;
  terminals: Terminal[];
  symbol: Prim[];
  /** Bounding box half-extents for hit-testing/selection (px). */
  bbox: { w: number; h: number };
  props: PropSpec[];
  defaults: Record<string, string | number | boolean>;
  /**
   * Convert a placed component into zero or more solver elements.
   * Pure measurement/annotation parts (probes) return [].
   */
  toElements: (comp: PlacedComponent, ctx: CompileContext) => Element[];
  /** Reference-designator prefix, e.g. 'R', 'C', 'D'. */
  ref: string;
}

/** Read a component prop as a number via engineering-notation parsing. */
export function propNum(
  comp: PlacedComponent,
  key: string,
  fallback: number,
  parse: (s: string) => number | null
): number {
  const v = comp.props[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parse(v);
    if (n != null && Number.isFinite(n)) return n;
  }
  return fallback;
}
