/**
 * Famous circuits the parts palette can drop onto the canvas in one tap.
 *
 * Each one is assembled with the same Builder the Examples pages use, so every
 * wire endpoint lands on a real terminal coordinate and every circuit actually
 * compiles and solves — tests/famousCircuits.test.ts proves it for all of them.
 */
import type { Circuit } from '../circuit/types.ts';
import { Builder } from './examples.ts';

export interface FamousCircuit {
  id: string;
  name: string;
  summary: string;
  mode: 'dc' | 'transient';
  build: () => Circuit;
}

/* ---- Wheatstone bridge ---------------------------------------------------
   Four resistors in a diamond. The two legs divide the supply independently,
   so the galvanometer (a voltmeter here) reads the difference between the mid
   points — zero only when the ratio R1:R2 matches R3:R4. */
function wheatstoneBridge(): Circuit {
  const b = new Builder();
  const src = b.place('dc_source', 180, 240, { props: { value: '10', label: 'V1' } });
  const r1 = b.place('resistor', 300, 180, { rotation: 90, props: { resistance: '2.2k', label: 'R1' } });
  const r2 = b.place('resistor', 300, 300, { rotation: 90, props: { resistance: '1k', label: 'R2' } });
  const r3 = b.place('resistor', 500, 180, { rotation: 90, props: { resistance: '4.7k', label: 'R3' } });
  const r4 = b.place('resistor', 500, 300, { rotation: 90, props: { resistance: '1k', label: 'R4' } });
  const galvo = b.place('voltmeter', 400, 240, { props: { label: 'Vg' } });
  const amm = b.place('ammeter', 280, 140, { props: { label: 'A1' } });
  const gnd = b.place('ground', 240, 380);

  // Supply + total current meter along the top rail.
  b.wire({ x: 180, y: 200 }, { x: 180, y: 140 });
  b.wire({ x: 180, y: 140 }, b.term(amm, 'p'));
  b.wire(b.term(amm, 'n'), b.term(r1, 'a'));
  b.wire(b.term(r1, 'a'), b.term(r3, 'a'));
  // Left leg mid point and right leg mid point.
  b.wire(b.term(r1, 'b'), b.term(r2, 'a'));
  b.wire(b.term(r3, 'b'), b.term(r4, 'a'));
  // Galvanometer across the two mid points (T-junctions on those legs).
  b.wire({ x: 300, y: 240 }, b.term(galvo, 'p'));
  b.wire(b.term(galvo, 'n'), { x: 500, y: 240 });
  // Bottom rail back to the supply, with ground on the return.
  b.wire(b.term(r2, 'b'), b.term(r4, 'b'));
  b.wire(b.term(src, 'neg'), { x: 180, y: 340 });
  b.wire({ x: 180, y: 340 }, b.term(r2, 'b'));
  b.wire({ x: 240, y: 340 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Voltage doubler -----------------------------------------------------
   Two diodes and two capacitors stack the input peak twice over: C1 rides the
   waveform up, D1 clamps it on the way down, D2 passes the combined voltage
   to C2. The output settles near twice the AC peak. */
function voltageDoubler(): Circuit {
  const b = new Builder();
  const ac = b.place('ac_source', 160, 300, { props: { amplitude: '5', freq: '1k', label: 'V1' } });
  const c1 = b.place('capacitor', 320, 260, { props: { capacitance: '100u', ic: '0', label: 'C1' } });
  const d1 = b.place('diode', 440, 300, { rotation: 270, props: { label: 'D1' } }); // clamps the ride down
  const d2 = b.place('diode', 520, 260, { props: { label: 'D2' } });               // passes the stack up
  const c2 = b.place('capacitor', 640, 300, { rotation: 90, props: { capacitance: '100u', ic: '0', label: 'C2' } });
  const load = b.place('resistor', 720, 300, { rotation: 90, props: { resistance: '10k', label: 'RL' } });
  b.place('voltage_probe', 600, 240, { props: { channel: '1', label: 'Vout' } });
  const gnd = b.place('ground', 160, 380);

  // Source into C1, then the stacked node shared by both diode cathodes/anodes.
  b.wire(b.term(ac, 'pos'), b.term(c1, 'a'));
  b.wire(b.term(c1, 'b'), b.term(d1, 'cathode'));
  b.wire(b.term(d1, 'cathode'), b.term(d2, 'anode'));
  // Doubled output: D2 into C2 and the load.
  b.wire(b.term(d2, 'cathode'), b.term(c2, 'a'));
  b.wire(b.term(c2, 'a'), b.term(load, 'a'));
  // Common rail: source return, D1 anode, C2 bottom, load bottom, ground.
  // Those three terminals sit on the rail interior and join it as T-junctions.
  b.wire(b.term(ac, 'neg'), b.term(load, 'b'));
  b.wire({ x: 160, y: 340 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Current divider ----------------------------------------------------
   One current source feeding two parallel resistors: the current splits in
   inverse proportion to each resistance, and the shared voltage is I × (R1∥R2). */
function currentDivider(): Circuit {
  const b = new Builder();
  const src = b.place('current_source', 160, 300, { props: { value: '10m', label: 'I1' } });
  const r1 = b.place('resistor', 320, 240, { rotation: 90, props: { resistance: '1k', label: 'R1' } });
  const r2 = b.place('resistor', 480, 240, { rotation: 90, props: { resistance: '3k', label: 'R2' } });
  const gnd = b.place('ground', 160, 380);

  b.wire(b.term(src, 'pos'), { x: 160, y: 180 });
  b.wire({ x: 160, y: 180 }, { x: 480, y: 180 });
  b.wire({ x: 320, y: 180 }, b.term(r1, 'a'));
  b.wire(b.term(r2, 'a'), { x: 480, y: 180 });
  b.wire(b.term(src, 'neg'), { x: 480, y: 340 });
  b.wire(b.term(r1, 'b'), { x: 320, y: 340 });
  b.wire(b.term(r2, 'b'), { x: 480, y: 340 });
  b.wire({ x: 160, y: 340 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Potentiometer lamp dimmer ------------------------------------------
   The pot is wired as a rheostat (wiper tied to the far end): sliding it
   changes how much of its resistance sits in series with the lamp. */
function lampDimmer(): Circuit {
  const b = new Builder();
  const src = b.place('dc_source', 160, 300, { props: { value: '12', label: 'V1' } });
  const pot = b.place('potentiometer', 320, 180, { props: { resistance: '470', wiper: 0.6, label: 'RV1' } });
  const lamp = b.place('lamp', 440, 240, { rotation: 90, props: { resistance: '100', rating: '5', label: 'L1' } });
  const gnd = b.place('ground', 160, 380);

  b.wire(b.term(src, 'pos'), { x: 160, y: 180 });
  b.wire({ x: 160, y: 180 }, b.term(pot, 'a'));
  // Wiper rail: ties back to terminal b (rheostat) and feeds the lamp.
  b.wire(b.term(pot, 'w'), { x: 440, y: 152 });
  b.wire({ x: 360, y: 152 }, b.term(pot, 'b'));
  b.wire({ x: 440, y: 152 }, b.term(lamp, 'a'));
  b.wire(b.term(lamp, 'b'), { x: 440, y: 340 });
  b.wire(b.term(src, 'neg'), { x: 440, y: 340 });
  b.wire({ x: 160, y: 340 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Full-wave bridge rectifier -----------------------------------------
   Four diodes steer both half cycles the same way, the capacitor fills the
   gaps between peaks, and the load sees a smooth positive rail. */
function bridgeRectifier(): Circuit {
  const b = new Builder();
  const ac = b.place('pulse_source', 390, 440, {
    rotation: 270,
    props: { v1: '-5', v2: '5', freq: '50', duty: 0.5, rise: '100u', label: 'Vin' },
  });
  const d1 = b.place('diode', 320, 120, { props: { label: 'D1' } });   // AC left  -> +
  const d2 = b.place('diode', 460, 120, { rotation: 180, props: { label: 'D2' } }); // AC right -> +
  const d3 = b.place('diode', 280, 260, { rotation: 180, props: { label: 'D3' } }); // - -> AC left
  const d4 = b.place('diode', 500, 260, { props: { label: 'D4' } });   // - -> AC right
  const load = b.place('resistor', 600, 220, { rotation: 90, props: { resistance: '1k', label: 'RL' } });
  const cap = b.place('capacitor', 680, 220, { rotation: 90, props: { capacitance: '100u', ic: '0', label: 'C1' } });
  // Probe tip sits on the positive rail by coordinate — no extra wire needed.
  b.place('voltage_probe', 640, 60, { props: { channel: '1', label: 'Vout' } });
  const gnd = b.place('ground', 400, 380);

  // Positive rail: both diode cathodes, over the top of the AC leg, to the load.
  b.wire(b.term(d1, 'cathode'), { x: 400, y: 120 });
  b.wire({ x: 400, y: 120 }, b.term(d2, 'cathode'));
  b.wire({ x: 400, y: 120 }, { x: 400, y: 80 });
  b.wire({ x: 400, y: 80 }, { x: 680, y: 80 });
  b.wire({ x: 600, y: 80 }, b.term(load, 'a'));
  b.wire({ x: 680, y: 80 }, b.term(cap, 'a'));
  // AC left leg: source + , D1 anode, D3 cathode.
  b.wire(b.term(d1, 'anode'), { x: 240, y: 120 });
  b.wire({ x: 240, y: 120 }, { x: 240, y: 440 });
  b.wire({ x: 240, y: 440 }, b.term(ac, 'pos'));
  // AC right leg: source - , D2 anode, D4 cathode.
  b.wire(b.term(d2, 'anode'), { x: 540, y: 120 });
  b.wire({ x: 540, y: 120 }, { x: 540, y: 440 });
  b.wire(b.term(ac, 'neg'), { x: 540, y: 440 });
  // Negative rail: both diode anodes, the load and the smoothing capacitor.
  b.wire(b.term(d3, 'anode'), { x: 320, y: 320 });
  b.wire(b.term(d4, 'anode'), { x: 460, y: 320 });
  b.wire({ x: 320, y: 320 }, { x: 460, y: 320 });
  b.wire({ x: 460, y: 320 }, { x: 680, y: 320 });
  b.wire(b.term(load, 'b'), { x: 600, y: 320 });
  b.wire(b.term(cap, 'b'), { x: 680, y: 320 });
  b.wire({ x: 400, y: 320 }, b.term(gnd, 'p'));
  return b.build();
}

/* ---- Series RLC resonance ------------------------------------------------
   R, L and C in one loop driven by a sine near the resonant frequency
   f = 1 / (2π√(LC)). At resonance the reactances cancel and the current peaks. */
function rlcResonance(): Circuit {
  const b = new Builder();
  const ac = b.place('ac_source', 160, 300, { props: { amplitude: '5', freq: '1k', label: 'V1' } });
  const r = b.place('resistor', 320, 180, { props: { resistance: '220', label: 'R1' } });
  const l = b.place('inductor', 440, 180, { props: { inductance: '10m', ic: '0', label: 'L1' } });
  const c = b.place('capacitor', 560, 260, { rotation: 90, props: { capacitance: '2.5u', ic: '0', label: 'C1' } });
  const probe = b.place('voltage_probe', 620, 160, { props: { channel: '1', label: 'Vc' } });
  const gnd = b.place('ground', 160, 380);

  b.wire(b.term(ac, 'pos'), { x: 160, y: 180 });
  b.wire({ x: 160, y: 180 }, b.term(r, 'a'));
  b.wire(b.term(r, 'b'), b.term(l, 'a'));
  b.wire(b.term(l, 'b'), b.term(probe, 'p'));
  b.wire({ x: 560, y: 180 }, b.term(c, 'a'));
  b.wire(b.term(c, 'b'), { x: 560, y: 340 });
  b.wire(b.term(ac, 'neg'), { x: 560, y: 340 });
  b.wire({ x: 160, y: 340 }, b.term(gnd, 'p'));
  return b.build();
}

export const FAMOUS_CIRCUITS: FamousCircuit[] = [
  {
    id: 'wheatstone-bridge',
    name: 'Wheatstone Bridge',
    summary: 'Four resistors and a galvanometer — the classic way to measure an unknown resistance.',
    mode: 'dc',
    build: wheatstoneBridge,
  },
  {
    id: 'voltage-doubler',
    name: 'Voltage Doubler',
    summary: 'Two diodes and two capacitors stack the AC peak into roughly twice the voltage.',
    mode: 'transient',
    build: voltageDoubler,
  },
  {
    id: 'current-divider',
    name: 'Current Divider',
    summary: 'One current source splits across two parallel resistors — 7.5 mA and 2.5 mA.',
    mode: 'dc',
    build: currentDivider,
  },
  {
    id: 'lamp-dimmer',
    name: 'Potentiometer Dimmer',
    summary: 'A pot wired as a rheostat varies the current through a lamp.',
    mode: 'dc',
    build: lampDimmer,
  },
  {
    id: 'bridge-rectifier',
    name: 'Full-Wave Bridge Rectifier',
    summary: 'Four diodes plus a smoothing capacitor turn AC into a steady positive rail.',
    mode: 'transient',
    build: bridgeRectifier,
  },
  {
    id: 'rlc-resonance',
    name: 'Series RLC Resonance',
    summary: 'R, L and C in series driven at resonance — where the current is largest.',
    mode: 'transient',
    build: rlcResonance,
  },
];

export function getFamousCircuit(id: string): FamousCircuit | undefined {
  return FAMOUS_CIRCUITS.find((c) => c.id === id);
}
