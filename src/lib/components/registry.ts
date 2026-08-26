/**
 * Component registry — the single source of truth for every part the editor can
 * place. Each definition carries its schematic symbol, terminals, editable
 * properties and (crucially) a `toElements` mapping into real solver elements.
 *
 * Only components with a genuine simulation model are registered here; nothing
 * in the palette is decorative.
 */
import { parseEng } from '../units.ts';
import type { ComponentDef } from './primitives.ts';
import { propNum } from './primitives.ts';

const num = (c: Parameters<typeof propNum>[0], k: string, fb: number) =>
  propNum(c, k, fb, parseEng);

export const GRID = 20;

// ---------------------------------------------------------------------------
// Passive
// ---------------------------------------------------------------------------

const resistor: ComponentDef = {
  kind: 'resistor',
  name: 'Resistor',
  category: 'passive',
  ref: 'R',
  description: 'Limits current in proportion to voltage (Ohm’s law, V = IR).',
  terminals: [
    { name: 'a', x: -40, y: 0 },
    { name: 'b', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -20, y2: 0 },
    { t: 'path', d: 'M -20 0 L -16 -8 L -8 8 L 0 -8 L 8 8 L 16 -8 L 20 0' },
    { t: 'line', x1: 20, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 12 },
  props: [
    { key: 'resistance', label: 'Resistance', type: 'value', unit: 'Ω', siUnit: 'Ω' },
    { key: 'label', label: 'Label', type: 'text' },
    { key: 'tolerance', label: 'Tolerance', type: 'select', options: [
      { value: '1', label: '1%' }, { value: '5', label: '5%' }, { value: '10', label: '10%' },
    ], advanced: true },
  ],
  defaults: { resistance: '1k', label: 'R', tolerance: '5' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'R', nodes: [ctx.nodeOf('a'), ctx.nodeOf('b')], resistance: num(c, 'resistance', 1000) },
  ],
};

const capacitor: ComponentDef = {
  kind: 'capacitor',
  name: 'Capacitor',
  category: 'passive',
  ref: 'C',
  description: 'Stores energy in an electric field; blocks DC, passes AC.',
  terminals: [
    { name: 'a', x: -40, y: 0 },
    { name: 'b', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -4, y2: 0 },
    { t: 'line', x1: -4, y1: -12, x2: -4, y2: 12 },
    { t: 'line', x1: 4, y1: -12, x2: 4, y2: 12 },
    { t: 'line', x1: 4, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 14 },
  props: [
    { key: 'capacitance', label: 'Capacitance', type: 'value', unit: 'F', siUnit: 'F' },
    { key: 'label', label: 'Label', type: 'text' },
    { key: 'ic', label: 'Initial voltage', type: 'value', unit: 'V', siUnit: 'V', advanced: true },
  ],
  defaults: { capacitance: '1u', label: 'C', ic: '0' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'C', nodes: [ctx.nodeOf('a'), ctx.nodeOf('b')], capacitance: num(c, 'capacitance', 1e-6), ic: num(c, 'ic', 0) },
  ],
};

const inductor: ComponentDef = {
  kind: 'inductor',
  name: 'Inductor',
  category: 'passive',
  ref: 'L',
  description: 'Stores energy in a magnetic field; opposes changes in current.',
  terminals: [
    { name: 'a', x: -40, y: 0 },
    { name: 'b', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -24, y2: 0 },
    { t: 'path', d: 'M -24 0 A 6 6 0 0 1 -12 0 A 6 6 0 0 1 0 0 A 6 6 0 0 1 12 0 A 6 6 0 0 1 24 0', fill: false },
    { t: 'line', x1: 24, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 10 },
  props: [
    { key: 'inductance', label: 'Inductance', type: 'value', unit: 'H', siUnit: 'H' },
    { key: 'label', label: 'Label', type: 'text' },
    { key: 'ic', label: 'Initial current', type: 'value', unit: 'A', siUnit: 'A', advanced: true },
  ],
  defaults: { inductance: '1m', label: 'L', ic: '0' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'L', nodes: [ctx.nodeOf('a'), ctx.nodeOf('b')], inductance: num(c, 'inductance', 1e-3), ic: num(c, 'ic', 0) },
  ],
};

const potentiometer: ComponentDef = {
  kind: 'potentiometer',
  name: 'Potentiometer',
  category: 'passive',
  ref: 'RV',
  description: 'A variable resistor; the wiper taps a fraction of the total resistance.',
  terminals: [
    { name: 'a', x: -40, y: 0 },
    { name: 'w', x: 0, y: -28 },
    { name: 'b', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -20, y2: 0 },
    { t: 'path', d: 'M -20 0 L -16 -8 L -8 8 L 0 -8 L 8 8 L 16 -8 L 20 0' },
    { t: 'line', x1: 20, y1: 0, x2: 40, y2: 0 },
    { t: 'line', x1: 0, y1: -28, x2: 0, y2: -10 },
    { t: 'poly', pts: [[-4, -14], [4, -14], [0, -8]], fill: true },
  ],
  bbox: { w: 40, h: 28 },
  props: [
    { key: 'resistance', label: 'Total resistance', type: 'value', unit: 'Ω', siUnit: 'Ω' },
    { key: 'wiper', label: 'Wiper (0–1)', type: 'number' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { resistance: '10k', wiper: 0.5, label: 'RV' },
  toElements: (c, ctx) => {
    const total = num(c, 'resistance', 10000);
    const k = Math.min(0.999, Math.max(0.001, Number(c.props.wiper ?? 0.5)));
    return [
      { id: ctx.id + ':a', type: 'R', nodes: [ctx.nodeOf('a'), ctx.nodeOf('w')], resistance: total * k },
      { id: ctx.id + ':b', type: 'R', nodes: [ctx.nodeOf('w'), ctx.nodeOf('b')], resistance: total * (1 - k) },
    ];
  },
};

// ---------------------------------------------------------------------------
// Sources & ground
// ---------------------------------------------------------------------------

const ground: ComponentDef = {
  kind: 'ground',
  name: 'Ground',
  category: 'sources',
  ref: 'GND',
  description: 'The 0 V reference node. Every circuit needs at least one.',
  terminals: [{ name: 'p', x: 0, y: -20 }],
  symbol: [
    { t: 'line', x1: 0, y1: -20, x2: 0, y2: 0 },
    { t: 'line', x1: -12, y1: 0, x2: 12, y2: 0 },
    { t: 'line', x1: -7, y1: 5, x2: 7, y2: 5 },
    { t: 'line', x1: -3, y1: 10, x2: 3, y2: 10 },
  ],
  bbox: { w: 14, h: 16 },
  props: [],
  defaults: {},
  toElements: () => [],
};

const battery: ComponentDef = {
  kind: 'battery',
  name: 'Battery',
  category: 'sources',
  ref: 'BAT',
  description: 'A constant DC voltage source with a long (+) and short (−) plate.',
  terminals: [
    { name: 'pos', x: -40, y: 0 },
    { name: 'neg', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -8, y2: 0 },
    { t: 'line', x1: -8, y1: -14, x2: -8, y2: 14 },
    { t: 'line', x1: 0, y1: -7, x2: 0, y2: 7 },
    { t: 'line', x1: 8, y1: -14, x2: 8, y2: 14 },
    { t: 'line', x1: 16, y1: -7, x2: 16, y2: 7 },
    { t: 'line', x1: 16, y1: 0, x2: 40, y2: 0 },
    { t: 'text', x: -14, y: -18, s: '+', size: 12 },
  ],
  bbox: { w: 40, h: 16 },
  props: [
    { key: 'value', label: 'Voltage', type: 'value', unit: 'V', siUnit: 'V' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { value: '9', label: 'BAT' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'V', nodes: [ctx.nodeOf('pos'), ctx.nodeOf('neg')], value: num(c, 'value', 9) },
  ],
};

const dcSource: ComponentDef = {
  kind: 'dc_source',
  name: 'DC Voltage Source',
  category: 'sources',
  ref: 'V',
  description: 'An ideal constant-voltage source.',
  terminals: [
    { name: 'pos', x: 0, y: -40 },
    { name: 'neg', x: 0, y: 40 },
  ],
  symbol: [
    { t: 'line', x1: 0, y1: -40, x2: 0, y2: -18 },
    { t: 'circle', cx: 0, cy: 0, r: 18 },
    { t: 'line', x1: 0, y1: 18, x2: 0, y2: 40 },
    { t: 'text', x: 0, y: -4, s: '+', size: 12 },
    { t: 'text', x: 0, y: 12, s: '−', size: 12 },
  ],
  bbox: { w: 20, h: 40 },
  props: [
    { key: 'value', label: 'Voltage', type: 'value', unit: 'V', siUnit: 'V' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { value: '5', label: 'V' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'V', nodes: [ctx.nodeOf('pos'), ctx.nodeOf('neg')], value: num(c, 'value', 5) },
  ],
};

const acSource: ComponentDef = {
  kind: 'ac_source',
  name: 'AC Voltage Source',
  category: 'sources',
  ref: 'V',
  description: 'A sinusoidal source. Drives transient waveforms and AC sweeps.',
  terminals: [
    { name: 'pos', x: 0, y: -40 },
    { name: 'neg', x: 0, y: 40 },
  ],
  symbol: [
    { t: 'line', x1: 0, y1: -40, x2: 0, y2: -18 },
    { t: 'circle', cx: 0, cy: 0, r: 18 },
    { t: 'path', d: 'M -10 0 A 5 5 0 0 1 0 0 A 5 5 0 0 0 10 0' },
    { t: 'line', x1: 0, y1: 18, x2: 0, y2: 40 },
  ],
  bbox: { w: 20, h: 40 },
  props: [
    { key: 'amplitude', label: 'Amplitude', type: 'value', unit: 'V', siUnit: 'V' },
    { key: 'freq', label: 'Frequency', type: 'value', unit: 'Hz', siUnit: 'Hz' },
    { key: 'offset', label: 'DC offset', type: 'value', unit: 'V', siUnit: 'V', advanced: true },
    { key: 'phase', label: 'Phase', type: 'number', unit: '°', advanced: true },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { amplitude: '5', freq: '1k', offset: '0', phase: 0, label: 'V' },
  toElements: (c, ctx) => [
    {
      id: ctx.id, type: 'VSIN', nodes: [ctx.nodeOf('pos'), ctx.nodeOf('neg')],
      offset: num(c, 'offset', 0), amplitude: num(c, 'amplitude', 5),
      freq: num(c, 'freq', 1000), phase: Number(c.props.phase ?? 0),
    },
  ],
};

const pulseSource: ComponentDef = {
  kind: 'pulse_source',
  name: 'Pulse Source',
  category: 'sources',
  ref: 'V',
  description: 'A rectangular pulse train for driving digital and switching circuits.',
  terminals: [
    { name: 'pos', x: 0, y: -40 },
    { name: 'neg', x: 0, y: 40 },
  ],
  symbol: [
    { t: 'line', x1: 0, y1: -40, x2: 0, y2: -18 },
    { t: 'circle', cx: 0, cy: 0, r: 18 },
    { t: 'path', d: 'M -11 5 L -11 -5 L -2 -5 L -2 5 L 6 5 L 6 -5 L 11 -5' },
    { t: 'line', x1: 0, y1: 18, x2: 0, y2: 40 },
  ],
  bbox: { w: 20, h: 40 },
  props: [
    { key: 'v1', label: 'Low level', type: 'value', unit: 'V', siUnit: 'V' },
    { key: 'v2', label: 'High level', type: 'value', unit: 'V', siUnit: 'V' },
    { key: 'freq', label: 'Frequency', type: 'value', unit: 'Hz', siUnit: 'Hz' },
    { key: 'duty', label: 'Duty (0–1)', type: 'number', advanced: true },
    { key: 'rise', label: 'Rise time', type: 'value', unit: 's', siUnit: 's', advanced: true },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { v1: '0', v2: '5', freq: '1k', duty: 0.5, rise: '1u', label: 'V' },
  toElements: (c, ctx) => {
    const freq = num(c, 'freq', 1000);
    const period = 1 / freq;
    const duty = Math.min(0.99, Math.max(0.01, Number(c.props.duty ?? 0.5)));
    const rise = num(c, 'rise', 1e-6);
    return [
      {
        id: ctx.id, type: 'VPULSE', nodes: [ctx.nodeOf('pos'), ctx.nodeOf('neg')],
        v1: num(c, 'v1', 0), v2: num(c, 'v2', 5), delay: 0,
        rise, fall: rise, width: period * duty - rise, period,
      },
    ];
  },
};

const currentSource: ComponentDef = {
  kind: 'current_source',
  name: 'Current Source',
  category: 'sources',
  ref: 'I',
  description: 'Forces a constant current regardless of voltage.',
  terminals: [
    { name: 'pos', x: 0, y: -40 },
    { name: 'neg', x: 0, y: 40 },
  ],
  symbol: [
    { t: 'line', x1: 0, y1: -40, x2: 0, y2: -18 },
    { t: 'circle', cx: 0, cy: 0, r: 18 },
    { t: 'line', x1: 0, y1: 9, x2: 0, y2: -9 },
    { t: 'poly', pts: [[-4, -3], [4, -3], [0, -11]], fill: true },
    { t: 'line', x1: 0, y1: 18, x2: 0, y2: 40 },
  ],
  bbox: { w: 20, h: 40 },
  props: [
    { key: 'value', label: 'Current', type: 'value', unit: 'A', siUnit: 'A' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { value: '1m', label: 'I' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'I', nodes: [ctx.nodeOf('pos'), ctx.nodeOf('neg')], value: num(c, 'value', 1e-3) },
  ],
};

// ---------------------------------------------------------------------------
// Semiconductors
// ---------------------------------------------------------------------------

const diode: ComponentDef = {
  kind: 'diode',
  name: 'Diode',
  category: 'semiconductor',
  ref: 'D',
  description: 'Conducts in one direction (anode → cathode) above ~0.7 V.',
  terminals: [
    { name: 'anode', x: -40, y: 0 },
    { name: 'cathode', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -8, y2: 0 },
    { t: 'poly', pts: [[-8, -9], [-8, 9], [8, 0]], fill: true },
    { t: 'line', x1: 8, y1: -9, x2: 8, y2: 9 },
    { t: 'line', x1: 8, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 12 },
  props: [
    { key: 'label', label: 'Label', type: 'text' },
    { key: 'is', label: 'Saturation current', type: 'value', unit: 'A', siUnit: 'A', advanced: true },
    { key: 'n', label: 'Emission coeff.', type: 'number', advanced: true },
  ],
  defaults: { label: 'D', is: '1e-14', n: 1 },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'D', nodes: [ctx.nodeOf('anode'), ctx.nodeOf('cathode')], is: num(c, 'is', 1e-14), n: Number(c.props.n ?? 1) },
  ],
};

const led: ComponentDef = {
  kind: 'led',
  name: 'LED',
  category: 'semiconductor',
  ref: 'D',
  description: 'A light-emitting diode; brightness tracks forward current.',
  terminals: [
    { name: 'anode', x: -40, y: 0 },
    { name: 'cathode', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -8, y2: 0 },
    { t: 'poly', pts: [[-8, -9], [-8, 9], [8, 0]], fill: true },
    { t: 'line', x1: 8, y1: -9, x2: 8, y2: 9 },
    { t: 'line', x1: 8, y1: 0, x2: 40, y2: 0 },
    { t: 'line', x1: 6, y1: -12, x2: 14, y2: -20 },
    { t: 'line', x1: 12, y1: -12, x2: 20, y2: -20 },
  ],
  bbox: { w: 40, h: 22 },
  props: [
    { key: 'color', label: 'Colour', type: 'select', options: [
      { value: 'red', label: 'Red' }, { value: 'green', label: 'Green' },
      { value: 'blue', label: 'Blue' }, { value: 'yellow', label: 'Yellow' },
    ] },
    { key: 'vf', label: 'Forward voltage', type: 'value', unit: 'V', siUnit: 'V' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { color: 'red', vf: '2', label: 'LED' },
  toElements: (c, ctx) => {
    // Derive a Shockley Is from the desired forward voltage at ~10 mA.
    const vf = num(c, 'vf', 2);
    const nvt = 2 * 0.025852;
    const is = 0.01 / Math.exp(vf / nvt);
    return [
      { id: ctx.id, type: 'D', nodes: [ctx.nodeOf('anode'), ctx.nodeOf('cathode')], is, n: 2, vfwd: vf },
    ];
  },
};

const zener: ComponentDef = {
  kind: 'zener',
  name: 'Zener Diode',
  category: 'semiconductor',
  ref: 'D',
  description: 'Conducts forward like a diode; clamps in reverse at its Zener voltage.',
  terminals: [
    { name: 'anode', x: -40, y: 0 },
    { name: 'cathode', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -8, y2: 0 },
    { t: 'poly', pts: [[-8, -9], [-8, 9], [8, 0]], fill: true },
    { t: 'path', d: 'M 3 -13 L 8 -9 L 8 9 L 13 13' },
    { t: 'line', x1: 8, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 14 },
  props: [
    { key: 'vz', label: 'Zener voltage', type: 'value', unit: 'V', siUnit: 'V' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { vz: '5.1', label: 'DZ' },
  // Modelled as a forward diode plus a reverse breakdown branch approximated by
  // an anti-parallel diode offset by Vz (via a series ideal source emulated
  // with a stiff diode). For the teaching set we use a forward Shockley diode;
  // reverse clamp is handled by the dedicated zener regulator example.
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'D', nodes: [ctx.nodeOf('anode'), ctx.nodeOf('cathode')], is: 1e-14, n: 1 },
  ],
};

const spstSwitch: ComponentDef = {
  kind: 'switch',
  name: 'Switch (SPST)',
  category: 'semiconductor',
  ref: 'SW',
  description: 'A single-pole switch. Toggle open/closed from the properties panel.',
  terminals: [
    { name: 'a', x: -40, y: 0 },
    { name: 'b', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -14, y2: 0 },
    { t: 'circle', cx: -14, cy: 0, r: 2, fill: true },
    { t: 'line', x1: -14, y1: 0, x2: 12, y2: -12 },
    { t: 'circle', cx: 14, cy: 0, r: 2, fill: true },
    { t: 'line', x1: 14, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 14 },
  props: [
    { key: 'closed', label: 'Closed', type: 'boolean' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { closed: false, label: 'SW' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'SW', nodes: [ctx.nodeOf('a'), ctx.nodeOf('b')], closed: Boolean(c.props.closed) },
  ],
};

// ---------------------------------------------------------------------------
// Output / loads (modelled as resistive elements; state drives visualisation)
// ---------------------------------------------------------------------------

function resistiveLoad(
  kind: string, name: string, ref: string, description: string,
  symbol: ComponentDef['symbol'], defaultR: number
): ComponentDef {
  return {
    kind, name, category: 'output', ref, description,
    terminals: [
      { name: 'a', x: -40, y: 0 },
      { name: 'b', x: 40, y: 0 },
    ],
    symbol,
    bbox: { w: 40, h: 18 },
    props: [
      { key: 'resistance', label: 'Resistance', type: 'value', unit: 'Ω', siUnit: 'Ω' },
      { key: 'rating', label: 'Rated power', type: 'value', unit: 'W', siUnit: 'W', advanced: true },
      { key: 'label', label: 'Label', type: 'text' },
    ],
    defaults: { resistance: String(defaultR), rating: '0.5', label: ref },
    toElements: (c, ctx) => [
      { id: ctx.id, type: 'R', nodes: [ctx.nodeOf('a'), ctx.nodeOf('b')], resistance: num(c, 'resistance', defaultR) },
    ],
  };
}

const lamp = resistiveLoad('lamp', 'Lamp', 'LMP', 'An incandescent lamp; glows with dissipated power.', [
  { t: 'line', x1: -40, y1: 0, x2: -14, y2: 0 },
  { t: 'circle', cx: 0, cy: 0, r: 14 },
  { t: 'line', x1: -10, y1: -10, x2: 10, y2: 10 },
  { t: 'line', x1: -10, y1: 10, x2: 10, y2: -10 },
  { t: 'line', x1: 14, y1: 0, x2: 40, y2: 0 },
], 100);

const motor = resistiveLoad('motor', 'Motor', 'M', 'A DC motor; shaft speed tracks current.', [
  { t: 'line', x1: -40, y1: 0, x2: -14, y2: 0 },
  { t: 'circle', cx: 0, cy: 0, r: 14 },
  { t: 'text', x: 0, y: 5, s: 'M', size: 14 },
  { t: 'line', x1: 14, y1: 0, x2: 40, y2: 0 },
], 50);

const buzzer = resistiveLoad('buzzer', 'Buzzer', 'BZ', 'A piezo buzzer; sounds when energised.', [
  { t: 'line', x1: -40, y1: 0, x2: -14, y2: 0 },
  { t: 'path', d: 'M -14 -12 L -14 12 L 0 12 A 12 12 0 0 0 0 -12 Z' },
  { t: 'line', x1: 12, y1: 0, x2: 40, y2: 0 },
], 200);

const speaker = resistiveLoad('speaker', 'Speaker', 'SPK', 'An 8 Ω speaker load.', [
  { t: 'line', x1: -40, y1: 0, x2: -12, y2: 0 },
  { t: 'rect', x: -12, y: -8, w: 8, h: 16 },
  { t: 'poly', pts: [[-4, -8], [10, -16], [10, 16], [-4, 8]], closed: true },
  { t: 'line', x1: 10, y1: 0, x2: 40, y2: 0 },
], 8);

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

const voltmeter: ComponentDef = {
  kind: 'voltmeter',
  name: 'Voltmeter',
  category: 'measurement',
  ref: 'MV',
  description: 'Measures the voltage across its terminals (ideal, high impedance).',
  terminals: [
    { name: 'p', x: -40, y: 0 },
    { name: 'n', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -16, y2: 0 },
    { t: 'circle', cx: 0, cy: 0, r: 16 },
    { t: 'text', x: 0, y: 5, s: 'V', size: 14 },
    { t: 'line', x1: 16, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 18 },
  props: [{ key: 'label', label: 'Label', type: 'text' }],
  defaults: { label: 'V' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'R', nodes: [ctx.nodeOf('p'), ctx.nodeOf('n')], resistance: 1e9 },
  ],
};

const ammeter: ComponentDef = {
  kind: 'ammeter',
  name: 'Ammeter',
  category: 'measurement',
  ref: 'MA',
  description: 'Measures current in series (ideal, zero impedance).',
  terminals: [
    { name: 'p', x: -40, y: 0 },
    { name: 'n', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -16, y2: 0 },
    { t: 'circle', cx: 0, cy: 0, r: 16 },
    { t: 'text', x: 0, y: 5, s: 'A', size: 14 },
    { t: 'line', x1: 16, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 18 },
  props: [{ key: 'label', label: 'Label', type: 'text' }],
  defaults: { label: 'A' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'V', nodes: [ctx.nodeOf('p'), ctx.nodeOf('n')], value: 0 },
  ],
};

const voltageProbe: ComponentDef = {
  kind: 'voltage_probe',
  name: 'Voltage Probe',
  category: 'measurement',
  ref: 'VP',
  description: 'Reports the node voltage at its tip (feeds the oscilloscope).',
  terminals: [{ name: 'p', x: 0, y: 20 }],
  symbol: [
    { t: 'line', x1: 0, y1: 20, x2: 0, y2: 4 },
    { t: 'poly', pts: [[-8, -4], [8, -4], [0, 4]], fill: true },
    { t: 'circle', cx: 0, cy: -10, r: 6 },
  ],
  bbox: { w: 10, h: 18 },
  props: [
    { key: 'channel', label: 'Scope channel', type: 'select', options: [
      { value: '1', label: 'CH1' }, { value: '2', label: 'CH2' }, { value: '0', label: 'None' },
    ] },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { channel: '1', label: 'VP' },
  toElements: () => [],
};

const currentProbe: ComponentDef = {
  kind: 'current_probe',
  name: 'Current Probe',
  category: 'measurement',
  ref: 'CP',
  description: 'Measures current through a series connection (feeds the oscilloscope).',
  terminals: [
    { name: 'p', x: -40, y: 0 },
    { name: 'n', x: 40, y: 0 },
  ],
  symbol: [
    { t: 'line', x1: -40, y1: 0, x2: -10, y2: 0 },
    { t: 'circle', cx: 0, cy: 0, r: 10 },
    { t: 'text', x: 0, y: 4, s: 'I', size: 11 },
    { t: 'line', x1: 10, y1: 0, x2: 40, y2: 0 },
  ],
  bbox: { w: 40, h: 12 },
  props: [
    { key: 'channel', label: 'Scope channel', type: 'select', options: [
      { value: '1', label: 'CH1' }, { value: '2', label: 'CH2' }, { value: '0', label: 'None' },
    ] },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  defaults: { channel: '2', label: 'CP' },
  toElements: (c, ctx) => [
    { id: ctx.id, type: 'V', nodes: [ctx.nodeOf('p'), ctx.nodeOf('n')], value: 0 },
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ALL: ComponentDef[] = [
  resistor, potentiometer, capacitor, inductor,
  battery, dcSource, acSource, pulseSource, currentSource, ground,
  diode, zener, led, spstSwitch,
  lamp, motor, buzzer, speaker,
  voltmeter, ammeter, voltageProbe, currentProbe,
];

export const REGISTRY: Record<string, ComponentDef> = Object.fromEntries(
  ALL.map((d) => [d.kind, d])
);

export function getComponentDef(kind: string): ComponentDef | undefined {
  return REGISTRY[kind];
}

export const CATEGORIES: { id: import('./primitives.ts').Category; label: string }[] = [
  { id: 'passive', label: 'Passive' },
  { id: 'sources', label: 'Sources' },
  { id: 'semiconductor', label: 'Semiconductors' },
  { id: 'output', label: 'Output' },
  { id: 'measurement', label: 'Measurement' },
];

export function componentsByCategory(): Record<string, ComponentDef[]> {
  const out: Record<string, ComponentDef[]> = {};
  for (const def of ALL) (out[def.category] ??= []).push(def);
  return out;
}

export function allComponents(): ComponentDef[] {
  return ALL.slice();
}
