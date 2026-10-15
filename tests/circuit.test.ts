import { describe, it, expect } from 'vitest';
import { compileNetlist } from '../src/lib/circuit/netlist.ts';
import { validate } from '../src/lib/circuit/validate.ts';
import { dcOperatingPoint } from '../src/lib/engine/dc.ts';
import { runSimulation } from '../src/components/editor/sim.ts';
import type { Circuit } from '../src/lib/circuit/types.ts';

/** Build the canonical 9 V battery → 1 kΩ → ground loop from geometry. */
function batteryResistorGround(): Circuit {
  return {
    schemaVersion: 1,
    components: [
      // Battery: pos (-40,0)->(160,100), neg (40,0)->(240,100)
      { id: 'BAT', kind: 'battery', x: 200, y: 100, rotation: 0, flip: false, props: { value: '9' } },
      // Resistor: a (160,20), b (240,20)
      { id: 'R1', kind: 'resistor', x: 200, y: 20, rotation: 0, flip: false, props: { resistance: '1k' } },
      // Ground: p (0,-20)->(240,120)
      { id: 'GND', kind: 'ground', x: 240, y: 140, rotation: 0, flip: false, props: {} },
    ],
    wires: [
      { id: 'w1', x1: 160, y1: 100, x2: 160, y2: 20 }, // bat pos -> R.a
      { id: 'w2', x1: 240, y1: 20, x2: 240, y2: 100 }, // R.b -> bat neg
      { id: 'w3', x1: 240, y1: 100, x2: 240, y2: 120 }, // bat neg -> ground
    ],
  };
}

describe('Netlist compiler', () => {
  it('resolves nodes from geometry and solves the loop', () => {
    const compiled = compileNetlist(batteryResistorGround());
    // Ground plus one live node.
    expect(compiled.netlist.nodeCount).toBe(2);
    const issues = validate(batteryResistorGround(), compiled);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);

    const r = dcOperatingPoint(compiled.netlist);
    expect(r.ok).toBe(true);
    // 9 V / 1 kΩ = 9 mA through the resistor.
    expect(Math.abs(r.currents['R1'])).toBeCloseTo(0.009, 6);
  });

  it('runs without a ground symbol, leaving only a friendly hint', () => {
    const c = batteryResistorGround();
    c.components = c.components.filter((x) => x.kind !== 'ground');
    const compiled = compileNetlist(c);
    expect(compiled.implicitGround).toBe(true);
    expect(compiled.groundNode).toBe(0);

    const issues = validate(c, compiled);
    // Nothing blocks the run: a missing ground is a hint, not an error.
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(issues.some((i) => /ground/i.test(i.message))).toBe(true);

    // Voltage differences are unaffected by the chosen reference.
    const r = dcOperatingPoint(compiled.netlist);
    expect(r.ok).toBe(true);
    expect(Math.abs(r.currents['R1'])).toBeCloseTo(0.009, 6);
  });

  it('runSimulation still returns a result with no ground placed', async () => {
    const c = batteryResistorGround();
    c.components = c.components.filter((x) => x.kind !== 'ground');
    const result = await runSimulation(c, 'dc');
    expect(result.ok).toBe(true);
    expect(result.compiled.implicitGround).toBe(true);
    expect(result.issues.some((i) => i.severity === 'error')).toBe(false);
  });

  it('stays quiet about a part that is dropped but not connected yet', () => {
    const c = batteryResistorGround();
    // A spare resistor sitting off on its own, touching nothing.
    c.components.push({ id: 'R9', kind: 'resistor', x: 600, y: 600, rotation: 0, flip: false, props: { resistance: '1k' } });
    const compiled = compileNetlist(c);
    const issues = validate(c, compiled);
    expect(issues).toHaveLength(0);
  });

  it('still hints when a wired part has one loose terminal', () => {
    const c = batteryResistorGround();
    c.wires = c.wires.filter((w) => w.id !== 'w2'); // unhook R1.b from the battery
    const compiled = compileNetlist(c);
    const issues = validate(c, compiled);
    expect(issues.some((i) => /terminal "b"/i.test(i.message))).toBe(true);
  });

  it('merges terminals that share a coordinate without a wire', () => {
    // Two resistors touching end-to-end at (240,20)/(240,20).
    const c: Circuit = {
      schemaVersion: 1,
      components: [
        { id: 'BAT', kind: 'battery', x: 200, y: 100, rotation: 0, flip: false, props: { value: '10' } },
        { id: 'R1', kind: 'resistor', x: 200, y: 20, rotation: 0, flip: false, props: { resistance: '1k' } },
        { id: 'R2', kind: 'resistor', x: 280, y: 20, rotation: 0, flip: false, props: { resistance: '1k' } },
        { id: 'GND', kind: 'ground', x: 320, y: 140, rotation: 0, flip: false, props: {} },
      ],
      wires: [
        { id: 'w1', x1: 160, y1: 100, x2: 160, y2: 20 }, // bat pos -> R1.a (160,20)
        // R1.b (240,20) meets R2.a (240,20) directly — same coordinate.
        { id: 'w2', x1: 320, y1: 20, x2: 320, y2: 100 }, // R2.b (320,20) -> bat neg (240,100)? no
      ],
    };
    // Fix wire to bat neg (240,100) and ground.
    c.wires = [
      { id: 'w1', x1: 160, y1: 100, x2: 160, y2: 20 },
      { id: 'w3', x1: 320, y1: 20, x2: 320, y2: 120 }, // R2.b -> ground (320,120)
      { id: 'w4', x1: 320, y1: 120, x2: 240, y2: 120 },
      { id: 'w5', x1: 240, y1: 120, x2: 240, y2: 100 }, // -> bat neg
    ];
    const compiled = compileNetlist(c);
    const r = dcOperatingPoint(compiled.netlist);
    expect(r.ok).toBe(true);
    // 10 V across 2 kΩ series = 5 mA.
    expect(Math.abs(r.currents['R1'])).toBeCloseTo(0.005, 6);
    expect(Math.abs(r.currents['R2'])).toBeCloseTo(0.005, 6);
  });
});
