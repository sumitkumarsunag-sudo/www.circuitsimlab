import React, { useMemo, useRef, useState, useCallback } from 'react';
import type { Circuit, PlacedComponent } from '../../lib/circuit/types.ts';
import { getComponentDef, GRID } from '../../lib/components/registry.ts';
import { SymbolView } from './SymbolView.tsx';
import {
  componentBox, componentTerminals, pointInBox, boxesIntersect, distToSegment,
  screenToWorld, uid, type Viewport, type Box,
} from './geometry.ts';
import { collectConnectionPoints, expandOrthogonal, snapPoint, voltageColor, type Pt } from './wiring.ts';
import { componentFlow, wireFlow } from './flow.ts';
import type { Overlay } from './sim.ts';
import type { EditorSelection, Tool } from './types.ts';
import { formatValue } from '../../lib/units.ts';

export interface CanvasProps {
  circuit: Circuit;
  selection: EditorSelection;
  viewport: Viewport;
  tool: Tool;
  gridVisible: boolean;
  overlay: Overlay | null;
  nodeVoltageAt: Map<number, number> | null;
  wireNodeMap: Map<string, number> | null;
  nodeMap: Map<string, Map<string, number>> | null;
  running: boolean;
  animating: boolean;
  onViewport: (vp: Viewport) => void;
  onSelection: (sel: EditorSelection) => void;
  onCommit: (updater: (c: Circuit) => Circuit, coalesce?: boolean) => void;
  onEndCoalesce: () => void;
  onPlaced: () => void;
  onToolChange: (t: Tool) => void;
}

export function Canvas(props: CanvasProps) {
  const {
    circuit, selection, viewport, tool, gridVisible, overlay, nodeVoltageAt,
    wireNodeMap, nodeMap, running, animating, onViewport, onSelection, onCommit, onEndCoalesce, onPlaced, onToolChange,
  } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [draft, setDraft] = useState<Pt[] | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [dropHint, setDropHint] = useState(false);
  const drag = useRef<{ mode: 'move' | 'pan' | 'marquee'; start: Pt; last: Pt; moved: boolean } | null>(null);
  // Multi-touch: track active pointers so two fingers can pinch-zoom / pan.
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ startDist: number; startCenter: Pt; startVp: Viewport } | null>(null);
  const gestureLock = useRef(false);

  const localPt = useCallback((clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  const conns = useMemo(() => collectConnectionPoints(circuit), [circuit]);
  const compFlows = useMemo(() => (running && overlay ? componentFlow(overlay.current) : new Map()), [running, overlay]);
  const wFlows = useMemo(() => (running && overlay ? wireFlow(circuit, overlay.current) : new Map()), [running, overlay, circuit]);

  const vScale = useMemo(() => {
    if (!nodeVoltageAt) return null;
    let min = Infinity, max = -Infinity;
    for (const v of nodeVoltageAt.values()) { min = Math.min(min, v); max = Math.max(max, v); }
    if (!isFinite(min)) return null;
    return { min, max };
  }, [nodeVoltageAt]);

  const toWorld = useCallback((clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return screenToWorld(clientX - r.left, clientY - r.top, viewport);
  }, [viewport]);

  const selectedSet = useMemo(() => new Set(selection.components), [selection.components]);

  const wireColor = useCallback((wid: string): string => {
    if (running && vScale && wireNodeMap) {
      const node = wireNodeMap.get(wid);
      if (node !== undefined) {
        const v = nodeVoltageAt!.get(node);
        if (v !== undefined) return voltageColor(v, vScale.min, vScale.max);
      }
    }
    return 'var(--color-ink)';
  }, [running, vScale, wireNodeMap, nodeVoltageAt]);

  // ---- Placing a new component --------------------------------------------
  const placeComponent = useCallback((kind: string, at: Pt) => {
    const def = getComponentDef(kind);
    if (!def) return;
    const snapped = snapPoint(at, [], GRID).pt;
    const comp: PlacedComponent = {
      id: uid(def.ref.toLowerCase() + '_'),
      kind, x: snapped.x, y: snapped.y, rotation: 0, flip: false,
      props: { ...def.defaults },
    };
    onCommit((c) => ({ ...c, components: [...c.components, comp] }));
    onSelection({ components: [comp.id], wires: [] });
  }, [onCommit, onSelection]);

  // ---- Hit testing ---------------------------------------------------------
  // `pad` (world units) is widened for touch input so small parts/pins are
  // comfortably tappable with a fingertip.
  const hitComponent = useCallback((w: Pt, pad = 8): string | null => {
    for (let i = circuit.components.length - 1; i >= 0; i--) {
      const c = circuit.components[i];
      if (pointInBox(w.x, w.y, componentBox(c, pad))) return c.id;
    }
    return null;
  }, [circuit.components]);

  const hitWire = useCallback((w: Pt, extra = 0): string | null => {
    const tol = (6 + extra) / viewport.scale;
    for (let i = circuit.wires.length - 1; i >= 0; i--) {
      const wire = circuit.wires[i];
      if (distToSegment(w.x, w.y, wire.x1, wire.y1, wire.x2, wire.y2) <= tol) return wire.id;
    }
    return null;
  }, [circuit.wires, viewport.scale]);

  // ---- Wire tool -----------------------------------------------------------
  const finishWire = useCallback((anchors: Pt[]) => {
    const segs = expandOrthogonal(anchors);
    if (segs.length) {
      onCommit((c) => ({
        ...c,
        wires: [...c.wires, ...segs.map(([a, b]) => ({ id: uid('w_'), x1: a.x, y1: a.y, x2: b.x, y2: b.y }))],
      }));
    }
    setDraft(null);
  }, [onCommit]);

  const onCanvasClick = useCallback((w: Pt, onConn: boolean, snapped: Pt) => {
    if (tool.type === 'place') {
      placeComponent(tool.kind, w);
      onPlaced();
      return;
    }
    if (tool.type === 'wire') {
      if (!draft) {
        setDraft([snapped]);
      } else {
        const last = draft[draft.length - 1];
        if (last && last.x === snapped.x && last.y === snapped.y) {
          if (draft.length <= 1) {
            setDraft(null);
            return;
          }
          finishWire(draft);
          return;
        }
        const anchors = [...draft, snapped];
        // Finish when clicking on an existing connection point (terminal/endpoint).
        if (onConn && anchors.length >= 2) finishWire(anchors);
        else setDraft(anchors);
      }
    }
  }, [tool, draft, placeComponent, onPlaced, finishWire]);

  // ---- Pointer handlers ----------------------------------------------------
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, localPt(e.clientX, e.clientY));
    if (gestureLock.current) return;
    // Second finger lands → switch to a pinch-zoom / two-finger-pan gesture.
    if (pointers.current.size === 2) {
      drag.current = null;
      setMarquee(null);
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        startVp: viewport,
      };
      return;
    }
    // Right-click: cancel active wire draft or reset tool to select
    if (e.button === 2) {
      if (draft) {
        setDraft(null);
        return;
      }
      if (tool.type !== 'select') {
        onToolChange({ type: 'select' });
        return;
      }
    }
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 2 && tool.type === 'select' && !draft)) {
      drag.current = { mode: 'pan', start: { x: e.clientX, y: e.clientY }, last: { x: e.clientX, y: e.clientY }, moved: false };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const w = toWorld(e.clientX, e.clientY);
    const { pt: snapped, onConnection } = snapPoint(w, conns, touch ? GRID : GRID * 0.6);

    if (tool.type === 'wire' || tool.type === 'place') {
      onCanvasClick(w, onConnection, snapped);
      return;
    }

    // Select tool. Widen hit areas for finger taps.
    const hitC = hitComponent(w, touch ? 14 : 8);
    if (hitC) {
      let comps = selection.components;
      if (e.shiftKey) comps = selectedSet.has(hitC) ? comps.filter((id) => id !== hitC) : [...comps, hitC];
      else if (!selectedSet.has(hitC)) comps = [hitC];
      onSelection({ components: comps, wires: [] });
      drag.current = { mode: 'move', start: w, last: w, moved: false };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    const hitW = hitWire(w, touch ? 8 : 0);
    if (hitW) {
      onSelection({ components: [], wires: e.shiftKey ? [...selection.wires, hitW] : [hitW] });
      return;
    }
    // Empty space → marquee.
    if (!e.shiftKey) onSelection({ components: [], wires: [] });
    drag.current = { mode: 'marquee', start: w, last: w, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [toWorld, conns, tool, onCanvasClick, hitComponent, hitWire, selection, selectedSet, onSelection, viewport, localPt]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, localPt(e.clientX, e.clientY));
    // Pinch-zoom / two-finger pan: keep the world point under the gesture's
    // initial midpoint anchored to the current midpoint.
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s0 = pinch.current.startVp;
      const scale = Math.max(0.2, Math.min(4, s0.scale * (dist / pinch.current.startDist)));
      const wx = (pinch.current.startCenter.x - s0.panX) / s0.scale;
      const wy = (pinch.current.startCenter.y - s0.panY) / s0.scale;
      onViewport({ scale, panX: center.x - wx * scale, panY: center.y - wy * scale });
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    if (tool.type === 'wire' && draft) {
      const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      setCursor(snapPoint(w, conns, touch ? GRID : GRID * 0.6).pt);
    }
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    if (d.mode === 'pan') {
      const dx = e.clientX - d.last.x;
      const dy = e.clientY - d.last.y;
      d.last = { x: e.clientX, y: e.clientY };
      onViewport({ ...viewport, panX: viewport.panX + dx, panY: viewport.panY + dy });
    } else if (d.mode === 'move') {
      const dx = Math.round((w.x - d.last.x) / GRID) * GRID;
      const dy = Math.round((w.y - d.last.y) / GRID) * GRID;
      if (dx || dy) {
        d.last = { x: d.last.x + dx, y: d.last.y + dy };
        const ids = selectedSet;
        onCommit((c) => ({
          ...c,
          components: c.components.map((comp) => ids.has(comp.id) ? { ...comp, x: comp.x + dx, y: comp.y + dy } : comp),
        }), true);
      }
    } else if (d.mode === 'marquee') {
      setMarquee({ x: Math.min(d.start.x, w.x), y: Math.min(d.start.y, w.y), w: Math.abs(w.x - d.start.x), h: Math.abs(w.y - d.start.y) });
    }
  }, [toWorld, tool, draft, conns, viewport, onViewport, onCommit, selectedSet, localPt]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gestureLock.current = false;
    // End the pinch when fewer than two fingers remain; ignore stray
    // interactions from any still-held finger until all are lifted.
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null;
        gestureLock.current = pointers.current.size > 0;
      }
      return;
    }
    const d = drag.current;
    if (d?.mode === 'marquee' && marquee) {
      const hit = circuit.components.filter((c) => boxesIntersect(componentBox(c, 0), marquee)).map((c) => c.id);
      const whit = circuit.wires.filter((wr) =>
        marquee && wr.x1 >= marquee.x && wr.x1 <= marquee.x + marquee.w && wr.y1 >= marquee.y && wr.y1 <= marquee.y + marquee.h
      ).map((wr) => wr.id);
      onSelection({ components: hit, wires: whit });
    }
    if (d?.mode === 'move' && d.moved) onEndCoalesce();
    drag.current = null;
    setMarquee(null);
  }, [marquee, circuit.components, circuit.wires, onSelection, onEndCoalesce]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gestureLock.current = false;
    if (pinch.current && pointers.current.size < 2) pinch.current = null;
    drag.current = null;
    setMarquee(null);
  }, []);

  const onDoubleClick = useCallback(() => {
    if (tool.type === 'wire') {
      if (draft && draft.length >= 2) finishWire(draft);
      else setDraft(null);
    }
  }, [tool, draft, finishWire]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const scale = Math.max(0.2, Math.min(4, viewport.scale * factor));
    const k = scale / viewport.scale;
    onViewport({ scale, panX: mx - (mx - viewport.panX) * k, panY: my - (my - viewport.panY) * k });
  }, [viewport, onViewport]);

  // ---- Drag-and-drop from the palette (desktop pointer) -------------------
  const hasKind = (dt: DataTransfer) => Array.from(dt.types).includes('application/x-cs-kind');

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasKind(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dropHint) setDropHint(true);
  }, [dropHint]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when the pointer actually leaves the canvas, not a child node.
    if (e.currentTarget === e.target) setDropHint(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    setDropHint(false);
    const kind = e.dataTransfer.getData('application/x-cs-kind') || e.dataTransfer.getData('text/plain');
    if (!kind || !getComponentDef(kind)) return;
    e.preventDefault();
    placeComponent(kind, toWorld(e.clientX, e.clientY));
  }, [placeComponent, toWorld]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (draft) {
          setDraft(null);
        } else if (tool.type !== 'select') {
          onToolChange({ type: 'select' });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, tool.type, onToolChange]);

  // One representative point per node for voltage labels.
  const nodePoints = useMemo(() => {
    const m = new Map<number, Pt>();
    if (!nodeMap) return m;
    for (const comp of circuit.components) {
      const terms = nodeMap.get(comp.id);
      if (!terms) continue;
      for (const at of componentTerminals(comp)) {
        const node = terms.get(at.name);
        if (node !== undefined && node !== 0 && !m.has(node)) m.set(node, { x: at.x, y: at.y });
      }
    }
    return m;
  }, [nodeMap, circuit.components]);

  const step = GRID * viewport.scale;
  const t = `translate(${viewport.panX} ${viewport.panY}) scale(${viewport.scale})`;
  const draftPreview = draft && cursor ? expandOrthogonal([...draft, cursor]) : [];
  const cursorStyle = tool.type === 'place' || tool.type === 'wire' ? 'crosshair' : drag.current?.mode === 'pan' ? 'grabbing' : 'default';

  return (
    <svg
      ref={svgRef}
      className="h-full w-full touch-none select-none"
      style={{ cursor: cursorStyle, background: 'var(--color-paper)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={(e) => e.preventDefault()}
      role="application"
      aria-label="Schematic canvas"
    >
      {gridVisible && (
        <>
          <defs>
            <pattern id="cs-grid" x={0} y={0} width={step} height={step} patternUnits="userSpaceOnUse"
              patternTransform={`translate(${viewport.panX % step} ${viewport.panY % step})`}>
              <circle cx={0} cy={0} r={1} fill="var(--color-line-strong)" />
            </pattern>
          </defs>
          <rect x={0} y={0} width="100%" height="100%" fill="url(#cs-grid)" />
        </>
      )}

      <g transform={t}>
        {/* Wires */}
        {circuit.wires.map((wire) => {
          const sel = selection.wires.includes(wire.id);
          const wf = wFlows.get(wire.id);
          return (
            <g key={wire.id}>
              <line x1={wire.x1} y1={wire.y1} x2={wire.x2} y2={wire.y2}
                stroke={sel ? 'var(--color-accent)' : wireColor(wire.id)} strokeWidth={sel ? 3 : 2} strokeLinecap="round" />
              {running && animating && wf && (
                <line x1={wire.x1} y1={wire.y1} x2={wire.x2} y2={wire.y2}
                  className={`flow${wf.reverse ? ' flow-rev' : ''}`} stroke="var(--color-signal)" strokeWidth={2.5} strokeLinecap="round" pointerEvents="none" />
              )}
            </g>
          );
        })}

        {/* Junction dots where 3+ wires meet handled implicitly by terminals; draw wire endpoints as small nodes */}

        {/* Components */}
        {circuit.components.map((comp) => {
          const def = getComponentDef(comp.kind);
          if (!def) return null;
          const sel = selectedSet.has(comp.id);
          const box = componentBox(comp, 4);
          const terms = componentTerminals(comp);
          const flow = compFlows.get(comp.id);
          const energized = running && flow;
          const cur = overlay?.current.get(comp.id);
          return (
            <g key={comp.id}>
              {sel && <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="var(--color-accent-soft)" stroke="var(--color-accent)" strokeWidth={1} rx={3} opacity={0.6} />}
              <g transform={`translate(${comp.x} ${comp.y}) rotate(${comp.rotation}) scale(${comp.flip ? -1 : 1} 1)`}>
                <SymbolView symbol={def.symbol} stroke={sel ? 'var(--color-accent)' : energized ? 'var(--color-ink)' : 'var(--color-ink)'} strokeWidth={2} />
              </g>
              {/* current-flow along the device axis */}
              {running && animating && flow && terms.length >= 2 && (
                <line x1={terms[0].x} y1={terms[0].y} x2={terms[terms.length - 1].x} y2={terms[terms.length - 1].y}
                  className={`flow${flow.reverse ? ' flow-rev' : ''}`} stroke="var(--color-signal)" strokeWidth={2.5} strokeLinecap="round" pointerEvents="none" />
              )}
              {/* terminal dots */}
              {terms.map((tm) => (
                <circle key={tm.name} cx={tm.x} cy={tm.y} r={2.5}
                  fill={running && vScale && nodeMap ? voltageColor(nodeVoltageAt!.get(nodeMap.get(comp.id)?.get(tm.name) ?? -1) ?? 0, vScale.min, vScale.max) : 'var(--color-line-strong)'} />
              ))}
              {/* label + value */}
              <text x={comp.x} y={box.y - 4} textAnchor="middle" fontSize={10} fill="var(--color-muted)" className="tnum" style={{ pointerEvents: 'none' }}>
                {String(comp.props.label ?? def.ref)}
                {primaryValue(comp) ? ` · ${primaryValue(comp)}` : ''}
              </text>
              {running && cur !== undefined && Math.abs(cur) > 1e-12 && (
                <text x={comp.x} y={box.y + box.h + 12} textAnchor="middle" fontSize={10} fill="var(--color-signal)" className="tnum" style={{ pointerEvents: 'none' }}>
                  {formatValue(Math.abs(cur), 'A')}
                </text>
              )}
            </g>
          );
        })}

        {/* Node voltage labels */}
        {running && vScale && [...nodePoints].map(([node, p]) => {
          const v = nodeVoltageAt!.get(node);
          if (v === undefined) return null;
          return (
            <text key={node} x={p.x + 6} y={p.y - 6} fontSize={10} className="tnum" fill="var(--color-pos)" style={{ pointerEvents: 'none' }}>
              {formatValue(v, 'V')}
            </text>
          );
        })}

        {/* Draft wire preview */}
        {draftPreview.map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
        ))}
        {draft && draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-accent)" />)}
        {cursor && tool.type === 'wire' && <circle cx={cursor.x} cy={cursor.y} r={3} fill="var(--color-accent)" />}
      </g>

      {/* Marquee (screen space via world transform already applied) */}
      {marquee && (
        <g transform={t}>
          <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="var(--color-accent)" opacity={0.08} stroke="var(--color-accent)" strokeDasharray="4 3" strokeWidth={1 / viewport.scale} />
        </g>
      )}
      {/* Drop-target highlight while dragging a part from the palette. */}
      {dropHint && (
        <rect x={1.5} y={1.5} width="calc(100% - 3px)" height="calc(100% - 3px)"
          fill="var(--color-accent)" fillOpacity={0.04} stroke="var(--color-accent)"
          strokeWidth={2} strokeDasharray="6 4" rx={4} pointerEvents="none" />
      )}
    </svg>
  );
}

/** The most meaningful single value to show under a symbol. */
function primaryValue(comp: PlacedComponent): string | null {
  const def = getComponentDef(comp.kind);
  if (!def) return null;
  const spec = def.props.find((p) => p.type === 'value' && p.key !== 'ic');
  if (!spec) return null;
  const raw = comp.props[spec.key];
  if (raw === undefined || raw === '' || raw === null) return null;
  return `${raw}${spec.unit ?? ''}`;
}
