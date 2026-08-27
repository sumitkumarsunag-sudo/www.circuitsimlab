import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, componentsByCategory, getComponentDef } from '../../lib/components/registry.ts';
import type { ComponentDef } from '../../lib/components/primitives.ts';
import { renderSymbolInner } from '../../lib/components/renderSymbol.ts';

function Thumb({ def }: { def: ComponentDef }) {
  const html = renderSymbolInner(def.symbol, { stroke: 'currentColor', strokeWidth: 2 });
  return (
    <svg viewBox="-46 -30 92 60" className="h-9 w-14 text-ink-2" aria-hidden="true">
      <g dangerouslySetInnerHTML={{ __html: html }} />
    </svg>
  );
}

export interface PaletteProps {
  activeKind: string | null;
  onPick: (kind: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  onDropAtScreen?: (kind: string, clientX: number, clientY: number) => void;
}

export function Palette({
  activeKind,
  onPick,
  collapsed,
  onToggle,
  onDropAtScreen,
}: PaletteProps) {
  const [query, setQuery] = useState('');
  const [dragState, setDragState] = useState<{ def: ComponentDef; clientX: number; clientY: number } | null>(null);
  const touchState = useRef<{ startX: number; startY: number; def: ComponentDef; isDragging: boolean } | null>(null);
  const byCat = useMemo(() => componentsByCategory(), []);
  const q = query.trim().toLowerCase();

  const filtered = (list: ComponentDef[]) =>
    q ? list.filter((d) => d.name.toLowerCase().includes(q) || d.kind.includes(q) || d.ref.toLowerCase().includes(q)) : list;

  // Window-level touch listeners while dragging to ensure smooth tracking even when finger leaves palette
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!touchState.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - touchState.current.startX;
      const dy = touch.clientY - touchState.current.startY;
      const dist = Math.hypot(dx, dy);

      if (!touchState.current.isDragging && dist > 10) {
        touchState.current.isDragging = true;
      }

      if (touchState.current.isDragging) {
        if (e.cancelable) e.preventDefault();
        setDragState({
          def: touchState.current.def,
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchState.current) return;
      const wasDragging = touchState.current.isDragging;
      const def = touchState.current.def;
      const touch = e.changedTouches[0];

      touchState.current = null;
      setDragState(null);

      if (wasDragging && touch && onDropAtScreen) {
        onDropAtScreen(def.kind, touch.clientX, touch.clientY);
      }
    };

    const onTouchCancel = () => {
      touchState.current = null;
      setDragState(null);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchCancel);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [onDropAtScreen]);

  if (collapsed) {
    return (
      <>
        {/* Desktop: a thin left rail. */}
        <button
          onClick={onToggle}
          className="hidden md:flex w-9 shrink-0 border-r border-line bg-surface text-muted hover:text-ink items-start justify-center pt-3"
          aria-label="Expand component panel"
          title="Show components"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        {/* Mobile: a floating pill that opens the parts sheet. */}
        <button
          onClick={onToggle}
          className="md:hidden absolute bottom-3 left-3 z-30 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2.5 text-sm font-medium text-ink shadow-lg active:bg-surface"
          aria-label="Add a component"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14 17.5h7"/></svg>
          Parts
        </button>
      </>
    );
  }

  return (
    <>
      <aside
        className={`absolute inset-x-0 bottom-0 z-30 flex max-h-[64vh] flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl transition-opacity md:inset-x-auto md:inset-y-0 md:left-0 md:max-h-none md:w-60 md:shrink-0 md:rounded-none md:border-t-0 md:border-r md:shadow-none md:relative md:z-auto ${
          dragState ? 'opacity-35 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Components"
      >
        {/* Mobile grab handle. */}
        <div className="md:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>
        <div className="flex items-center justify-between px-3 h-10 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">Components</span>
          <button onClick={onToggle} className="flex h-8 w-8 items-center justify-center text-muted hover:text-ink" aria-label="Close component panel" title="Hide">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" className="md:hidden"/><path d="M15 18l-6-6 6-6" className="hidden md:block"/></svg>
          </button>
        </div>
        <div className="p-2 border-b border-line">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parts…"
            aria-label="Search components"
            className="w-full rounded border border-line bg-paper px-2.5 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1 overflow-y-auto py-1 overscroll-contain">
          {CATEGORIES.map((cat) => {
            const list = filtered(byCat[cat.id] ?? []);
            if (!list.length) return null;
            return (
              <section key={cat.id} className="mb-1">
                <h3 className="px-3 pt-2 pb-1 text-[0.7rem] font-semibold uppercase tracking-wide text-faint">{cat.label}</h3>
                <ul className="grid grid-cols-2 gap-1 px-2 md:block md:gap-0 md:px-0">
                  {list.map((def) => (
                    <li key={def.kind}>
                      <button
                        onClick={() => onPick(def.kind)}
                        onTouchStart={(e) => {
                          const t = e.touches[0];
                          if (t) {
                            touchState.current = {
                              startX: t.clientX,
                              startY: t.clientY,
                              def,
                              isDragging: false,
                            };
                          }
                        }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-cs-kind', def.kind);
                          e.dataTransfer.setData('text/plain', def.kind);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        aria-pressed={activeKind === def.kind}
                        title={`${def.description} — drag onto the canvas to place`}
                        className={`flex min-h-[52px] w-full select-none touch-none items-center gap-2 rounded-md border px-3 py-2 text-left text-sm active:bg-surface-2 md:min-h-0 md:cursor-grab md:rounded-none md:border-0 md:py-1.5 md:active:cursor-grabbing ${
                          activeKind === def.kind ? 'border-accent bg-accent-soft text-accent md:border-0' : 'border-line text-ink-2 hover:bg-surface-2 md:border-0'
                        }`}
                      >
                        <Thumb def={def} />
                        <span className="truncate">{def.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="px-3 py-2 text-[0.7rem] text-faint border-t border-line">
          Drag or tap a part to place it on the canvas.
        </p>
      </aside>

      {/* Floating touch drag ghost preview on mobile */}
      {dragState && (
        <div
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 rounded-xl border-2 border-accent bg-paper/95 px-4 py-2.5 shadow-2xl backdrop-blur-md"
          style={{
            left: `${dragState.clientX}px`,
            top: `${dragState.clientY}px`,
          }}
        >
          <div className="flex h-10 w-14 items-center justify-center text-accent animate-pulse">
            <Thumb def={dragState.def} />
          </div>
          <span className="text-xs font-semibold text-ink">{dragState.def.name}</span>
          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            Release to place
          </span>
        </div>
      )}
    </>
  );
}
