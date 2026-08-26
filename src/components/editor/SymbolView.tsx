import React from 'react';
import { renderSymbolInner } from '../../lib/components/renderSymbol.ts';
import type { Prim } from '../../lib/components/primitives.ts';

/** Renders a component symbol (array of primitives) as an inline SVG group. */
export function SymbolView({
  symbol,
  stroke,
  strokeWidth = 2,
}: {
  symbol: Prim[];
  stroke?: string;
  strokeWidth?: number;
}) {
  const html = renderSymbolInner(symbol, { stroke, strokeWidth });
  return <g dangerouslySetInnerHTML={{ __html: html }} />;
}
