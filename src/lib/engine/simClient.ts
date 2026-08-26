/**
 * Main-thread client for the simulation Web Worker.
 *
 * Lazily spawns a single module worker and exposes promise-based `dc`,
 * `transient` and `ac` calls keyed by request id. Falls back to running the
 * solver synchronously on the main thread when Workers are unavailable (SSR,
 * old browsers) so the API is uniform for callers.
 */
import type { Netlist, DCResult, TransientResult, ACResult } from './types.ts';
import type { TransientOptions } from './transient.ts';
import type { ACOptions } from './ac.ts';
import type { SimRequest, SimRequestInit, SimResponse } from './worker.ts';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<SimResponse>) => {
      const { id, result, error } = ev.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    };
    worker.onerror = (ev) => {
      // Surface the worker failure to every in-flight request.
      for (const [, p] of pending) p.reject(new Error(ev.message || 'Simulation worker error.'));
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

function post<T>(req: SimRequestInit): Promise<T> {
  const w = getWorker();
  const id = nextId++;
  if (!w) {
    // Synchronous fallback — import lazily to avoid bundling the solver twice
    // on the happy path.
    return runInline<T>(req);
  }
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...req, id } as SimRequest);
  });
}

async function runInline<T>(req: SimRequestInit): Promise<T> {
  const [{ dcOperatingPoint }, { transientAnalysis }, { acAnalysis }] = await Promise.all([
    import('./dc.ts'),
    import('./transient.ts'),
    import('./ac.ts'),
  ]);
  switch (req.kind) {
    case 'dc':
      return dcOperatingPoint(req.netlist) as T;
    case 'transient':
      return transientAnalysis(req.netlist, req.options) as T;
    case 'ac':
      return acAnalysis(req.netlist, req.options) as T;
  }
}

export function simulateDC(netlist: Netlist): Promise<DCResult> {
  return post<DCResult>({ kind: 'dc', netlist });
}

export function simulateTransient(netlist: Netlist, options: TransientOptions): Promise<TransientResult> {
  return post<TransientResult>({ kind: 'transient', netlist, options });
}

export function simulateAC(netlist: Netlist, options: ACOptions): Promise<ACResult> {
  return post<ACResult>({ kind: 'ac', netlist, options });
}

/** Release the worker (e.g. on editor unmount). */
export function disposeSimClient(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.clear();
}
