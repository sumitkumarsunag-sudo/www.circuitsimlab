/**
 * Simulation Web Worker.
 *
 * Runs DC / transient / AC analyses off the main thread so the editor stays
 * responsive during long solves. It speaks a small request/response protocol
 * keyed by a monotonic request id.
 */
import { dcOperatingPoint } from './dc.ts';
import { transientAnalysis, type TransientOptions } from './transient.ts';
import { acAnalysis, type ACOptions } from './ac.ts';
import type { Netlist } from './types.ts';

export type SimRequestInit =
  | { kind: 'dc'; netlist: Netlist }
  | { kind: 'transient'; netlist: Netlist; options: TransientOptions }
  | { kind: 'ac'; netlist: Netlist; options: ACOptions };

export type SimRequest = SimRequestInit & { id: number };

export type SimResponse = { id: number; kind: string; result: unknown; error?: string };

self.onmessage = (ev: MessageEvent<SimRequest>) => {
  const msg = ev.data;
  try {
    let result: unknown;
    switch (msg.kind) {
      case 'dc':
        result = dcOperatingPoint(msg.netlist);
        break;
      case 'transient':
        result = transientAnalysis(msg.netlist, msg.options);
        break;
      case 'ac':
        result = acAnalysis(msg.netlist, msg.options);
        break;
    }
    (self as unknown as Worker).postMessage({ id: msg.id, kind: msg.kind, result } satisfies SimResponse);
  } catch (e) {
    (self as unknown as Worker).postMessage({
      id: msg.id,
      kind: msg.kind,
      result: null,
      error: e instanceof Error ? e.message : String(e),
    } satisfies SimResponse);
  }
};
