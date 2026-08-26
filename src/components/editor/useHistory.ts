/**
 * Undo/redo history for the circuit document.
 *
 * The circuit is treated as an immutable value; `commit` pushes a new version
 * and clears the redo stack. Ephemeral state (selection, viewport, tool) is not
 * historised — only the persisted document is. Coalescing avoids flooding the
 * stack during a drag: pass `coalesce` to merge with the previous entry.
 */
import { useCallback, useRef, useState } from 'react';
import type { Circuit } from '../../lib/circuit/types.ts';

interface HistoryState {
  present: Circuit;
  past: Circuit[];
  future: Circuit[];
}

const LIMIT = 200;

export function useHistory(initial: Circuit) {
  const [state, setState] = useState<HistoryState>({ present: initial, past: [], future: [] });
  const coalescing = useRef(false);

  const commit = useCallback((next: Circuit | ((c: Circuit) => Circuit), coalesce = false) => {
    setState((s) => {
      const value = typeof next === 'function' ? (next as (c: Circuit) => Circuit)(s.present) : next;
      if (value === s.present) return s;
      if (coalesce && coalescing.current) {
        return { ...s, present: value, future: [] };
      }
      coalescing.current = coalesce;
      const past = [...s.past, s.present].slice(-LIMIT);
      return { present: value, past, future: [] };
    });
  }, []);

  const endCoalesce = useCallback(() => {
    coalescing.current = false;
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { present: prev, past: s.past.slice(0, -1), future: [s.present, ...s.future].slice(0, LIMIT) };
    });
    coalescing.current = false;
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      return { present: next, past: [...s.past, s.present].slice(-LIMIT), future: s.future.slice(1) };
    });
    coalescing.current = false;
  }, []);

  const reset = useCallback((c: Circuit) => {
    setState({ present: c, past: [], future: [] });
    coalescing.current = false;
  }, []);

  return {
    circuit: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    commit,
    endCoalesce,
    undo,
    redo,
    reset,
  };
}
