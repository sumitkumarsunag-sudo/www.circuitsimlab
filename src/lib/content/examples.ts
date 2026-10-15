/**
 * Prebuilt example circuits.
 *
 * Each circuit is constructed with a tiny helper so wire endpoints are derived
 * from real terminal positions — the same geometry the editor and netlist
 * compiler use — which means every example actually simulates.
 */
import type { Circuit, PlacedComponent, Rotation } from '../circuit/types.ts';
import { terminalPosition } from '../circuit/types.ts';
import { getComponentDef } from '../components/registry.ts';

let counter = 0;
const id = (p: string) => `${p}${(counter++).toString(36)}`;

interface PlaceOpts {
  rotation?: Rotation;
  flip?: boolean;
  props?: Record<string, string | number | boolean>;
}

/** A builder that tracks placed parts and can wire terminals together. */
export class Builder {
  components: PlacedComponent[] = [];
  wires: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];

  place(kind: string, x: number, y: number, opts: PlaceOpts = {}): PlacedComponent {
    const def = getComponentDef(kind)!;
    const comp: PlacedComponent = {
      id: id(def.ref.toLowerCase() + '_'),
      kind,
      x,
      y,
      rotation: opts.rotation ?? 0,
      flip: opts.flip ?? false,
      props: { ...def.defaults, ...(opts.props ?? {}) },
    };
    this.components.push(comp);
    return comp;
  }

  /** Absolute position of a named terminal on a placed component. */
  term(comp: PlacedComponent, name: string): { x: number; y: number } {
    const def = getComponentDef(comp.kind)!;
    const t = def.terminals.find((tt) => tt.name === name)!;
    return terminalPosition(comp, { x: t.x, y: t.y });
  }

  /** Route an orthogonal wire (H then V) between two absolute points. */
  wire(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (a.x !== b.x && a.y !== b.y) {
      const mid = { x: b.x, y: a.y };
      this.wires.push({ id: id('w_'), x1: a.x, y1: a.y, x2: mid.x, y2: mid.y });
      this.wires.push({ id: id('w_'), x1: mid.x, y1: mid.y, x2: b.x, y2: b.y });
    } else {
      this.wires.push({ id: id('w_'), x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

  connect(ca: PlacedComponent, ta: string, cb: PlacedComponent, tb: string) {
    this.wire(this.term(ca, ta), this.term(cb, tb));
  }

  build(): Circuit {
    return { schemaVersion: 1, components: this.components, wires: this.wires };
  }
}

export type ExampleMode = 'dc' | 'transient';

export interface Example {
  slug: string;
  title: string;
  category: string;
  mode: ExampleMode;
  /** One-line summary for cards and meta description. */
  summary: string;
  /** Longer teaching paragraphs. */
  explain: string[];
  /** Expected solved results, stated up front so the page is honest. */
  results: { label: string; value: string }[];
  build: () => Circuit;
}

/* ---- Ohm's Law ---------------------------------------------------------- */
function ohmsLaw(): Circuit {
  const b = new Builder();
  const bat = b.place('battery', 200, 320, { props: { value: '9', label: 'V1' } });
  const r = b.place('resistor', 200, 180, { props: { resistance: '470', label: 'R1' } });
  const gnd = b.place('ground', 240, 380);
  // Left rail: R.a ── B.pos
  b.wire(b.term(r, 'a'), b.term(bat, 'pos'));
  // Right rail: R.b ── B.neg ── ground (ground pin sits on the interior).
  b.wire(b.term(r, 'b'), { x: 240, y: 340 });
  b.wire({ x: 240, y: 340 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- LED with series resistor ------------------------------------------ */
function ledResistor(): Circuit {
  const b = new Builder();
  const bat = b.place('battery', 200, 320, { props: { value: '5', label: 'V1' } });
  const r = b.place('resistor', 200, 180, { props: { resistance: '220', label: 'R1' } });
  const led = b.place('led', 240, 250, { rotation: 90, props: { color: 'red', vf: '2', label: 'D1' } });
  const gnd = b.place('ground', 240, 400);
  b.wire(b.term(r, 'a'), b.term(bat, 'pos'));      // left rail
  b.wire(b.term(r, 'b'), b.term(led, 'anode'));     // top-right into LED
  b.wire(b.term(led, 'cathode'), { x: 240, y: 360 });
  b.wire({ x: 240, y: 360 }, b.term(bat, 'neg'));   // back to battery −
  b.wire({ x: 240, y: 360 }, b.term(gnd, 'p'));     // ground the return
  return b.build();
}

/* ---- Voltage divider ---------------------------------------------------- */
function voltageDivider(): Circuit {
  const b = new Builder();
  const v = b.place('dc_source', 160, 260, { props: { value: '12', label: 'V1' } });
  const r1 = b.place('resistor', 360, 200, { rotation: 90, props: { resistance: '10k', label: 'R1' } });
  const r2 = b.place('resistor', 360, 320, { rotation: 90, props: { resistance: '10k', label: 'R2' } });
  const probe = b.place('voltage_probe', 420, 260, { rotation: 90, props: { channel: '1', label: 'Vout' } });
  const gnd = b.place('ground', 160, 380);
  // Top rail: V.pos ── R1.a
  b.wire(b.term(v, 'pos'), { x: 160, y: 160 });
  b.wire({ x: 160, y: 160 }, b.term(r1, 'a'));
  // Mid node (Vout): R1.b ── R2.a ── probe
  b.wire(b.term(r1, 'b'), b.term(r2, 'a'));
  b.wire(b.term(probe, 'p'), b.term(r2, 'a'));
  // Bottom rail: R2.b ── V.neg ── ground
  b.wire(b.term(r2, 'b'), { x: 360, y: 360 });
  b.wire({ x: 360, y: 360 }, b.term(v, 'neg'));
  b.wire({ x: 160, y: 360 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Series resistors --------------------------------------------------- */
function seriesResistors(): Circuit {
  const b = new Builder();
  const v = b.place('dc_source', 160, 260, { props: { value: '12', label: 'V1' } });
  const r1 = b.place('resistor', 280, 160, { props: { resistance: '1k', label: 'R1' } });
  const r2 = b.place('resistor', 420, 160, { props: { resistance: '2k', label: 'R2' } });
  const r3 = b.place('resistor', 560, 160, { props: { resistance: '3k', label: 'R3' } });
  const gnd = b.place('ground', 160, 380);
  b.wire(b.term(v, 'pos'), { x: 160, y: 160 });
  b.wire({ x: 160, y: 160 }, b.term(r1, 'a'));
  b.wire(b.term(r1, 'b'), b.term(r2, 'a'));
  b.wire(b.term(r2, 'b'), b.term(r3, 'a'));
  b.wire(b.term(r3, 'b'), { x: 600, y: 360 });
  b.wire({ x: 600, y: 360 }, b.term(v, 'neg'));
  b.wire({ x: 160, y: 360 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Parallel resistors ------------------------------------------------- */
function parallelResistors(): Circuit {
  const b = new Builder();
  const v = b.place('dc_source', 160, 260, { props: { value: '12', label: 'V1' } });
  const r1 = b.place('resistor', 360, 200, { rotation: 90, props: { resistance: '1k', label: 'R1' } });
  const r2 = b.place('resistor', 520, 200, { rotation: 90, props: { resistance: '1k', label: 'R2' } });
  const gnd = b.place('ground', 160, 380);
  // Top rail
  b.wire(b.term(v, 'pos'), { x: 160, y: 160 });
  b.wire({ x: 160, y: 160 }, b.term(r1, 'a'));
  b.wire(b.term(r1, 'a'), b.term(r2, 'a'));
  // Bottom rail
  b.wire(b.term(r1, 'b'), { x: 360, y: 360 });
  b.wire(b.term(r2, 'b'), { x: 520, y: 360 });
  b.wire({ x: 520, y: 360 }, { x: 160, y: 360 });
  b.wire({ x: 160, y: 360 }, b.term(v, 'neg'));
  b.wire({ x: 160, y: 360 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- RC charging (transient) ------------------------------------------- */
function rcCharging(): Circuit {
  const b = new Builder();
  const v = b.place('dc_source', 160, 260, { props: { value: '5', label: 'V1' } });
  const r = b.place('resistor', 300, 160, { props: { resistance: '10k', label: 'R1' } });
  const c = b.place('capacitor', 440, 240, { rotation: 90, props: { capacitance: '10u', ic: '0', label: 'C1' } });
  const probe = b.place('voltage_probe', 500, 200, { rotation: 90, props: { channel: '1', label: 'Vc' } });
  const gnd = b.place('ground', 160, 380);
  b.wire(b.term(v, 'pos'), { x: 160, y: 160 });
  b.wire({ x: 160, y: 160 }, b.term(r, 'a'));
  b.wire(b.term(r, 'b'), { x: 440, y: 160 });
  b.wire({ x: 440, y: 160 }, b.term(c, 'a'));
  b.wire(b.term(probe, 'p'), b.term(c, 'a'));
  b.wire(b.term(c, 'b'), { x: 440, y: 360 });
  b.wire({ x: 440, y: 360 }, { x: 160, y: 360 });
  b.wire({ x: 160, y: 360 }, b.term(v, 'neg'));
  b.wire({ x: 160, y: 360 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- 555 astable (pulse + LED blinker) --------------------------------- */
function astable555(): Circuit {
  const b = new Builder();
  const pulse = b.place('pulse_source', 160, 260, {
    props: { v1: '0', v2: '5', freq: '2', duty: 0.5, rise: '1u', label: 'V1' },
  });
  const r = b.place('resistor', 300, 160, { props: { resistance: '220', label: 'R1' } });
  const led = b.place('led', 440, 240, { rotation: 90, props: { color: 'red', vf: '2', label: 'D1' } });
  const probe = b.place('voltage_probe', 500, 200, { rotation: 90, props: { channel: '1', label: 'Vout' } });
  const gnd = b.place('ground', 160, 380);
  // Top rail: pulse.pos ── R.a
  b.wire(b.term(pulse, 'pos'), { x: 160, y: 160 });
  b.wire({ x: 160, y: 160 }, b.term(r, 'a'));
  // R.b ── LED anode ── probe
  b.wire(b.term(r, 'b'), { x: 440, y: 160 });
  b.wire({ x: 440, y: 160 }, b.term(led, 'anode'));
  b.wire(b.term(probe, 'p'), b.term(led, 'anode'));
  // LED cathode ── ground rail
  b.wire(b.term(led, 'cathode'), { x: 440, y: 360 });
  b.wire({ x: 440, y: 360 }, { x: 160, y: 360 });
  b.wire({ x: 160, y: 360 }, b.term(pulse, 'neg'));
  b.wire({ x: 160, y: 360 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Diode half-wave rectifier ----------------------------------------- */
function diodeRectifier(): Circuit {
  const b = new Builder();
  const ac = b.place('pulse_source', 160, 260, {
    props: { v1: '-5', v2: '5', freq: '50', duty: 0.5, rise: '100u', label: 'Vin' },
  });
  const d = b.place('diode', 300, 160, { props: { label: 'D1' } });
  const rLoad = b.place('resistor', 440, 240, { rotation: 90, props: { resistance: '1k', label: 'R1' } });
  const probe = b.place('voltage_probe', 500, 200, { rotation: 90, props: { channel: '1', label: 'Vout' } });
  const gnd = b.place('ground', 160, 380);
  // Source pos ── diode anode
  b.wire(b.term(ac, 'pos'), { x: 160, y: 160 });
  b.wire({ x: 160, y: 160 }, b.term(d, 'anode'));
  // Diode cathode ── load ── probe
  b.wire(b.term(d, 'cathode'), { x: 440, y: 160 });
  b.wire({ x: 440, y: 160 }, b.term(rLoad, 'a'));
  b.wire(b.term(probe, 'p'), b.term(rLoad, 'a'));
  // Bottom rail
  b.wire(b.term(rLoad, 'b'), { x: 440, y: 360 });
  b.wire({ x: 440, y: 360 }, { x: 160, y: 360 });
  b.wire({ x: 160, y: 360 }, b.term(ac, 'neg'));
  b.wire({ x: 160, y: 360 }, b.term(gnd, 'p'));
  return b.build();
}

export const EXAMPLES: Example[] = [
  {
    slug: 'ohms-law',
    title: "Ohm's Law",
    category: 'Fundamentals',
    mode: 'dc',
    summary: 'A single resistor across a 9 V battery — the cleanest demonstration of V = I × R.',
    explain: [
      "Ohm's Law says the current through a resistor equals the voltage across it divided by its resistance: I = V / R. This loop puts 9 volts across a single 470 Ω resistor.",
      'Run the DC analysis and the solver reports the node voltage and the branch current directly. Change the resistance in the properties panel and watch the current scale inversely — halve R and the current doubles.',
    ],
    results: [
      { label: 'Source voltage', value: '9 V' },
      { label: 'Resistance', value: '470 Ω' },
      { label: 'Current', value: '≈ 19.1 mA' },
      { label: 'Power in R', value: '≈ 172 mW' },
    ],
    build: ohmsLaw,
  },
  {
    slug: 'led-resistor',
    title: 'LED with Series Resistor',
    category: 'Fundamentals',
    mode: 'dc',
    summary: 'Why an LED needs a resistor — and how to size it for a target current.',
    explain: [
      'An LED is a diode: past its forward voltage it will draw almost unlimited current and destroy itself. The series resistor sets the current. Here a 5 V supply drives a red LED (≈ 2 V forward) through 220 Ω.',
      'The resistor drops the difference, 5 − 2 = 3 V, so the current is about 3 V / 220 Ω ≈ 13.6 mA. Run the analysis to see the LED energised and the exact operating point the diode model settles on.',
    ],
    results: [
      { label: 'Supply', value: '5 V' },
      { label: 'LED forward drop', value: '≈ 2 V' },
      { label: 'Series resistor', value: '220 Ω' },
      { label: 'LED current', value: '≈ 13.6 mA' },
    ],
    build: ledResistor,
  },
  {
    slug: 'voltage-divider',
    title: 'Voltage Divider',
    category: 'Fundamentals',
    mode: 'dc',
    summary: 'Two equal resistors split 12 V into 6 V — the workhorse of analog design.',
    explain: [
      'A voltage divider produces an output that is a fixed fraction of its input: Vout = Vin × R2 / (R1 + R2). With two equal 10 kΩ resistors, the midpoint sits at exactly half the supply.',
      'The voltage probe is wired to the midpoint node so you can read it on the oscilloscope or straight from the node label. Try making R2 larger than R1 and the output rises toward the full supply.',
    ],
    results: [
      { label: 'Input', value: '12 V' },
      { label: 'R1 = R2', value: '10 kΩ' },
      { label: 'Output (midpoint)', value: '6 V' },
      { label: 'Divider current', value: '600 µA' },
    ],
    build: voltageDivider,
  },
  {
    slug: 'series-resistors',
    title: 'Series Resistors',
    category: 'Networks',
    mode: 'dc',
    summary: 'Three resistors in a line add up — same current everywhere, voltages that sum to the supply.',
    explain: [
      'Resistors in series carry the same current, and their resistances add: Rtotal = 1k + 2k + 3k = 6 kΩ. Across 12 V that gives a loop current of 2 mA.',
      'Each resistor drops a share of the supply in proportion to its value: 2 V, 4 V and 6 V. Run the analysis and confirm the node voltages step down along the chain.',
    ],
    results: [
      { label: 'Total resistance', value: '6 kΩ' },
      { label: 'Loop current', value: '2 mA' },
      { label: 'Drops', value: '2 V · 4 V · 6 V' },
    ],
    build: seriesResistors,
  },
  {
    slug: 'parallel-resistors',
    title: 'Parallel Resistors',
    category: 'Networks',
    mode: 'dc',
    summary: 'Two 1 kΩ resistors in parallel behave like a single 500 Ω — currents add, voltage is shared.',
    explain: [
      'Resistors in parallel share the same voltage, and their conductances add. Two 1 kΩ resistors combine to 500 Ω, so a 12 V supply pushes 24 mA total — 12 mA through each branch.',
      'Run the DC analysis and watch both branches light with equal current. Change one resistor and the branch currents diverge while the node voltage stays put.',
    ],
    results: [
      { label: 'Equivalent resistance', value: '500 Ω' },
      { label: 'Total current', value: '24 mA' },
      { label: 'Per-branch current', value: '12 mA' },
    ],
    build: parallelResistors,
  },
  {
    slug: 'rc-charging',
    title: 'RC Charging Curve',
    category: 'Dynamics',
    mode: 'transient',
    summary: 'A capacitor charging through a resistor — the classic exponential, plotted on the scope.',
    explain: [
      'When a capacitor charges through a resistor it follows Vc(t) = Vs (1 − e^(−t/RC)). The time constant τ = R × C sets the pace: after one τ the capacitor reaches 63% of the supply, and after five τ it is essentially full.',
      'Here R = 10 kΩ and C = 10 µF give τ = 100 ms. Run the transient analysis and the voltage probe traces the charging curve on the oscilloscope in real time.',
    ],
    results: [
      { label: 'Time constant τ', value: '100 ms' },
      { label: 'Supply', value: '5 V' },
      { label: 'Vc at 1τ', value: '≈ 3.16 V' },
      { label: 'Vc at 5τ', value: '≈ 4.97 V' },
    ],
    build: rcCharging,
  },
  {
    slug: '555-astable',
    title: '555 Timer LED Blinker',
    category: 'Dynamics',
    mode: 'transient',
    summary: 'A pulse source drives an LED through a series resistor — watch it blink on the scope.',
    explain: [
      'A 555 timer in astable mode produces a continuous square wave. Here we model the output as a 2 Hz pulse source toggling between 0 V and 5 V, driving a red LED through a 220 Ω current-limiting resistor.',
      'Run the transient analysis to watch the LED blink on and off. The voltage probe captures the square wave on the oscilloscope. Change the frequency in the pulse source properties to speed up or slow down the blink rate.',
    ],
    results: [
      { label: 'Frequency', value: '2 Hz' },
      { label: 'High level', value: '5 V' },
      { label: 'Series resistor', value: '220 Ω' },
      { label: 'LED current (on)', value: '≈ 13.6 mA' },
    ],
    build: astable555,
  },
  {
    slug: 'diode-rectifier',
    title: 'Diode Half-Wave Rectifier',
    category: 'Dynamics',
    mode: 'transient',
    summary: 'A single diode clips negative half-cycles — the simplest AC-to-DC conversion.',
    explain: [
      'A half-wave rectifier passes only the positive half of an alternating input signal. The diode conducts when the input exceeds its forward voltage (≈ 0.7 V) and blocks when the input goes negative.',
      'Run the transient analysis and the voltage probe shows only the positive half-cycles appearing across the load resistor. The negative halves are blocked by the diode, with a small forward-voltage drop on the positive peaks.',
    ],
    results: [
      { label: 'Input peak', value: '±5 V' },
      { label: 'Output peak', value: '≈ 4.3 V' },
      { label: 'Frequency', value: '50 Hz' },
      { label: 'Load', value: '1 kΩ' },
    ],
    build: diodeRectifier,
  },
];

export function getExample(slug: string): Example | undefined {
  return EXAMPLES.find((e) => e.slug === slug);
}


