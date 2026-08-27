import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette } from './Palette.tsx';
import { Toolbar } from './Toolbar.tsx';
import { PropertiesPanel } from './PropertiesPanel.tsx';
import { Canvas } from './Canvas.tsx';
import { Diagnostics } from './Diagnostics.tsx';
import { Scope } from './Scope.tsx';
import { useHistory } from './useHistory.ts';
import { emptySelection, type EditorSelection, type Tool } from './types.ts';
import type { Viewport } from './geometry.ts';
import { componentBox, nextRotation, uid, screenToWorld } from './geometry.ts';
import { getComponentDef, GRID } from '../../lib/components/registry.ts';
import { snapPoint } from './wiring.ts';
import { runSimulation, hasDynamics, type RunResult, type SimMode } from './sim.ts';
import { emptyCircuit, type Circuit, type PlacedComponent } from '../../lib/circuit/types.ts';
import { encodeShare, decodeShare, serializeCircuit } from '../../lib/circuit/serialize.ts';
import { saveProject, newProject } from '../../lib/circuit/storage.ts';
import { disposeSimClient } from '../../lib/engine/simClient.ts';
import { exportAsPNG, exportAsSVG, exportAsPDF, exportAsDOCX, exportAsJSON } from './exportUtils.ts';
import type { ExportFormat } from './ExportMenu.tsx';

export interface SchematicEditorProps {
  initialCircuit?: Circuit;
  initialName?: string;
  projectId?: string;
  readOnly?: boolean;
}

export default function SchematicEditor(props: SchematicEditorProps) {
  const { circuit, canUndo, canRedo, commit, endCoalesce, undo, redo, reset } = useHistory(
    props.initialCircuit ?? emptyCircuit()
  );
  const [name, setName] = useState(props.initialName ?? 'Untitled circuit');
  const [projectId, setProjectId] = useState<string | null>(props.projectId ?? null);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<EditorSelection>(emptySelection());
  const [viewport, setViewport] = useState<Viewport>({ panX: 320, panY: 220, scale: 1 });
  const [tool, setTool] = useState<Tool>({ type: 'select' });
  const [gridVisible, setGridVisible] = useState(true);
  // On phones the palette starts collapsed so the canvas gets the space.
  const [paletteCollapsed, setPaletteCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const [mode, setMode] = useState<SimMode>('dc');
  const [run, setRun] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [frame, setFrame] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [showScope, setShowScope] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clipboard = useRef<PlacedComponent[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const markDirty = useCallback(() => setDirty(true), []);
  const commitDirty = useCallback((u: (c: Circuit) => Circuit, coalesce?: boolean) => { commit(u, coalesce); markDirty(); }, [commit, markDirty]);

  // Load a shared circuit from the URL fragment (#c=...) on mount.
  useEffect(() => {
    if (props.initialCircuit) return;
    const hash = typeof location !== 'undefined' ? location.hash : '';
    const m = hash.match(/[#&]c=([^&]+)/);
    if (m) {
      try {
        reset(decodeShare(decodeURIComponent(m[1])));
        setName('Shared circuit');
      } catch { /* ignore malformed */ }
    }
    return () => disposeSimClient();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // Track narrow viewports (phones) to adapt panel behaviour.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Derived: node voltages for the current display frame.
  const nodeVoltageAt = useMemo(() => {
    if (!run?.ok || !running) return null;
    if (mode === 'transient' && run.transient && frame >= 0) {
      const pts = run.transient.points;
      const pt = pts[Math.min(frame, pts.length - 1)];
      const m = new Map<number, number>();
      pt?.nodeVoltages.forEach((v, n) => m.set(n, v));
      return m;
    }
    return run.overlay?.nodeVoltage ?? null;
  }, [run, running, mode, frame]);

  const selectedComponent = useMemo(() => {
    if (selection.components.length !== 1) return null;
    return circuit.components.find((c) => c.id === selection.components[0]) ?? null;
  }, [selection.components, circuit.components]);

  // Transient playback loop.
  useEffect(() => {
    if (!running || !animating || mode !== 'transient' || !run?.transient) return;
    const total = run.transient.points.length;
    if (total === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last > 33) {
        last = now;
        setFrame((f) => (f + Math.max(1, Math.round(total / 120))) % total);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, animating, mode, run]);

  // ---- Simulation control --------------------------------------------------
  const doRun = useCallback(async () => {
    setError(null);
    setRunning(true);
    setAnimating(true);
    const useMode: SimMode = mode === 'transient' || hasDynamics(circuit) ? mode : 'dc';
    const result = await runSimulation(circuit, useMode);
    setRun(result);
    setFrame(useMode === 'transient' ? 0 : -1);
    if (!result.ok) {
      setError(result.error ?? 'Simulation failed.');
      setAnimating(false);
      if (!result.issues.some((i) => i.severity === 'error')) setRunning(false);
      else setRunning(false);
    } else if (useMode === 'transient') {
      setShowScope((s) => s || circuit.components.some((c) => c.kind === 'voltage_probe' || c.kind === 'current_probe'));
    }
  }, [circuit, mode]);

  const doStop = useCallback(() => {
    setRunning(false);
    setAnimating(false);
    setFrame(-1);
  }, []);
  const doPause = useCallback(() => setAnimating((a) => !a), []);

  // ---- Component editing ---------------------------------------------------
  const changeProp = useCallback((key: string, value: string | number | boolean) => {
    if (!selectedComponent) return;
    const id = selectedComponent.id;
    commitDirty((c) => ({
      ...c,
      components: c.components.map((comp) => comp.id === id ? { ...comp, props: { ...comp.props, [key]: value } } : comp),
    }));
  }, [selectedComponent, commitDirty]);

  const transformSelected = useCallback((fn: (c: PlacedComponent) => PlacedComponent) => {
    const ids = new Set(selection.components);
    if (!ids.size) return;
    commitDirty((c) => ({ ...c, components: c.components.map((comp) => ids.has(comp.id) ? fn(comp) : comp) }));
  }, [selection.components, commitDirty]);

  const rotateSel = useCallback(() => transformSelected((c) => ({ ...c, rotation: nextRotation(c.rotation) })), [transformSelected]);
  const flipSel = useCallback(() => transformSelected((c) => ({ ...c, flip: !c.flip })), [transformSelected]);

  const deleteSel = useCallback(() => {
    const comps = new Set(selection.components);
    const wires = new Set(selection.wires);
    if (!comps.size && !wires.size) return;
    commitDirty((c) => ({
      components: c.components.filter((x) => !comps.has(x.id)),
      wires: c.wires.filter((w) => !wires.has(w.id)),
      schemaVersion: 1,
    }));
    setSelection(emptySelection());
  }, [selection, commitDirty]);

  const duplicateSel = useCallback(() => {
    const ids = new Set(selection.components);
    const clones: PlacedComponent[] = circuit.components
      .filter((c) => ids.has(c.id))
      .map((c) => ({ ...c, id: uid(c.kind[0] + '_'), x: c.x + 40, y: c.y + 40, props: { ...c.props } }));
    if (!clones.length) return;
    commitDirty((c) => ({ ...c, components: [...c.components, ...clones] }));
    setSelection({ components: clones.map((c) => c.id), wires: [] });
  }, [selection.components, circuit.components, commitDirty]);

  const copySel = useCallback(() => {
    const ids = new Set(selection.components);
    clipboard.current = circuit.components.filter((c) => ids.has(c.id)).map((c) => ({ ...c, props: { ...c.props } }));
  }, [selection.components, circuit.components]);

  const pasteClip = useCallback(() => {
    if (!clipboard.current.length) return;
    const clones = clipboard.current.map((c) => ({ ...c, id: uid(c.kind[0] + '_'), x: c.x + 40, y: c.y + 40, props: { ...c.props } }));
    commitDirty((c) => ({ ...c, components: [...c.components, ...clones] }));
    setSelection({ components: clones.map((c) => c.id), wires: [] });
  }, [commitDirty]);

  // ---- Project actions -----------------------------------------------------
  const doNew = useCallback(() => {
    if (dirty && !confirm('Discard unsaved changes and start a new circuit?')) return;
    reset(emptyCircuit());
    setName('Untitled circuit');
    setProjectId(null);
    setSelection(emptySelection());
    setRun(null);
    setRunning(false);
    setDirty(false);
  }, [dirty, reset]);

  const doSave = useCallback(async () => {
    try {
      const id = projectId ?? newProject(name, circuit).id;
      const stored = { id, name, circuit, createdAt: Date.now(), updatedAt: Date.now() };
      await saveProject(stored);
      setProjectId(id);
      setDirty(false);
      showToast('Saved to this browser');
    } catch (e) {
      showToast('Save failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [projectId, name, circuit, showToast]);

  const doShare = useCallback(async () => {
    const payload = encodeShare(circuit);
    const url = `${location.origin}/s/v#c=${payload}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard');
    } catch {
      showToast(url);
    }
  }, [circuit, showToast]);

  const doExport = useCallback(async (format: ExportFormat) => {
    const safeName = name.replace(/\s+/g, '-').toLowerCase() || 'circuit';
    try {
      switch (format) {
        case 'png':
          await exportAsPNG(safeName);
          showToast('Exported as PNG');
          break;
        case 'svg':
          exportAsSVG(safeName);
          showToast('Exported as SVG');
          break;
        case 'pdf':
          await exportAsPDF(safeName);
          showToast('Exported as PDF');
          break;
        case 'docx':
          await exportAsDOCX(safeName);
          showToast('Exported as Word document');
          break;
        case 'json':
        default: {
          const json = serializeCircuit(circuit);
          exportAsJSON(safeName, json);
          showToast('Exported circuit JSON');
          break;
        }
      }
    } catch (err) {
      showToast('Export failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [circuit, name, showToast]);

  // ---- View controls -------------------------------------------------------
  const zoomBy = useCallback((factor: number) => {
    setViewport((vp) => {
      const el = wrapRef.current;
      const cx = el ? el.clientWidth / 2 : 400;
      const cy = el ? el.clientHeight / 2 : 300;
      const scale = Math.max(0.2, Math.min(4, vp.scale * factor));
      const k = scale / vp.scale;
      return { scale, panX: cx - (cx - vp.panX) * k, panY: cy - (cy - vp.panY) * k };
    });
  }, []);
  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy]);

  const fitView = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x: number, y: number) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    };
    for (const c of circuit.components) {
      const box = componentBox(c, 8);
      grow(box.x, box.y); grow(box.x + box.w, box.y + box.h);
    }
    for (const w of circuit.wires) { grow(w.x1, w.y1); grow(w.x2, w.y2); }
    if (!isFinite(minX)) { setViewport({ panX: el.clientWidth / 2, panY: el.clientHeight / 2, scale: 1 }); return; }
    const pad = 60;
    const cw = el.clientWidth, ch = el.clientHeight;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const scale = Math.max(0.2, Math.min(2, Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh)));
    setViewport({
      scale,
      panX: cw / 2 - ((minX + maxX) / 2) * scale,
      panY: ch / 2 - ((minY + maxY) / 2) * scale,
    });
  }, [circuit]);

  // ---- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    if (props.readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); return; }
      if (meta && e.key.toLowerCase() === 'c') { e.preventDefault(); copySel(); return; }
      if (meta && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClip(); return; }
      if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
      if (meta) return;
      switch (e.key) {
        case 'Delete': case 'Backspace': e.preventDefault(); deleteSel(); break;
        case 'r': case 'R': rotateSel(); break;
        case 'f': case 'F': flipSel(); break;
        case 'g': case 'G': setGridVisible((v) => !v); break;
        case 'w': case 'W': setTool((cur) => cur.type === 'wire' ? { type: 'select' } : { type: 'wire' }); break;
        case 'v': case 'V': setTool({ type: 'select' }); break;
        case '+': case '=': zoomIn(); break;
        case '-': case '_': zoomOut(); break;
        case 'Escape': setTool({ type: 'select' }); setSelection(emptySelection()); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.readOnly, undo, redo, doSave, copySel, pasteClip, duplicateSel, deleteSel, rotateSel, flipSel, zoomIn, zoomOut]);

  const wireNodeMap = run?.compiled?.wireNode ?? null;
  const nodeMap = run?.compiled?.nodeMap ?? null;
  const hasProbes = circuit.components.some((c) => c.kind === 'voltage_probe' || c.kind === 'current_probe');

  const handleDropAtScreen = useCallback((kind: string, screenX: number, screenY: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const canvasSvg = el.querySelector('svg[aria-label="Schematic canvas"]') as SVGSVGElement | null;
    const r = canvasSvg ? canvasSvg.getBoundingClientRect() : el.getBoundingClientRect();
    const world = screenToWorld(screenX - r.left, screenY - r.top, viewport);
    const def = getComponentDef(kind);
    if (!def) return;
    const snapped = snapPoint(world, [], GRID).pt;
    const comp: PlacedComponent = {
      id: uid(def.ref.toLowerCase() + '_'),
      kind,
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
      flip: false,
      props: { ...def.defaults },
    };
    commitDirty((c) => ({ ...c, components: [...c.components, comp] }));
    setSelection({ components: [comp.id], wires: [] });
    if (isCompact) setPaletteCollapsed(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(30); } catch {}
    }
    showToast(`Placed ${def.name}`);
  }, [viewport, commitDirty, isCompact, showToast]);

  return (
    <div ref={wrapRef} className="flex h-dvh w-screen flex-col overflow-hidden bg-paper">
      <Toolbar
        name={name}
        onRename={(n) => { setName(n); markDirty(); }}
        canUndo={canUndo}
        canRedo={canRedo}
        running={running}
        animating={animating}
        mode={mode}
        gridVisible={gridVisible}
        dirty={dirty}
        tool={tool}
        hasSelection={selection.components.length > 0 || selection.wires.length > 0}
        onToolChange={setTool}
        onDelete={deleteSel}
        onNew={doNew}
        onSave={doSave}
        onUndo={undo}
        onRedo={redo}
        onRun={doRun}
        onPause={doPause}
        onStop={doStop}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFit={fitView}
        onToggleGrid={() => setGridVisible((v) => !v)}
        onModeChange={setMode}
        onShare={doShare}
        onExport={doExport}
      />
      <div className="relative flex min-h-0 flex-1">
        <Palette
          activeKind={tool.type === 'place' ? tool.kind : null}
          onPick={(kind) => {
            setTool((cur) => cur.type === 'place' && cur.kind === kind ? { type: 'select' } : { type: 'place', kind });
            // On phones the palette overlays the canvas — hide it after a pick.
            if (isCompact) setPaletteCollapsed(true);
          }}
          collapsed={paletteCollapsed}
          onToggle={() => setPaletteCollapsed((c) => !c)}
          onDropAtScreen={handleDropAtScreen}
        />
        <div className="relative min-w-0 flex-1">
          <Canvas
            circuit={circuit}
            selection={selection}
            viewport={viewport}
            tool={tool}
            gridVisible={gridVisible}
            overlay={running ? run?.overlay ?? null : null}
            nodeVoltageAt={nodeVoltageAt}
            wireNodeMap={wireNodeMap}
            nodeMap={nodeMap}
            running={running}
            animating={animating}
            onViewport={setViewport}
            onSelection={setSelection}
            onCommit={commitDirty}
            onEndCoalesce={endCoalesce}
            onPlaced={() => setTool({ type: 'select' })}
            onToolChange={setTool}
          />
          {error && (
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-4">
              <div className="pointer-events-auto max-w-lg rounded border border-err/30 bg-paper px-3 py-2 text-sm text-err shadow-sm flex items-start gap-2">
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                  className="shrink-0 rounded p-0.5 text-err/60 hover:text-err hover:bg-err/10 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          <div className="absolute left-2 top-2 md:top-auto md:bottom-2 flex items-center gap-2">
            <Diagnostics run={run} error={error} onDismissError={() => setError(null)} />
          </div>
          {running && hasProbes && (
            <button
              className="btn btn-ghost absolute bottom-2 right-2 text-xs"
              onClick={() => setShowScope((s) => !s)}
            >
              {showScope ? 'Hide' : 'Show'} oscilloscope
            </button>
          )}
        </div>
        {selectedComponent && (
          <PropertiesPanel
            component={selectedComponent}
            overlay={running ? run?.overlay ?? null : null}
            onChangeProp={changeProp}
            onRotate={rotateSel}
            onFlip={flipSel}
            onDuplicate={duplicateSel}
            onDelete={deleteSel}
            onClose={() => setSelection(emptySelection())}
          />
        )}
      </div>
      {showScope && running && mode === 'transient' && (
        <Scope run={run} circuit={circuit} frame={frame} onClose={() => setShowScope(false)} />
      )}
      {toast && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded bg-ink px-4 py-2 text-sm text-paper shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
}
