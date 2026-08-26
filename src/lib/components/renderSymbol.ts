/**
 * Framework-agnostic symbol renderer.
 *
 * Turns a component's `Prim[]` into an SVG-fragment string that can be dropped
 * into either an Astro template (`set:html`) or a React node
 * (`dangerouslySetInnerHTML`). Keeping one renderer guarantees the palette
 * thumbnail, the live canvas and the static component pages draw identically.
 */
import type { Prim } from './primitives.ts';

export interface SymbolStyle {
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  textColor?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderPrim(p: Prim, style: SymbolStyle = {}): string {
  const stroke = style.stroke ?? 'currentColor';
  const sw = style.strokeWidth ?? 2;
  const fillC = style.fill ?? stroke;
  const common = `stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (p.t) {
    case 'line':
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" ${common} />`;
    case 'circle':
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" ${common} fill="${p.fill ? fillC : 'none'}" />`;
    case 'path':
      return `<path d="${esc(p.d)}" ${common} fill="${p.fill ? fillC : 'none'}" />`;
    case 'rect':
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" ${common} fill="${p.fill ? fillC : 'none'}" />`;
    case 'poly': {
      const pts = p.pts.map(([x, y]) => `${x},${y}`).join(' ');
      const tag = p.closed || p.fill ? 'polygon' : 'polyline';
      return `<${tag} points="${pts}" ${common} fill="${p.fill ? fillC : 'none'}" />`;
    }
    case 'text':
      return `<text x="${p.x}" y="${p.y}" font-size="${p.size ?? 11}" text-anchor="middle" dominant-baseline="middle" fill="${style.textColor ?? stroke}" font-family="var(--font-mono, monospace)">${esc(p.s)}</text>`;
  }
}

export function renderSymbolInner(prims: Prim[], style?: SymbolStyle): string {
  return prims.map((p) => renderPrim(p, style)).join('');
}
