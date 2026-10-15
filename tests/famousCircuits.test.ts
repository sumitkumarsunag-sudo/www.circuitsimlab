/**
 * The parts palette offers famous circuits that drop onto the canvas in one
 * tap. Every one of them must compile with no errors, ground cleanly and
 * actually solve — and the headline numbers have to match what the palette
 * promises, so the "no fake results" rule holds here too.
 */
import { describe, it, expect } from 'vitest';
import { FAMOUS_CIRCUITS } from '../src/lib/content/famousCircuits.ts';
import { compileNetlist } from '../src/lib/circuit/netlist.ts';
import { validate } from '../src/lib/circuit/validate.ts';
import { dcOperatingPoint } from '../src/lib/engine/dc.ts';
import { runSimulation } from '../src/components/editor/sim.ts';
import type { Circuit } from '../src/lib/circuit/types.ts';

const byId = (id: string) => FAMOUS_CIRCUITS.find((c) => c.id === id)!;
const labelId = (c: Circuit, label: string) => c.components.find((x) => x.props.label === label)!.id;

function solveDc(c: Circuit) {
  const compiled = compileNetlist(c);
  const dc = dcOperatingPoint(compiled.netlist);
  return { compiled, dc };
}

describe('famous circuits in the parts palette', () => {
  it('ships a handful of circuits, both DC and transient', () => {
    expect(FAMOUS_CIRCUITS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(FAMOUS_CIRCUITS.map((c) => c.id)).size).toBe(FAMOUS_CIRCUITS.length);
    expect(FAMOUS_CIRCUITS.some((c) => c.mode === 'dc')).toBe(true);
    expect(FAMOUS_CIRCUITS.some((c) => c.mode === 'transient')).toBe(true);
  });

  for (const c of FAMOUS_CIRCUITS) {
    it(`${c.name} compiles without errors`, () => {
      const circuit = c.build();
      const compiled = compileNetlist(circuit);
      const errors = validate(circuit, compiled).filter((i) => i.severity === 'error');
      expect(errors, errors.map((e) => e.message).join('; ')).toHaveLength(0);
      expect(compiled.groundNode).toBe(0);
    });

    if (c.mode === 'dc') {
      it(`${c.name} solves at the DC operating point`, () => {
        const { dc } = solveDc(c.build());
        expect(dc.ok, dc.error).toBe(true);
      });
    } else {
      it(`${c.name} runs the transient analysis`, async () => {
        const res = await runSimulation(c.build(), 'transient', { tStop: 0.05, tStep: 0.0001 });
        expect(res.ok, res.error ?? '').toBe(true);
        expect(res.transient?.points.length ?? 0).toBeGreaterThan(0);
      });
    }
  }

  it('Wheatstone bridge divides the supply across both legs', () => {
    const c = byId('wheatstone-bridge').build();
    const { compiled, dc } = solveDc(c);
    expect(dc.ok, dc.error).toBe(true);
    const node = (label: string, term: string) => compiled.nodeMap.get(labelId(c, label))!.get(term)!;
    expect(dc.nodeVoltages[node('R1', 'a')]).toBeCloseTo(10, 2);
    // Left leg 2.2k/1k, right leg 4.7k/1k — the mid points sit at 3.125 V and 1.754 V.
    expect(dc.nodeVoltages[node('R1', 'b')]).toBeCloseTo(10 / 3.2, 2);
    expect(dc.nodeVoltages[node('R3', 'b')]).toBeCloseTo(10 / 5.7, 2);
  });

  it('current divider splits 10 mA into 7.5 mA and 2.5 mA', () => {
    const c = byId('current-divider').build();
    const { dc } = solveDc(c);
    expect(dc.ok, dc.error).toBe(true);
    expect(Math.abs(dc.currents[labelId(c, 'R1')])).toBeCloseTo(0.0075, 6);
    expect(Math.abs(dc.currents[labelId(c, 'R2')])).toBeCloseTo(0.0025, 6);
  });

  it('lamp dimmer pushes the expected current through the lamp', () => {
    const c = byId('lamp-dimmer').build();
    const { dc } = solveDc(c);
    expect(dc.ok, dc.error).toBe(true);
    // 12 V across 0.6 x 470 Ω of pot plus the 100 Ω lamp.
    expect(Math.abs(dc.currents[labelId(c, 'L1')])).toBeCloseTo(12 / 382, 3);
  });

  it('bridge rectifier turns ±5 V AC into a positive rail', async () => {
    const c = byId('bridge-rectifier').build();
    const res = await runSimulation(c, 'transient', { tStop: 0.05, tStep: 0.0001 });
    expect(res.ok, res.error ?? '').toBe(true);
    const node = res.compiled.nodeMap.get(labelId(c, 'Vout'))!.get('p')!;
    const vs = res.transient!.points.map((p) => p.nodeVoltages[node] ?? 0);
    expect(Math.max(...vs)).toBeGreaterThan(2);
    expect(Math.min(...vs)).toBeGreaterThan(-0.1);
  });

  it('voltage doubler climbs toward twice the AC peak', async () => {
    const c = byId('voltage-doubler').build();
    const res = await runSimulation(c, 'transient', { tStop: 0.05, tStep: 0.0001 });
    expect(res.ok, res.error ?? '').toBe(true);
    const node = res.compiled.nodeMap.get(labelId(c, 'Vout'))!.get('p')!;
    const vs = res.transient!.points.map((p) => p.nodeVoltages[node] ?? 0);
    // 5 V peak in, two diode drops out — the rail settles near 8.6 V.
    expect(Math.max(...vs)).toBeGreaterThan(7.5);
    expect(Math.max(...vs)).toBeLessThan(9.9);
  });

  it('RLC loop responds at resonance', async () => {
    const c = byId('rlc-resonance').build();
    const res = await runSimulation(c, 'transient', { tStop: 0.05, tStep: 0.0001 });
    expect(res.ok, res.error ?? '').toBe(true);
    const node = res.compiled.nodeMap.get(labelId(c, 'Vc'))!.get('p')!;
    const vs = res.transient!.points.map((p) => p.nodeVoltages[node] ?? 0);
    expect(Math.max(...vs.map(Math.abs))).toBeGreaterThan(0.5);
  });
});
