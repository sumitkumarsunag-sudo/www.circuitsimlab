/**
 * Public entry point for the simulation engine.
 *
 * The engine is deliberately UI-agnostic — it consumes a `Netlist` and returns
 * plain result objects. The editor compiles its schematic into a Netlist
 * (see `circuit/netlist.ts`) and calls these functions, typically from a Web
 * Worker so the main thread stays responsive.
 */
export * from './types.ts';
export { dcOperatingPoint } from './dc.ts';
export { transientAnalysis, sourceValueAt } from './transient.ts';
export type { TransientOptions } from './transient.ts';
export { acAnalysis } from './ac.ts';
export type { ACOptions } from './ac.ts';
export {
  solve,
  solveComplex,
  cAbs,
  cPhaseDeg,
  type Complex,
} from './linalg.ts';
