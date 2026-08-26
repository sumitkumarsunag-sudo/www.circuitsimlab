/**
 * Learn section content.
 *
 * Articles are structured as ordered blocks so the [slug] template can render
 * them without a markdown pipeline. Keep the physics honest: every formula and
 * worked number here should match what the MNA solver returns for the linked
 * example circuit.
 */

export type LearnBlock =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'formula'; text: string }
  | { type: 'tip'; text: string };

export interface LearnArticle {
  slug: string;
  title: string;
  /** e.g. 'Fundamentals', 'Components', 'Analysis' */
  section: string;
  /** One line for cards and the meta description. */
  summary: string;
  readingMinutes: number;
  body: LearnBlock[];
  /** Slugs of related articles. */
  related?: string[];
  /** Matching example circuit slug (see lib/content/examples.ts). */
  exampleSlug?: string;
}

export const LEARN: LearnArticle[] = [
  {
    slug: 'ohms-law',
    title: "Ohm's Law",
    section: 'Fundamentals',
    summary: 'The relationship between voltage, current and resistance — and how to use it with confidence.',
    readingMinutes: 6,
    exampleSlug: 'ohms-law',
    related: ['series-and-parallel', 'voltage-dividers'],
    body: [
      { type: 'p', text: "Ohm's Law is the single most useful equation in electronics. It ties together the three quantities you measure most often: the voltage across a component, the current through it, and its resistance. Almost every DC calculation you will ever do starts here." },
      { type: 'h2', text: 'The equation' },
      { type: 'p', text: 'For an ideal resistor, the current is directly proportional to the voltage across it. The constant of proportionality is the resistance:' },
      { type: 'formula', text: 'V = I × R' },
      { type: 'p', text: 'You can rearrange it to solve for whichever quantity you are missing. All three forms describe the same relationship:' },
      { type: 'formula', text: 'I = V / R      R = V / I' },
      { type: 'list', items: [
        'V is voltage in volts (V) — the potential difference across the resistor.',
        'I is current in amperes (A) — the flow of charge through it.',
        'R is resistance in ohms (Ω) — how strongly the component opposes that flow.',
      ] },
      { type: 'h2', text: 'A worked example' },
      { type: 'p', text: 'Put 9 V across a 470 Ω resistor. How much current flows? Rearrange to I = V / R:' },
      { type: 'formula', text: 'I = 9 V / 470 Ω ≈ 0.0191 A ≈ 19.1 mA' },
      { type: 'p', text: 'The relationship is inverse in R: if you halve the resistance to 235 Ω, the current doubles to about 38 mA. If you double the voltage to 18 V, the current also doubles. This proportional intuition is worth more than the algebra — most of the time you just need to know which way a number moves.' },
      { type: 'h2', text: 'Power dissipation' },
      { type: 'p', text: 'A resistor turns electrical energy into heat. The power it dissipates follows directly from Ohm\'s Law:' },
      { type: 'formula', text: 'P = V × I = I² × R = V² / R' },
      { type: 'p', text: 'For our example, P = 9 V × 0.0191 A ≈ 0.172 W, or about 172 mW. That comfortably fits a standard 1/4 W (250 mW) resistor. Sizing for power is exactly how components get destroyed when it is overlooked.' },
      { type: 'tip', text: 'Real resistors have a power rating as well as a resistance. Always check that P = V²/R stays below the part\'s rating — a resistor forced to dissipate more than it is rated for will overheat and drift or fail.' },
      { type: 'h2', text: 'Where it breaks down' },
      { type: 'p', text: "Ohm's Law applies cleanly to resistors and other ohmic elements. Diodes, LEDs, transistors and other semiconductors are non-linear — their current does not scale linearly with voltage — so you cannot treat them as a fixed resistance. You will still use V = I × R for the resistors surrounding them, which is exactly how a current-limiting resistor for an LED gets sized." },
    ],
  },
  {
    slug: 'voltage-dividers',
    title: 'Voltage Dividers',
    section: 'Fundamentals',
    summary: 'Two resistors turn one voltage into a smaller one — the most reused pattern in analog design.',
    readingMinutes: 7,
    exampleSlug: 'voltage-divider',
    related: ['ohms-law', 'series-and-parallel'],
    body: [
      { type: 'p', text: 'A voltage divider is two resistors in series across a supply, with the output taken from the point between them. It produces an output that is a fixed fraction of the input, and it appears everywhere: setting reference voltages, scaling a signal to fit an ADC, biasing a transistor, or reading a sensor.' },
      { type: 'h2', text: 'The divider equation' },
      { type: 'p', text: 'With R1 on top (connected to the input) and R2 on the bottom (connected to ground), the output is taken across R2:' },
      { type: 'formula', text: 'Vout = Vin × R2 / (R1 + R2)' },
      { type: 'p', text: 'The two resistors carry the same current because they are in series, and each drops a share of the supply in proportion to its value. The output is simply R2\'s share.' },
      { type: 'h2', text: 'A worked example' },
      { type: 'p', text: 'Take Vin = 12 V with R1 = R2 = 10 kΩ. Because the resistors are equal, the output is exactly half the input:' },
      { type: 'formula', text: 'Vout = 12 V × 10k / (10k + 10k) = 6 V' },
      { type: 'p', text: 'The current through the chain is Vin / (R1 + R2) = 12 V / 20 kΩ = 600 µA. Want 3 V out instead? Make R2 one third of the total — for example R1 = 20 kΩ and R2 = 10 kΩ gives 12 × 10k/30k = 4 V; for 3 V use R1 = 30 kΩ, R2 = 10 kΩ.' },
      { type: 'h2', text: 'Loading effects — the catch' },
      { type: 'p', text: 'The clean equation above assumes nothing draws current from the output. The moment you connect a load resistance RL across R2, that load is in parallel with R2 and pulls the output down:' },
      { type: 'formula', text: 'R2_eff = (R2 × RL) / (R2 + RL)' },
      { type: 'p', text: 'If the load is much larger than R2 (say 100× or more), the sag is negligible. If it is comparable, the output can drop dramatically.' },
      { type: 'list', items: [
        'Pick divider resistors small enough that the load barely perturbs them — a common rule is RL ≥ 10 × R2.',
        'But not so small that the divider wastes current and heats up: there is a trade-off between stiffness and power.',
        'For a signal that must drive a real load, buffer the divider output with an op-amp follower instead of loading it directly.',
      ] },
      { type: 'tip', text: 'A voltage divider is a voltage reference, not a power supply. It can set a voltage for a high-impedance input, but it cannot deliver meaningful current without sagging. If something downstream draws current, account for loading or buffer the output.' },
    ],
  },
  {
    slug: 'series-and-parallel',
    title: 'Series and Parallel Resistors',
    section: 'Fundamentals',
    summary: 'How to combine resistors into a single equivalent — the foundation of circuit reduction.',
    readingMinutes: 6,
    exampleSlug: 'series-resistors',
    related: ['ohms-law', 'voltage-dividers'],
    body: [
      { type: 'p', text: 'Most circuits are built from resistors wired in series, in parallel, or in some mix of the two. Being able to collapse a network into one equivalent resistance is the first step in analysing almost any DC circuit.' },
      { type: 'h2', text: 'Resistors in series' },
      { type: 'p', text: 'Series means end-to-end, forming a single path. The same current flows through every resistor, and the resistances simply add:' },
      { type: 'formula', text: 'Rtotal = R1 + R2 + R3 + …' },
      { type: 'p', text: 'Three resistors of 1 kΩ, 2 kΩ and 3 kΩ in series total 6 kΩ. Across a 12 V supply that gives a loop current of I = 12 V / 6 kΩ = 2 mA. Each resistor drops V = I × R, so the drops are 2 V, 4 V and 6 V — and, as they must, they sum back to the 12 V supply. That is Kirchhoff\'s Voltage Law in action.' },
      { type: 'h2', text: 'Resistors in parallel' },
      { type: 'p', text: 'Parallel means both ends of each resistor share the same two nodes, offering multiple paths. Every resistor sees the same voltage, and their conductances (1/R) add:' },
      { type: 'formula', text: '1 / Rtotal = 1/R1 + 1/R2 + 1/R3 + …' },
      { type: 'p', text: 'For the common case of exactly two resistors, this simplifies to the "product over sum" form:' },
      { type: 'formula', text: 'Rtotal = (R1 × R2) / (R1 + R2)' },
      { type: 'p', text: 'Two 1 kΩ resistors in parallel come out to (1k × 1k)/(1k + 1k) = 500 Ω. The equivalent is always smaller than the smallest resistor in the group, because you are adding more paths for current to flow.' },
      { type: 'list', items: [
        'N equal resistors of value R in parallel give R / N.',
        'Any resistor in parallel with a much smaller one is dominated by the smaller value.',
        'A short (0 Ω) in parallel with anything gives 0 Ω; an open (∞) in parallel changes nothing.',
      ] },
      { type: 'h2', text: 'Reducing a network' },
      { type: 'p', text: 'For a mixed network, work from the inside out: find the innermost pure series or pure parallel groups, replace each with its single equivalent, and repeat. Eventually the whole thing collapses to one resistor across the source, and Ohm\'s Law gives you the total current.' },
      { type: 'tip', text: 'Two quick sanity checks: a series total is always larger than the biggest resistor, and a parallel total is always smaller than the smallest. If your answer violates either, you have combined them the wrong way.' },
    ],
  },
  {
    slug: 'capacitors',
    title: 'Capacitors and the RC Time Constant',
    section: 'Components',
    summary: 'What a capacitor stores, how it charges through a resistor, and why τ = RC sets the pace.',
    readingMinutes: 8,
    exampleSlug: 'rc-charging',
    related: ['ohms-law', 'dc-vs-transient-vs-ac'],
    body: [
      { type: 'p', text: 'A capacitor stores energy in an electric field between two conductive plates. Unlike a resistor, it does not dissipate energy — it holds charge and gives it back. That storage is what makes timing, filtering and smoothing circuits possible.' },
      { type: 'h2', text: 'Charge, voltage and capacitance' },
      { type: 'p', text: 'The charge stored on a capacitor is proportional to the voltage across it. The constant is the capacitance, measured in farads (F):' },
      { type: 'formula', text: 'Q = C × V' },
      { type: 'p', text: 'A farad is a large unit; real capacitors are usually microfarads (µF, 10⁻⁶), nanofarads (nF, 10⁻⁹) or picofarads (pF, 10⁻¹²). The energy stored is:' },
      { type: 'formula', text: 'E = ½ × C × V²' },
      { type: 'h2', text: 'Current and voltage are linked by rate of change' },
      { type: 'p', text: 'A capacitor\'s current depends not on the voltage across it but on how fast that voltage is changing:' },
      { type: 'formula', text: 'I = C × (dV/dt)' },
      { type: 'p', text: 'Two consequences fall straight out of this. The voltage across a capacitor cannot change instantly (that would demand infinite current). And in steady-state DC, once the voltage has settled, dV/dt is zero, so no current flows — a fully charged capacitor behaves like an open circuit.' },
      { type: 'h2', text: 'The RC time constant' },
      { type: 'p', text: 'Charge a capacitor through a resistor from a supply Vs and the voltage rises along an exponential curve:' },
      { type: 'formula', text: 'Vc(t) = Vs × (1 − e^(−t / RC))' },
      { type: 'p', text: 'The product RC has units of seconds and is called the time constant, written τ (tau):' },
      { type: 'formula', text: 'τ = R × C' },
      { type: 'p', text: 'With R = 10 kΩ and C = 10 µF, τ = 10,000 × 0.00001 = 0.1 s = 100 ms. The time constant is the natural clock of the circuit:' },
      { type: 'list', items: [
        'After 1τ the capacitor reaches about 63% of the supply voltage.',
        'After 2τ, about 86%; after 3τ, about 95%.',
        'After 5τ it is about 99.3% charged — close enough that engineers treat it as fully charged.',
      ] },
      { type: 'p', text: 'For our 5 V example with τ = 100 ms, that means about 3.16 V after 100 ms and about 4.97 V after 500 ms. Discharging follows the mirror-image curve, Vc(t) = V0 × e^(−t/RC), falling to 37% of its start after one τ.' },
      { type: 'tip', text: 'Because a capacitor\'s voltage cannot jump, you must run a transient analysis — not a single DC solve — to see it charge. DC analysis reports only the final settled state, where the capacitor is fully charged and no current flows.' },
    ],
  },
  {
    slug: 'diodes-and-leds',
    title: 'Diodes and LEDs',
    section: 'Components',
    summary: 'Forward voltage, why an LED needs a current-limiting resistor, and how to size it.',
    readingMinutes: 7,
    exampleSlug: 'led-resistor',
    related: ['ohms-law', 'reading-schematics'],
    body: [
      { type: 'p', text: 'A diode is a one-way valve for current: it conducts freely in one direction (forward) and blocks in the other (reverse). An LED — light-emitting diode — is a diode that emits light when it conducts. Both are non-linear, which is what makes them interesting and what makes them easy to destroy.' },
      { type: 'h2', text: 'Forward voltage' },
      { type: 'p', text: 'A diode only begins to conduct once the forward voltage across it exceeds a threshold, its forward voltage drop (Vf). Below that it passes almost no current; above it, the current rises very steeply for only a small increase in voltage. Typical values:' },
      { type: 'list', items: [
        'Silicon signal/rectifier diode: Vf ≈ 0.7 V',
        'Schottky diode: Vf ≈ 0.2–0.4 V',
        'Red LED: Vf ≈ 1.8–2.2 V',
        'Green / blue / white LEDs: Vf ≈ 3.0–3.4 V',
      ] },
      { type: 'p', text: 'Because the current-versus-voltage curve is so steep past Vf, you cannot control an LED by setting a voltage — a tiny voltage change swings the current wildly. You control it by limiting the current instead.' },
      { type: 'h2', text: 'Why an LED needs a resistor' },
      { type: 'p', text: 'Connect an LED straight across a supply above its Vf and it will try to draw effectively unlimited current, overheat, and burn out. A series resistor absorbs the difference between the supply and the LED\'s forward voltage, fixing the current at a safe value.' },
      { type: 'h2', text: 'Sizing the resistor' },
      { type: 'p', text: 'The supply voltage splits between the resistor and the LED. The resistor drops (Vs − Vf), and Ohm\'s Law sets the current through that drop. Rearranged to solve for the resistor:' },
      { type: 'formula', text: 'R = (Vs − Vf) / I' },
      { type: 'p', text: 'Drive a red LED (Vf ≈ 2 V) from a 5 V supply at a target of 13.6 mA:' },
      { type: 'formula', text: 'R = (5 V − 2 V) / 0.0136 A ≈ 220 Ω' },
      { type: 'p', text: 'A standard 220 Ω resistor gives about (5 − 2)/220 ≈ 13.6 mA, a healthy brightness for most indicator LEDs. Want it dimmer? Increase R. Note that the resistor dissipates P = I × (Vs − Vf) ≈ 0.0136 × 3 ≈ 41 mW here, well within a 1/4 W part.' },
      { type: 'tip', text: 'Always check the LED\'s datasheet for its maximum forward current — often around 20 mA for standard indicators. Design for comfortably below the maximum; you rarely need full rated current for a visible indicator, and running cooler lasts longer.' },
    ],
  },
  {
    slug: 'reading-schematics',
    title: 'Reading Schematics',
    section: 'Fundamentals',
    summary: 'Symbols, nodes and the ground reference — how to read a circuit diagram fluently.',
    readingMinutes: 6,
    related: ['series-and-parallel', 'diodes-and-leds'],
    body: [
      { type: 'p', text: 'A schematic is a map of a circuit\'s electrical connections, not its physical layout. It deliberately ignores where parts sit on a board and shows only what connects to what. Learning to read one fluently is the difference between guessing at a circuit and understanding it.' },
      { type: 'h2', text: 'Common symbols' },
      { type: 'p', text: 'Each component has a standard symbol and a reference designator (a letter plus a number, like R1 or C3):' },
      { type: 'list', items: [
        'Resistor — a zig-zag or rectangle, designator R.',
        'Capacitor — two parallel lines (one curved for polarised electrolytics), designator C.',
        'Diode / LED — a triangle pointing into a bar; the LED adds arrows for emitted light, designator D.',
        'Battery / DC source — long and short parallel lines, or a circle, designator V or BT.',
        'Ground — a downward set of shrinking horizontal bars, the common 0 V reference.',
      ] },
      { type: 'h2', text: 'Wires, junctions and nodes' },
      { type: 'p', text: 'Lines are wires — ideal, zero-resistance connections. Where wires join electrically, a solid dot marks the junction. Wires that cross without a dot are not connected; they simply pass over one another on the page.' },
      { type: 'p', text: 'A node is any set of points connected together by wire. Every point on a node is at the same voltage. Recognising nodes is the key skill: redraw a tangled schematic by its nodes and the series and parallel groupings usually become obvious.' },
      { type: 'formula', text: 'One node = one voltage' },
      { type: 'h2', text: 'The ground reference' },
      { type: 'p', text: 'Voltage is always a difference between two points, so we need a reference to measure against. The ground symbol marks that reference — defined as 0 V. Every other node voltage in the circuit is stated relative to ground.' },
      { type: 'p', text: 'This is why a simulator insists on a ground: without a fixed reference, the node voltages have no defined values (only their differences would be known). Pick one node as ground and the solver can assign an absolute voltage to every other node.' },
      { type: 'tip', text: 'When a circuit looks confusing, label the nodes. Give each distinct node a name, note which component terminals share it, and the topology — what is in series, what is in parallel — falls out almost immediately.' },
    ],
  },
  {
    slug: 'dc-vs-transient-vs-ac',
    title: 'DC, Transient and AC Analysis',
    section: 'Analysis',
    summary: 'What each type of analysis computes, and when to reach for it.',
    readingMinutes: 7,
    related: ['capacitors', 'ohms-law'],
    body: [
      { type: 'p', text: 'A circuit simulator can answer different questions about the same circuit depending on which analysis you run. The three most common are DC, transient, and AC. Choosing the right one is about matching the analysis to the question you are actually asking.' },
      { type: 'h2', text: 'DC analysis — the settled operating point' },
      { type: 'p', text: 'DC analysis (also called the operating point, or bias point) finds the steady state: the node voltages and branch currents after everything has settled and nothing is changing. Time does not appear at all.' },
      { type: 'list', items: [
        'Capacitors are treated as open circuits (fully charged, no current).',
        'Inductors are treated as short circuits (no voltage across them).',
        'Use it for: resistor networks, dividers, bias points, LED currents — anything where you want the final numbers.',
      ] },
      { type: 'h2', text: 'Transient analysis — behaviour over time' },
      { type: 'p', text: 'Transient analysis solves the circuit repeatedly over a sequence of small time steps, so it captures how voltages and currents evolve. This is the only analysis that shows a capacitor charging or an oscillator running.' },
      { type: 'formula', text: 'Vc(t) = Vs × (1 − e^(−t / RC))' },
      { type: 'list', items: [
        'Reactive components (capacitors, inductors) are modelled with their time-dependent behaviour.',
        'Initial conditions matter — for example, a capacitor\'s starting voltage.',
        'Use it for: charge/discharge curves, timing circuits, switching, oscillators, any waveform in time.',
      ] },
      { type: 'h2', text: 'AC analysis — response versus frequency' },
      { type: 'p', text: 'AC (small-signal) analysis sweeps a sinusoidal source across a range of frequencies and reports how the circuit responds at each one — the gain and phase shift. It linearises the circuit around its DC operating point, so it answers "how does this behave as a function of frequency?" rather than "what happens over time?"' },
      { type: 'list', items: [
        'Output is typically a Bode plot: magnitude and phase versus frequency.',
        'Reactive components have frequency-dependent impedance, so filters reveal their cutoff and rolloff.',
        'Use it for: filters, amplifier bandwidth, resonance — anything described in the frequency domain.',
      ] },
      { type: 'tip', text: 'Match the analysis to the question. Want the final voltages? Run DC. Want to watch something change over time? Run transient. Want to know how it responds to different frequencies? Run AC. Running the wrong one is the most common reason a simulation "gives the wrong answer".' },
    ],
  },
];

export function getArticle(slug: string): LearnArticle | undefined {
  return LEARN.find((a) => a.slug === slug);
}
