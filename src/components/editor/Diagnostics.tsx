import React, { useEffect, useState } from 'react';
import type { Issue } from '../../lib/circuit/validate.ts';
import { formatValue } from '../../lib/units.ts';
import type { RunResult } from './sim.ts';

function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const color = issue.severity === 'error' ? 'text-err' : 'text-warn';
  return (
    <li className="px-3 py-2 border-b border-line last:border-0">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 ${color}`} aria-hidden="true">
          {issue.severity === 'error' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 4l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-ink-2">{issue.message}</p>
          {issue.detail && (
            <button onClick={() => setOpen((v) => !v)} className="mt-0.5 text-xs text-accent hover:underline">
              Technical details {open ? '▴' : '▾'}
            </button>
          )}
          {open && issue.detail && <p className="mt-1 text-xs text-faint">{issue.detail}</p>}
        </div>
      </div>
    </li>
  );
}

export function Diagnostics({ run, error, onDismissError }: { run: RunResult | null; error: string | null; onDismissError?: () => void }) {
  const [showWarnings, setShowWarnings] = useState(false);
  const issues = run?.issues ?? [];
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  // Surface hints right after each run — that is when feedback matters most.
  // The user can still collapse them.
  useEffect(() => {
    if (run) setShowWarnings(true);
  }, [run]);

  // Circuit is considered solved if the solver succeeded, regardless of warnings
  const ok = run?.ok && errors.length === 0;
  const nodeCount = run ? Math.max(0, run.compiled.netlist.nodeCount - 1) : 0;

  return (
    <div className="rounded-md border border-line bg-paper shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-3 h-9 text-xs">
        <span className={`inline-flex items-center gap-1.5 font-medium ${ok ? 'text-ok' : error || errors.length ? 'text-err' : 'text-muted'}`}>
          <span className={`h-2 w-2 rounded-full ${ok ? 'bg-ok' : error || errors.length ? 'bg-err' : 'bg-line-strong'}`} />
          {ok ? 'Solved' : error || errors.length ? 'Not solved' : 'Ready'}
        </span>
        {run?.ok && (
          <>
            <span className="text-muted tnum">{nodeCount} node{nodeCount === 1 ? '' : 's'}</span>
            {run.overlay && <span className="text-muted tnum">Total power {formatValue(run.overlay.totalPower, 'W')}</span>}
            {run.mode === 'transient' && run.transient && <span className="text-muted tnum">{run.transient.points.length} pts</span>}
          </>
        )}
        {errors.length > 0 && (
          <span className="ml-auto text-err text-xs">
            {errors.length} error{errors.length === 1 ? '' : 's'}
          </span>
        )}
        {warnings.length > 0 && errors.length === 0 && (
          <button
            onClick={() => setShowWarnings((v) => !v)}
            className="ml-auto text-warn/70 hover:text-warn text-xs transition-colors"
          >
            {warnings.length} hint{warnings.length === 1 ? '' : 's'} {showWarnings ? '▴' : '▾'}
          </button>
        )}
      </div>
      {error && !errors.length && (
        <div className="flex items-start gap-2 px-3 pb-2">
          <p className="flex-1 text-sm text-err">{error}</p>
          {onDismissError && (
            <button
              onClick={onDismissError}
              aria-label="Dismiss error"
              className="shrink-0 mt-0.5 rounded p-0.5 text-err/60 hover:text-err hover:bg-err/10 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      {/* Hard errors are always shown */}
      {errors.length > 0 && (
        <ul className="max-h-40 overflow-y-auto border-t border-line">
          {errors.map((issue, i) => <IssueRow key={`e${i}`} issue={issue} />)}
        </ul>
      )}
      {/* Warnings are shown collapsed — users opt-in to see them */}
      {showWarnings && warnings.length > 0 && errors.length === 0 && (
        <ul className="max-h-40 overflow-y-auto border-t border-line">
          {warnings.map((issue, i) => <IssueRow key={`w${i}`} issue={issue} />)}
        </ul>
      )}
    </div>
  );
}

