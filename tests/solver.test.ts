import { describe, it, expect } from 'vitest';
import { dcOperatingPoint } from '../src/lib/engine/dc.ts';
import { transientAnalysis } from '../src/lib/engine/transient.ts';
import { acAnalysis } from '../src/lib/engine/ac.ts';
import type { Netlist } from '../src/lib/engine/types.ts';
import { parseEng, formatEng } from '../src/lib/units.ts';

describe('DC operating point', () => {
  it('solves Ohm’s law: 10 V across 1 kΩ → 10 mA', () => {
    // Node 1 = source +, node 0 = ground.
    const net: Netlist = {
      nodeCount: 2,
      elements: [
        { id: 'V1', type: 'V', nodes: [1, 0], value: 10 },
        { id: 'R1', type: 'R', nodes: [1, 0], resistance: 1000 },
      ],
    };
    const r = dcOperatingPoint(net);
    expect(r.ok).toBe(true);
    expect(r.nodeVoltages[1]).toBeCloseTo(10, 6);
    expect(r.currents['R1']).toBeCloseTo(0.01, 9);
    // Source delivers 100 mW.
    expect(r.totalPower).toBeCloseTo(0.1, 6);
  });

  it('computes a resistive voltage divider', () => {
    // 12 V, R1 (node1→node2) = 2k, R2 (node2→gnd) = 1k → node2 = 4 V.
    const net: Netlist = {
      nodeCount: 3,
      elements: [
        { id: 'V1', type: 'V', nodes: [1, 0], value: 12 },
        { id: 'R1', type: 'R', nodes: [1, 2], resistance: 2000 },
        { id: 'R2', type: 'R', nodes: [2, 0], resistance: 1000 },
      ],
    };
    const r = dcOperatingPoint(net);
    expect(r.nodeVoltages[2]).toBeCloseTo(4, 6);
    expect(r.currents['R1']).toBeCloseTo(0.004, 9);
  });

  it('parallel resistors share current correctly', () => {
    // 6 V across 1k || 2k. I(1k)=6mA, I(2k)=3mA, total 9mA.
    const net: Netlist = {
      nodeCount: 2,
      elements: [
        { id: 'V1', type: 'V', nodes: [1, 0], value: 6 },
        { id: 'R1', type: 'R', nodes: [1, 0], resistance: 1000 },
        { id: 'R2', type: 'R', nodes: [1, 0], resistance: 2000 },
      ],
    };
    const r = dcOperatingPoint(net);
    expect(r.currents['R1']).toBeCloseTo(0.006, 9);
    expect(r.currents['R2']).toBeCloseTo(0.003, 9);
  });

  it('solves a diode + resistor (forward drop ~0.6–0.75 V)', () => {
    // 5 V → 1k → diode → gnd.
    const net: Netlist = {
      nodeCount: 3,
      elements: [
        { id: 'V1', type: 'V', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'R', nodes: [1, 2], resistance: 1000 },
        { id: 'D1', type: 'D', nodes: [2, 0], is: 1e-14, n: 1 },
      ],
    };
    const r = dcOperatingPoint(net);
    expect(r.ok).toBe(true);
    const vd = r.nodeVoltages[2];
    expect(vd).toBeGreaterThan(0.55);
    expect(vd).toBeLessThan(0.8);
    // Current is roughly (5 - Vd)/1k.
    expect(r.currents['R1']).toBeCloseTo((5 - vd) / 1000, 6);
  });

  it('reports a floating/singular circuit as not ok', () => {
    // A current source into an open node has no consistent solution.
    const net: Netlist = {
      nodeCount: 2,
      elements: [{ id: 'I1', type: 'I', nodes: [1, 0], value: 1e-3 }],
    };
    const r = dcOperatingPoint(net);
    expect(r.ok).toBe(false);
  });
});

describe('Transient analysis', () => {
  it('RC charging reaches ~63.2% of V after one time constant', () => {
    // 10 V → 1k → cap 1uF to gnd. τ = 1ms.
    const R = 1000;
    const C = 1e-6;
    const tau = R * C;
    const net: Netlist = {
      nodeCount: 3,
      elements: [
        { id: 'V1', type: 'V', nodes: [1, 0], value: 10 },
        { id: 'R1', type: 'R', nodes: [1, 2], resistance: R },
        { id: 'C1', type: 'C', nodes: [2, 0], capacitance: C, ic: 0 },
      ],
    };
    const res = transientAnalysis(net, { tStop: 5 * tau, tStep: tau / 500 });
    expect(res.ok).toBe(true);
    // Find the point closest to t = tau.
    const pt = res.points.reduce((a, b) => (Math.abs(b.t - tau) < Math.abs(a.t - tau) ? b : a));
    expect(pt.nodeVoltages[2]).toBeGreaterThan(10 * 0.60);
    expect(pt.nodeVoltages[2]).toBeLessThan(10 * 0.66);
    // Steady state approaches 10 V.
    const last = res.points[res.points.length - 1];
    expect(last.nodeVoltages[2]).toBeGreaterThan(9.8);
  });
});

describe('AC analysis', () => {
  it('RC low-pass is ~-3 dB at its cutoff frequency', () => {
    // R=1k, C=1uF → fc = 1/(2πRC) ≈ 159.15 Hz.
    const R = 1000;
    const C = 1e-6;
    const fc = 1 / (2 * Math.PI * R * C);
    const net: Netlist = {
      nodeCount: 3,
      elements: [
        { id: 'V1', type: 'V', nodes: [1, 0], value: 0, acMag: 1, acPhase: 0 },
        { id: 'R1', type: 'R', nodes: [1, 2], resistance: R },
        { id: 'C1', type: 'C', nodes: [2, 0], capacitance: C },
      ],
    };
    const res = acAnalysis(net, { fStart: fc / 100, fStop: fc * 100, pointsPerDecade: 40 });
    expect(res.ok).toBe(true);
    // Point nearest cutoff.
    const pt = res.points.reduce((a, b) => (Math.abs(b.freq - fc) < Math.abs(a.freq - fc) ? b : a));
    const dB = 20 * Math.log10(pt.nodeMag[2]);
    expect(dB).toBeGreaterThan(-3.5);
    expect(dB).toBeLessThan(-2.5);
    // Well below cutoff the output tracks the input (~0 dB).
    const low = res.points[0];
    expect(low.nodeMag[2]).toBeGreaterThan(0.98);
  });
});

describe('Engineering notation', () => {
  it('parses common values', () => {
    expect(parseEng('1k')).toBe(1000);
    expect(parseEng('4.7k')).toBeCloseTo(4700);
    expect(parseEng('10u')).toBeCloseTo(1e-5);
    expect(parseEng('47n')).toBeCloseTo(47e-9);
    expect(parseEng('100p')).toBeCloseTo(100e-12);
    expect(parseEng('2.2M')).toBeCloseTo(2.2e6);
    expect(parseEng('1meg')).toBeCloseTo(1e6);
    expect(parseEng('1kΩ')).toBe(1000);
    expect(parseEng('5V')).toBe(5);
    expect(parseEng('100m')).toBeCloseTo(0.1);
  });

  it('formats values with SI prefixes', () => {
    expect(formatEng(4700, 'Ω')).toBe('4.7 kΩ');
    expect(formatEng(0.01, 'A')).toBe('10 mA');
    expect(formatEng(1e6, 'Ω')).toBe('1 MΩ');
    expect(formatEng(0, 'V')).toBe('0 V');
  });
});
