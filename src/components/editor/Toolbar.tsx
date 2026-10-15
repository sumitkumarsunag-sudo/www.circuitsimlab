import React from 'react';
import type { SimMode } from './sim.ts';
import type { Tool } from './types.ts';
import { ExportMenu, type ExportFormat } from './ExportMenu.tsx';

interface IconBtnProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}
function IconBtn({ label, shortcut, onClick, disabled, active, className, children }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${
        active ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />;
const I = (p: { d: string; fill?: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={p.fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={p.d} /></svg>
);

export interface ToolbarProps {
  name: string;
  onRename: (n: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  running: boolean;
  animating: boolean;
  mode: SimMode;
  gridVisible: boolean;
  dirty: boolean;
  tool: Tool;
  hasSelection: boolean;
  onToolChange: (t: Tool) => void;
  onDelete: () => void;
  onNew: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRun: () => void;
  onPause: () => void;
  onStop: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleGrid: () => void;
  onModeChange: (m: SimMode) => void;
  onShare: () => void;
  onExport: (format: ExportFormat) => void;
}

export function Toolbar(p: ToolbarProps) {
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1 border-b border-line bg-paper px-2 py-1 md:h-11 md:flex-nowrap md:py-0">
      <a href="/" className="mr-1 flex items-center" aria-label="CircuitSimLab home" title="Home">
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M23 8 H12 a4 4 0 0 0 -4 4 v8 a4 4 0 0 0 4 4 h11" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="23" cy="8" r="3.2" fill="var(--color-accent)" />
          <circle cx="23" cy="24" r="3.2" fill="var(--color-ink)" />
          <circle cx="8" cy="16" r="2.6" fill="var(--color-signal)" />
        </svg>
      </a>

      <input
        value={p.name}
        onChange={(e) => p.onRename(e.target.value)}
        aria-label="Project name"
        className="w-28 min-w-0 rounded px-2 py-1 text-sm font-medium text-ink hover:bg-surface focus:bg-surface outline-none sm:w-40"
      />
      {p.dirty && <span className="text-xs text-faint" title="Unsaved changes">•</span>}

      <Sep />
      <IconBtn label="New" shortcut="Ctrl+N" onClick={p.onNew}><I d="M12 5v14M5 12h14" /></IconBtn>
      <IconBtn label="Save" shortcut="Ctrl+S" onClick={p.onSave}><I d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8" /></IconBtn>
      <Sep />
      <IconBtn label="Undo" shortcut="Ctrl+Z" onClick={p.onUndo} disabled={!p.canUndo}><I d="M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></IconBtn>
      <IconBtn label="Redo" shortcut="Ctrl+Y" onClick={p.onRedo} disabled={!p.canRedo}><I d="M15 14l5-5-5-5 M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" /></IconBtn>

      <Sep />
      <IconBtn label="Select / move" shortcut="V" onClick={() => p.onToolChange({ type: 'select' })} active={p.tool.type === 'select'}>
        <I d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z" fill />
      </IconBtn>
      <IconBtn label="Draw wire" shortcut="W" onClick={() => p.onToolChange(p.tool.type === 'wire' ? { type: 'select' } : { type: 'wire' })} active={p.tool.type === 'wire'}>
        <I d="M4 18h6v-8h10" />
      </IconBtn>
      <IconBtn label="Delete selected" shortcut="Del" onClick={p.onDelete} disabled={!p.hasSelection}>
        <I d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
      </IconBtn>

      <Sep />
      {!p.running ? (
        <button onClick={p.onRun} className="btn btn-primary h-9 px-3" title="Run simulation (Space)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          Run
        </button>
      ) : (
        <>
          <IconBtn label={p.animating ? 'Pause animation' : 'Resume animation'} shortcut="Space" onClick={p.onPause} active={p.animating}>
            {p.animating ? <I d="M6 4h4v16H6zM14 4h4v16h-4z" fill /> : <I d="M8 5v14l11-7z" fill />}
          </IconBtn>
          <IconBtn label="Stop" shortcut="Esc" onClick={p.onStop}><I d="M6 6h12v12H6z" fill /></IconBtn>
        </>
      )}

      <div className="ml-1">
        <label className="sr-only" htmlFor="sim-mode">Analysis mode</label>
        <select
          id="sim-mode"
          value={p.mode}
          onChange={(e) => p.onModeChange(e.target.value as SimMode)}
          className="rounded border border-line bg-paper px-2 py-1 text-sm text-ink-2 outline-none focus:border-accent"
          title="Analysis mode"
        >
          <option value="dc">DC Operating Point</option>
          <option value="transient">Transient (time)</option>
        </select>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <IconBtn label="Toggle grid" shortcut="G" onClick={p.onToggleGrid} active={p.gridVisible}><I d="M3 9h18M3 15h18M9 3v18M15 3v18" /></IconBtn>
        <span className="hidden items-center gap-1 sm:flex">
          <IconBtn label="Zoom out" shortcut="-" onClick={p.onZoomOut}><I d="M8 11h6M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" /></IconBtn>
          <IconBtn label="Zoom in" shortcut="+" onClick={p.onZoomIn}><I d="M11 8v6M8 11h6M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" /></IconBtn>
        </span>
        <IconBtn label="Fit to circuit" shortcut="F" onClick={p.onFit}><I d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></IconBtn>
        <Sep />
        <ExportMenu onExport={p.onExport} />
        <IconBtn label="Share link" onClick={p.onShare}><I d="M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 .1 0zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></IconBtn>
      </div>
    </div>
  );
}
