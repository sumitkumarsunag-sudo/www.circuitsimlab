import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ExportFormat = 'png' | 'svg' | 'pdf' | 'docx' | 'json';

interface ExportOption {
  id: ExportFormat;
  label: string;
  description: string;
  icon: string; // SVG path d attribute
}

const OPTIONS: ExportOption[] = [
  {
    id: 'png',
    label: 'PNG Image',
    description: 'High-res raster image (2×)',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'svg',
    label: 'SVG Vector',
    description: 'Scalable vector graphic',
    icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  },
  {
    id: 'pdf',
    label: 'PDF Document',
    description: 'Print-ready document',
    icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    id: 'docx',
    label: 'Word Document',
    description: 'DOCX with embedded schematic',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    id: 'json',
    label: 'Circuit JSON',
    description: 'Raw circuit data',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  },
];

interface ExportMenuProps {
  onExport: (format: ExportFormat) => void;
}

export function ExportMenu({ onExport }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setLoading(format);
    try {
      await onExport(format);
    } finally {
      setLoading(null);
      setOpen(false);
    }
  }, [onExport]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Export"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Export circuit"
        className={`inline-flex h-9 w-9 items-center justify-center rounded transition-colors ${
          open ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
        }`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-64 origin-top-right animate-[menu-in_0.15s_ease-out] rounded-lg border border-line bg-paper shadow-xl"
          style={{
            /* Inline @keyframes – no external CSS needed */
            animation: 'menu-in 0.15s ease-out',
          }}
        >
          <div className="px-3 py-2.5 border-b border-line">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Export as…</p>
          </div>
          <div className="py-1.5">
            {OPTIONS.map((opt) => {
              const isLoading = loading === opt.id;
              return (
                <button
                  key={opt.id}
                  role="menuitem"
                  onClick={() => handleExport(opt.id)}
                  disabled={loading !== null}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {/* Icon */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-2">
                    {isLoading ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={opt.icon} />
                      </svg>
                    )}
                  </span>
                  {/* Labels */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{opt.label}</span>
                    <span className="block text-xs text-muted leading-tight">{opt.description}</span>
                  </span>
                  {/* Format badge */}
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                    .{opt.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
