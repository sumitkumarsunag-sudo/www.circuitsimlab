/**
 * Every prebuilt example must compile to a valid, solvable circuit — no
 * floating nodes, no singular matrices — and match the headline result the
 * example page advertises. This keeps the "no fake results" promise honest.
 */
import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '../src/lib/content/examples.ts';
import { compileNetlist } from '../src/lib/circuit/netlist.ts';
import { validate } from '../src/lib/circuit/validate.ts';
import { dcOperatingPoint } from '../src/lib/engine/dc.ts';

describe('example circuits', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.slug} compiles without errors`, () => {
      const circuit = ex.build();
      const compiled = compileNetlist(circuit);
      const errors = validate(circuit, compiled).filter((i) => i.severity === 'error');
      expect(errors, errors.map((e) => e.message).join('; ')).toHaveLength(0);
      expect(compiled.groundNode).toBe(0);
    });

    it(`${ex.slug} solves at the DC operating point`, () => {
      const compiled = compileNetlist(ex.build());
      const dc = dcOperatingPoint(compiled.netlist);
      expect(dc.ok, dc.error).toBe(true);
    });
  }

  it('voltage divider splits the supply in half', () => {
    const compiled = compileNetlist(EXAMPLES.find((e) => e.slug === 'voltage-divider')!.build());
    const dc = dcOperatingPoint(compiled.netlist);
    // Midpoint node should read 6 V within tolerance.
    expect(dc.nodeVoltages.some((v) => Math.abs(v - 6) < 0.01)).toBe(true);
  });

  it('series resistors carry 2 mA', () => {
    const compiled = compileNetlist(EXAMPLES.find((e) => e.slug === 'series-resistors')!.build());
    const dc = dcOperatingPoint(compiled.netlist);
    const mags = Object.values(dc.currents).map(Math.abs);
    expect(mags.every((i) => Math.abs(i - 0.002) < 1e-5)).toBe(true);
  });
});
