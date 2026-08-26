/**
 * Interactive calculator "tools" data.
 *
 * Each entry describes a small client-side calculator: its input fields, the
 * outputs it produces, the formula (shown to the reader as text), and a short
 * teaching explanation. The ACTUAL arithmetic runs in a vanilla `<script>` on
 * the page — this file only declares the shape of the UI so the template can
 * render it generically. Keeping the maths on the client means every result is
 * computed live, in the browser, with no round-trip.
 */

export interface ToolFieldOption {
  value: string;
  label: string;
}

export interface ToolField {
  id: string;
  label: string;
  type?: 'number' | 'select';
  /** Unit shown to the right of a numeric input (Ω, V, mA …). */
  unit?: string;
  default?: number | string;
  step?: number;
  min?: number;
  placeholder?: string;
  /** Small helper line under the field. */
  hint?: string;
  /** Options for a `select` field. */
  options?: ToolFieldOption[];
}

export interface ToolOutput {
  id: string;
  label: string;
  /** Marks the single headline result so the template can emphasise it. */
  primary?: boolean;
}

export interface Tool {
  slug: string;
  title: string;
  category: string;
  /** One line for cards and the meta description. */
  summary: string;
  /** Intro paragraph shown above the calculator. */
  intro: string;
  /** Formula lines, rendered in tabular monospace. */
  formula: string[];
  /** Teaching paragraphs shown below the calculator. */
  explain: string[];
  fields: ToolField[];
  outputs: ToolOutput[];
  related: { href: string; label: string }[];
}

const DIGIT_COLORS: ToolFieldOption[] = [
  { value: '0', label: 'Black (0)' },
  { value: '1', label: 'Brown (1)' },
  { value: '2', label: 'Red (2)' },
  { value: '3', label: 'Orange (3)' },
  { value: '4', label: 'Yellow (4)' },
  { value: '5', label: 'Green (5)' },
  { value: '6', label: 'Blue (6)' },
  { value: '7', label: 'Violet (7)' },
  { value: '8', label: 'Grey (8)' },
  { value: '9', label: 'White (9)' },
];

const MULTIPLIER_COLORS: ToolFieldOption[] = [
  { value: '0', label: 'Black (×1)' },
  { value: '1', label: 'Brown (×10)' },
  { value: '2', label: 'Red (×100)' },
  { value: '3', label: 'Orange (×1k)' },
  { value: '4', label: 'Yellow (×10k)' },
  { value: '5', label: 'Green (×100k)' },
  { value: '6', label: 'Blue (×1M)' },
  { value: '-1', label: 'Gold (×0.1)' },
  { value: '-2', label: 'Silver (×0.01)' },
];

const TOLERANCE_COLORS: ToolFieldOption[] = [
  { value: '1', label: 'Brown (±1%)' },
  { value: '2', label: 'Red (±2%)' },
  { value: '0.5', label: 'Green (±0.5%)' },
  { value: '0.25', label: 'Blue (±0.25%)' },
  { value: '0.1', label: 'Violet (±0.1%)' },
  { value: '5', label: 'Gold (±5%)' },
  { value: '10', label: 'Silver (±10%)' },
];

export const TOOLS: Tool[] = [
  {
    slug: 'ohms-law-calculator',
    title: "Ohm's law calculator",
    category: 'Fundamentals',
    summary: "Enter any two of voltage, current, resistance and power — get the other two.",
    intro:
      "Ohm's law ties together voltage, current and resistance; add the power relation and any two of the four quantities fix the rest. Fill in the two you know and leave the others blank.",
    formula: ['V = I × R', 'P = V × I = I² × R = V² / R'],
    explain: [
      'Voltage (V) is in volts, current (I) in amperes, resistance (R) in ohms and power (P) in watts. Currents in small circuits are often milliamps — enter 20 mA as 0.02 A.',
      'The calculator waits until exactly two fields are filled, then solves the remaining two. If you overspecify (three or more values that disagree) it flags the conflict instead of guessing.',
      'Want to see it in a real loop? The Ohm\'s law example puts a single resistor across a battery and reports the solved current straight from the MNA engine.',
    ],
    fields: [
      { id: 'V', label: 'Voltage (V)', unit: 'V', placeholder: 'e.g. 9', step: 0.1 },
      { id: 'I', label: 'Current (I)', unit: 'A', placeholder: 'e.g. 0.02', step: 0.001 },
      { id: 'R', label: 'Resistance (R)', unit: 'Ω', placeholder: 'e.g. 470', step: 1 },
      { id: 'P', label: 'Power (P)', unit: 'W', placeholder: 'e.g. 0.17', step: 0.01 },
    ],
    outputs: [
      { id: 'oV', label: 'Voltage' },
      { id: 'oI', label: 'Current' },
      { id: 'oR', label: 'Resistance' },
      { id: 'oP', label: 'Power' },
    ],
    related: [
      { href: '/examples/ohms-law', label: "Ohm's law example circuit" },
      { href: '/learn/ohms-law', label: "Learn: Ohm's law" },
    ],
  },
  {
    slug: 'voltage-divider-calculator',
    title: 'Voltage divider calculator',
    category: 'Analog',
    summary: 'Two resistors and an input voltage in — the output voltage and divider current out.',
    intro:
      'A resistive divider produces an output that is a fixed fraction of its input. It only holds while the load draws negligible current compared with the divider itself, so keep the resistors small relative to whatever they feed.',
    formula: ['Vout = Vin × R2 / (R1 + R2)', 'I = Vin / (R1 + R2)'],
    explain: [
      'R1 sits between the input and the output node; R2 sits between the output node and ground. The output is pulled toward ground by R2 and toward Vin by R1, landing at the ratio above.',
      'The current shown is the quiescent current wasted in the divider itself. Smaller resistors give a stiffer output but burn more current — a design trade-off, not a bug.',
      'Build one on the canvas to watch the midpoint node settle, then load it and see the output sag as the load resistance drops.',
    ],
    fields: [
      { id: 'Vin', label: 'Input voltage (Vin)', unit: 'V', default: 12, step: 0.1 },
      { id: 'R1', label: 'R1 (top)', unit: 'kΩ', default: 10, step: 0.1, min: 0 },
      { id: 'R2', label: 'R2 (bottom)', unit: 'kΩ', default: 10, step: 0.1, min: 0 },
    ],
    outputs: [
      { id: 'oVout', label: 'Output voltage', primary: true },
      { id: 'oI', label: 'Divider current' },
      { id: 'oRatio', label: 'Divider ratio' },
    ],
    related: [
      { href: '/examples/voltage-divider', label: 'Voltage divider example circuit' },
      { href: '/analog-circuit-simulator', label: 'Analog circuit simulator' },
    ],
  },
  {
    slug: 'led-resistor-calculator',
    title: 'LED resistor calculator',
    category: 'Analog',
    summary: 'Size the series resistor for an LED from supply voltage, forward voltage and target current.',
    intro:
      'An LED needs a series resistor to set its current — without one it draws whatever the supply allows and burns out. The resistor drops the difference between the supply and the LED\'s forward voltage.',
    formula: ['R = (Vsupply − Vf) / If', 'P = (Vsupply − Vf) × If'],
    explain: [
      'Typical forward voltages: red ≈ 1.8–2.2 V, green/yellow ≈ 2.0–2.4 V, blue/white ≈ 3.0–3.4 V. Read it from the datasheet where you can; the value matters most at low supply voltages.',
      'The exact resistance rarely matches a stock part, so the nearest E12 value is shown too. Picking the next value up nudges the current slightly below target, which is the safe direction.',
      'The power figure is what the resistor dissipates. Choose a resistor rated at roughly twice that to stay cool — a 1/4 W part is fine below about 125 mW.',
    ],
    fields: [
      { id: 'Vs', label: 'Supply voltage', unit: 'V', default: 5, step: 0.1 },
      { id: 'Vf', label: 'LED forward voltage', unit: 'V', default: 2, step: 0.1 },
      { id: 'If', label: 'Target current', unit: 'mA', default: 15, step: 0.5, min: 0 },
    ],
    outputs: [
      { id: 'oR', label: 'Exact resistance', primary: true },
      { id: 'oE12', label: 'Nearest E12 value' },
      { id: 'oIe12', label: 'Current with E12 part' },
      { id: 'oP', label: 'Resistor power' },
    ],
    related: [
      { href: '/examples/led-resistor', label: 'LED + resistor example circuit' },
      { href: '/led-circuit-simulator', label: 'LED circuit simulator' },
    ],
  },
  {
    slug: 'rc-time-constant',
    title: 'RC time constant calculator',
    category: 'Dynamics',
    summary: 'Resistance and capacitance in — the time constant and charge/discharge times out.',
    intro:
      'When a capacitor charges or discharges through a resistor it follows an exponential set by the time constant τ = R × C. One τ gets you 63% of the way; five τ is close enough to call it settled.',
    formula: ['τ = R × C', 'Vc(t) = Vs · (1 − e^(−t/τ))', 't(63.2%) = 1τ   ·   t(99.3%) = 5τ'],
    explain: [
      'With R in kΩ and C in µF the time constant comes out directly in milliseconds — a handy shortcut worth remembering (10 kΩ × 10 µF = 100 ms).',
      'After 1τ the capacitor reaches 63.2% of its final voltage, after 3τ about 95%, and after 5τ roughly 99.3% — engineers usually treat five time constants as "fully charged".',
      'The RC charging example plots this exact curve on the oscilloscope so you can watch the exponential build in real time.',
    ],
    fields: [
      { id: 'R', label: 'Resistance (R)', unit: 'kΩ', default: 10, step: 0.1, min: 0 },
      { id: 'C', label: 'Capacitance (C)', unit: 'µF', default: 10, step: 0.1, min: 0 },
    ],
    outputs: [
      { id: 'oTau', label: 'Time constant τ', primary: true },
      { id: 'oT63', label: 'Time to 63.2% (1τ)' },
      { id: 'oT95', label: 'Time to 95% (3τ)' },
      { id: 'oT99', label: 'Time to 99.3% (5τ)' },
    ],
    related: [
      { href: '/examples/rc-charging', label: 'RC charging example circuit' },
      { href: '/rc-circuit-simulator', label: 'RC circuit simulator' },
    ],
  },
  {
    slug: 'resistor-color-code',
    title: 'Resistor color code calculator',
    category: 'Reference',
    summary: 'Pick the four bands on a resistor and read off its value and tolerance.',
    intro:
      'A four-band resistor encodes its value in colour: two significant digits, a decimal multiplier, and a tolerance band. Select the bands in order and the value appears below.',
    formula: ['R = (digit1 × 10 + digit2) × multiplier', 'range = R ± tolerance'],
    explain: [
      'Read the bands from the end where they are grouped closest together. The first two are digits, the third scales them by a power of ten, and the slightly separated fourth band is the tolerance.',
      'Gold and silver in the multiplier position mean ×0.1 and ×0.01 — used for resistors below 10 Ω. In the tolerance position gold is ±5% and silver ±10%, the most common everyday parts.',
      'This covers the four-band scheme; five- and six-band precision resistors add a third digit and a temperature-coefficient band, which are on the roadmap.',
    ],
    fields: [
      { id: 'b1', label: 'Band 1 (1st digit)', type: 'select', default: '1', options: DIGIT_COLORS },
      { id: 'b2', label: 'Band 2 (2nd digit)', type: 'select', default: '0', options: DIGIT_COLORS },
      { id: 'mult', label: 'Band 3 (multiplier)', type: 'select', default: '2', options: MULTIPLIER_COLORS },
      { id: 'tol', label: 'Band 4 (tolerance)', type: 'select', default: '5', options: TOLERANCE_COLORS },
    ],
    outputs: [
      { id: 'oVal', label: 'Resistance', primary: true },
      { id: 'oTol', label: 'Tolerance' },
      { id: 'oRange', label: 'Value range' },
    ],
    related: [
      { href: '/components', label: 'Component library' },
      { href: '/examples/ohms-law', label: "Ohm's law example circuit" },
    ],
  },
  {
    slug: '555-timer-calculator',
    title: '555 timer calculator (astable)',
    category: 'Timers',
    summary: 'Work out the frequency, period and duty cycle of a 555 in astable mode from R1, R2 and C.',
    intro:
      'In astable mode a 555 oscillates on its own, charging the timing capacitor through R1 + R2 and discharging it through R2. Those two paths set the high and low times — and because charge always sees more resistance than discharge, the duty cycle is always above 50%.',
    formula: [
      't_high = 0.693 × (R1 + R2) × C',
      't_low  = 0.693 × R2 × C',
      'f = 1.44 / ((R1 + 2·R2) × C)',
      'duty = (R1 + R2) / (R1 + 2·R2)',
    ],
    explain: [
      'With R in kΩ and C in µF the times come out in milliseconds and the frequency in the audio range for typical values. R1 and R2 of a few kΩ with a 10 nF–10 µF capacitor covers most blinker and tone circuits.',
      'To get closer to a 50% duty cycle, make R1 much smaller than R2 — but R1 must stay above about 1 kΩ so the discharge transistor is not overloaded. A true square wave needs a diode across R2 or a different topology.',
      'The 555 is not yet a first-class part in the palette, so you build the timing network from a source, resistors and a capacitor and reason about the thresholds. The timing maths here matches that circuit.',
    ],
    fields: [
      { id: 'R1', label: 'R1', unit: 'kΩ', default: 10, step: 0.1, min: 0 },
      { id: 'R2', label: 'R2', unit: 'kΩ', default: 47, step: 0.1, min: 0 },
      { id: 'C', label: 'C', unit: 'µF', default: 1, step: 0.01, min: 0 },
    ],
    outputs: [
      { id: 'oFreq', label: 'Frequency', primary: true },
      { id: 'oPeriod', label: 'Period' },
      { id: 'oHigh', label: 'High time' },
      { id: 'oLow', label: 'Low time' },
      { id: 'oDuty', label: 'Duty cycle' },
    ],
    related: [
      { href: '/555-timer-simulator', label: '555 timer simulator' },
      { href: '/simulator', label: 'Open the simulator' },
    ],
  },
];

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
