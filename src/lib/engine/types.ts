/**
 * Netlist types consumed by the solver.
 *
 * A netlist is a UI-independent description of a circuit: a set of numbered
 * nodes (node 0 is always ground) and a list of two- or multi-terminal
 * elements referencing those nodes. Everything the editor knows about symbols,
 * positions and wires is compiled down to this structure before simulation.
 */

export type ElementType =
  | 'R' // resistor
  | 'C' // capacitor
  | 'L' // inductor
  | 'V' // independent voltage source (DC value or AC magnitude)
  | 'I' // independent current source
  | 'D' // diode / LED (Shockley model)
  | 'SW' // ideal switch
  | 'VPULSE' // pulse voltage source (transient)
  | 'VSIN'; // sinusoidal voltage source (transient)

export interface BaseElement {
  id: string;
  type: ElementType;
  /** Node indices this element connects to. Node 0 is ground. */
  nodes: number[];
}

export interface Resistor extends BaseElement {
  type: 'R';
  nodes: [number, number];
  resistance: number; // ohms
}

export interface Capacitor extends BaseElement {
  type: 'C';
  nodes: [number, number];
  capacitance: number; // farads
  ic?: number; // initial voltage across (V)
}

export interface Inductor extends BaseElement {
  type: 'L';
  nodes: [number, number];
  inductance: number; // henries
  ic?: number; // initial current (A)
}

export interface VoltageSource extends BaseElement {
  type: 'V';
  nodes: [number, number]; // [positive, negative]
  value: number; // volts (DC) / magnitude (AC)
  acMag?: number; // AC analysis magnitude (defaults to 1 for the stimulus)
  acPhase?: number; // degrees
}

export interface CurrentSource extends BaseElement {
  type: 'I';
  nodes: [number, number]; // current flows from node[0] to node[1] internally
  value: number; // amps
}

export interface Diode extends BaseElement {
  type: 'D';
  nodes: [number, number]; // [anode, cathode]
  is: number; // saturation current (A)
  n: number; // emission coefficient
  vt?: number; // thermal voltage (V), default 0.02585
  /** Forward voltage hint used only for LED brightness visualisation. */
  vfwd?: number;
}

export interface Switch extends BaseElement {
  type: 'SW';
  nodes: [number, number];
  closed: boolean;
}

export interface PulseSource extends BaseElement {
  type: 'VPULSE';
  nodes: [number, number];
  v1: number; // initial value
  v2: number; // pulsed value
  delay: number; // s
  rise: number; // s
  fall: number; // s
  width: number; // s
  period: number; // s
}

export interface SinSource extends BaseElement {
  type: 'VSIN';
  nodes: [number, number];
  offset: number; // V
  amplitude: number; // V
  freq: number; // Hz
  phase?: number; // degrees
}

export type Element =
  | Resistor
  | Capacitor
  | Inductor
  | VoltageSource
  | CurrentSource
  | Diode
  | Switch
  | PulseSource
  | SinSource;

export interface Netlist {
  /** Total node count including ground (node 0). */
  nodeCount: number;
  elements: Element[];
  /** Optional human labels for nodes, indexed by node number. */
  nodeLabels?: Record<number, string>;
}

/** Result of a DC operating-point solve. */
export interface DCResult {
  ok: boolean;
  /** Node voltages indexed by node number (node 0 is 0 V). */
  nodeVoltages: number[];
  /** Branch currents keyed by element id (A). Positive per element convention. */
  currents: Record<string, number>;
  /** Power dissipated/delivered keyed by element id (W). */
  power: Record<string, number>;
  totalPower: number;
  iterations: number;
  error?: string;
}

/** A single time step of a transient run. */
export interface TransientPoint {
  t: number;
  nodeVoltages: number[];
  currents: Record<string, number>;
}

export interface TransientResult {
  ok: boolean;
  points: TransientPoint[];
  error?: string;
}

/** A single frequency point of an AC sweep. */
export interface ACPoint {
  freq: number;
  /** Node voltage magnitude/phase keyed by node number. */
  nodeMag: number[];
  nodePhase: number[];
}

export interface ACResult {
  ok: boolean;
  points: ACPoint[];
  error?: string;
}
