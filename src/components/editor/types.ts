/** Shared types for the schematic editor island. */
import type { RunResult } from './sim.ts';

export type Tool =
  | { type: 'select' }
  | { type: 'place'; kind: string }
  | { type: 'wire' };

export interface EditorSelection {
  components: string[];
  wires: string[];
}

export const emptySelection = (): EditorSelection => ({ components: [], wires: [] });

export interface SimState {
  run: RunResult | null;
  running: boolean;
  /** Whether current-flow animation is playing. */
  animating: boolean;
  /** Transient playback: index into transient.points, or -1 for DC/none. */
  frame: number;
}
