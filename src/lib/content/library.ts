/**
 * The full example library shown on the site: the hand-built teaching examples
 * plus the famous circuits the editor palette already ships.
 *
 * This lives in its own module on purpose — famousCircuits.ts imports the
 * Builder from examples.ts, so examples.ts cannot import it back without a
 * circular dependency. Pages import EXAMPLES / getExample from here.
 *
 * Every "results" figure below was taken from the MNA solver (DC operating
 * point, or the settled tail of a transient run), not worked out by hand.
 */
import { EXAMPLES as BASE_EXAMPLES, type Example } from './examples.ts';
import { getFamousCircuit } from './famousCircuits.ts';

type ClassicCopy = Omit<Example, 'build' | 'mode'> & { famousId: string };

const CLASSIC_COPY: ClassicCopy[] = [
  {
    famousId: 'wheatstone-bridge',
    slug: 'wheatstone-bridge',
    title: 'Wheatstone Bridge',
    category: 'Classic circuits',
    summary: 'Four resistors in a diamond and a meter across the middle — the classic circuit for measuring an unknown resistance.',
    explain: [
      'A Wheatstone bridge is two voltage dividers sharing one supply. The left leg (R1 over R2) and the right leg (R3 over R4) each produce a midpoint voltage, and a meter connected between the two midpoints reads the difference.',
      'When the ratios match — R1/R2 = R3/R4 — both midpoints sit at the same voltage and the meter reads zero. That is the balanced condition, and it is why the bridge is so precise: you are detecting a null, not reading an absolute value. Swap one resistor for an unknown, adjust another until the meter reads zero, and the unknown follows from the ratio.',
      'This bridge is deliberately unbalanced. The left leg divides 10 V by 2.2 kΩ over 1 kΩ, giving 3.125 V; the right leg divides by 4.7 kΩ over 1 kΩ, giving about 1.754 V. The meter reads the 1.37 V difference. Change R3 to 2.2 kΩ and run it again — the reading drops to zero.',
      'The same idea sits inside strain gauges, load cells and resistance thermometers: a tiny change in one arm unbalances the bridge and produces a voltage you can amplify.',
    ],
    results: [
      { label: 'Supply', value: '10 V' },
      { label: 'Left midpoint (R1/R2)', value: '3.125 V' },
      { label: 'Right midpoint (R3/R4)', value: '≈ 1.754 V' },
      { label: 'Bridge voltage', value: '≈ 1.37 V' },
      { label: 'Total supply current', value: '≈ 4.88 mA' },
    ],
  },
  {
    famousId: 'bridge-rectifier',
    slug: 'bridge-rectifier',
    title: 'Full-Wave Bridge Rectifier',
    category: 'Classic circuits',
    summary: 'Four diodes and a smoothing capacitor turn an alternating ±5 V input into a steady positive DC rail.',
    explain: [
      'A bridge rectifier uses four diodes to steer current through the load in the same direction on both halves of the input cycle. When the input is positive, one diagonal pair conducts; when it reverses, the other pair takes over. The load never sees the polarity flip.',
      'Because current always passes through two diodes in series, the output is lower than the input peak by two forward drops. With a ±5 V input the rail settles at about 3.6 V — roughly 5 V minus two drops of around 0.7 V each.',
      'The 100 µF capacitor across the load stores charge at each peak and supplies the load in between, which is what turns a pulsing waveform into a smooth rail. Remove it (or make it much smaller) and re-run the transient analysis to see the raw rectified waveform.',
      'Compare this with the half-wave rectifier example: a single diode throws away half of every cycle, while the bridge uses both halves and so needs far less smoothing for the same ripple.',
    ],
    results: [
      { label: 'Input', value: '±5 V, 50 Hz' },
      { label: 'Smoothing capacitor', value: '100 µF' },
      { label: 'Load', value: '1 kΩ' },
      { label: 'DC output (settled)', value: '≈ 3.6 V' },
      { label: 'Lost in two diodes', value: '≈ 1.4 V' },
    ],
  },
  {
    famousId: 'voltage-doubler',
    slug: 'voltage-doubler',
    title: 'Voltage Doubler',
    category: 'Classic circuits',
    summary: 'Two diodes and two capacitors stack an AC peak on top of itself to produce nearly twice the voltage.',
    explain: [
      'A voltage doubler produces a DC output close to twice the peak of its AC input, with no transformer. On the negative half-cycle, diode D1 conducts and charges C1 to the input peak. On the positive half-cycle the source voltage adds to the voltage already stored on C1, and D2 passes that stacked voltage on to C2.',
      'In an ideal circuit a 5 V peak input would give 10 V out. Real diodes each drop a little, so the output settles around 8.5 V here — two diode drops short of the ideal figure.',
      'The output does not appear instantly. Run the transient analysis and watch the probe: C2 climbs in steps over many cycles as charge is pumped across, then levels off once the charge delivered per cycle matches what the 10 kΩ load draws.',
      'Doublers suit light loads. Lower the load resistance and the output sags and ripples, because the capacitors cannot be topped up fast enough. Chaining more diode–capacitor stages gives a tripler, quadrupler and so on — the Cockcroft–Walton multiplier.',
    ],
    results: [
      { label: 'Input', value: '5 V peak, 1 kHz sine' },
      { label: 'Ideal output', value: '10 V' },
      { label: 'Solved output (settled)', value: '≈ 8.5 V' },
      { label: 'Load', value: '10 kΩ' },
      { label: 'Load current', value: '≈ 0.85 mA' },
    ],
  },
  {
    famousId: 'rlc-resonance',
    slug: 'rlc-resonance',
    title: 'Series RLC Resonance',
    category: 'Classic circuits',
    summary: 'A resistor, inductor and capacitor in one loop, driven at the frequency where their reactances cancel.',
    explain: [
      'In a series RLC circuit the inductor and capacitor oppose current in opposite ways: inductive reactance rises with frequency while capacitive reactance falls. At one frequency they are equal and cancel, leaving only the resistor to limit the current. That is resonance.',
      'The resonant frequency is f₀ = 1 / (2π√(LC)). With L = 10 mH and C = 2.5 µF that is about 1.007 kHz, and the source here drives the loop at 1 kHz — almost exactly on resonance. The current is therefore close to its maximum of 5 V / 220 Ω ≈ 22.7 mA.',
      'How sharp the peak is depends on the quality factor, Q = (1/R)√(L/C). Here Q is about 0.29, a heavily damped circuit, so the capacitor voltage peaks at about 1.4 V rather than magnifying the input. Drop R to 10 Ω and Q rises above 6 — the capacitor voltage then swings to several times the source voltage.',
      'Switch to AC analysis and sweep the frequency to see the whole response curve, with its peak at f₀. This is the principle behind radio tuning, band-pass filters and oscillators.',
    ],
    results: [
      { label: 'L and C', value: '10 mH, 2.5 µF' },
      { label: 'Resonant frequency f₀', value: '≈ 1.007 kHz' },
      { label: 'Drive', value: '5 V peak at 1 kHz' },
      { label: 'Quality factor Q', value: '≈ 0.29' },
      { label: 'Peak capacitor voltage', value: '≈ 1.4 V' },
    ],
  },
  {
    famousId: 'current-divider',
    slug: 'current-divider',
    title: 'Current Divider',
    category: 'Networks',
    summary: 'A 10 mA source splits between two parallel resistors — 7.5 mA one way and 2.5 mA the other.',
    explain: [
      'A current divider is the mirror image of a voltage divider. Parallel branches share the same voltage, so the current splits between them in inverse proportion to their resistance: the smaller resistor carries the larger share.',
      'For two resistors the share through R1 is I1 = I × R2 / (R1 + R2). Note that the other resistor appears on top. With 10 mA into 1 kΩ and 3 kΩ, R1 carries 10 mA × 3k / 4k = 7.5 mA and R2 carries the remaining 2.5 mA.',
      'Both branches see the same voltage, which is the source current times the parallel resistance: 10 mA × (1 kΩ ∥ 3 kΩ) = 10 mA × 750 Ω = 7.5 V. Check each branch with Ohm’s law — 7.5 V / 1 kΩ and 7.5 V / 3 kΩ — and you get the same two currents.',
      'The two branch currents add back up to the source current. That is Kirchhoff’s current law in action: what flows into a node must flow out.',
    ],
    results: [
      { label: 'Source current', value: '10 mA' },
      { label: 'Shared voltage', value: '7.5 V' },
      { label: 'Current in R1 (1 kΩ)', value: '7.5 mA' },
      { label: 'Current in R2 (3 kΩ)', value: '2.5 mA' },
    ],
  },
  {
    famousId: 'lamp-dimmer',
    slug: 'potentiometer-dimmer',
    title: 'Potentiometer Lamp Dimmer',
    category: 'Networks',
    summary: 'A potentiometer wired as a variable resistor controls how much current reaches a lamp.',
    explain: [
      'The simplest dimmer puts a variable resistance in series with the lamp. Here a 470 Ω potentiometer is wired as a rheostat — the wiper is tied to one end — so moving it changes how much of the track sits in the current path.',
      'With the wiper at 60%, 282 Ω of the pot is in series with the 100 Ω lamp. The total is 382 Ω, so the current is 12 V / 382 Ω ≈ 31.4 mA and the lamp gets only about 3.1 V of the 12 V supply. The rest is dropped across the pot.',
      'Select the potentiometer and change its wiper setting to see the lamp brighten and dim as the solver updates the current. At 0% the lamp sees the full 12 V; at 100% it is at its dimmest.',
      'This approach wastes power — the pot dissipates about 278 mW here, nearly three times what the lamp receives. That is why real dimmers switch the supply on and off rapidly (PWM) instead of burning the excess as heat.',
    ],
    results: [
      { label: 'Supply', value: '12 V' },
      { label: 'Pot resistance in circuit', value: '282 Ω (60% of 470 Ω)' },
      { label: 'Lamp current', value: '≈ 31.4 mA' },
      { label: 'Lamp voltage', value: '≈ 3.14 V' },
      { label: 'Lamp power', value: '≈ 99 mW' },
    ],
  },
];

const CLASSIC_EXAMPLES: Example[] = CLASSIC_COPY.map(({ famousId, ...copy }) => {
  const famous = getFamousCircuit(famousId);
  if (!famous) throw new Error(`Unknown famous circuit: ${famousId}`);
  return { ...copy, mode: famous.mode, build: famous.build };
});

export const EXAMPLES: Example[] = [...BASE_EXAMPLES, ...CLASSIC_EXAMPLES];

export function getExample(slug: string): Example | undefined {
  return EXAMPLES.find((e) => e.slug === slug);
}

/** Up to `n` other examples, same category first — for "related" blocks. */
export function relatedExamples(slug: string, n = 3): Example[] {
  const self = getExample(slug);
  if (!self) return [];
  const others = EXAMPLES.filter((e) => e.slug !== slug);
  return [
    ...others.filter((e) => e.category === self.category),
    ...others.filter((e) => e.category !== self.category),
  ].slice(0, n);
}
