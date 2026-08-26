/**
 * Editor-facing circuit data model.
 *
 * This is what the schematic editor manipulates and what gets serialised to
 * IndexedDB / share URLs. It is intentionally separate from the solver netlist:
 * `compileNetlist` turns this geometric description into electrical nodes.
 */

export type Rotation = 0 | 90 | 180 | 270;

export interface PlacedComponent {
  id: string;
  kind: string; // registry key, e.g. 'resistor'
  x: number; // grid-snapped canvas position (px)
  y: number;
  rotation: Rotation;
  flip: boolean;
  props: Record<string, string | number | boolean>;
}

export interface Wire {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Circuit {
  schemaVersion: 1;
  components: PlacedComponent[];
  wires: Wire[];
}

export interface CircuitMeta {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
}

export interface StoredCircuit extends CircuitMeta {
  circuit: Circuit;
}

export function emptyCircuit(): Circuit {
  return { schemaVersion: 1, components: [], wires: [] };
}

/** Absolute position of a component terminal after rotation + flip. */
export function terminalPosition(
  comp: PlacedComponent,
  local: { x: number; y: number }
): { x: number; y: number } {
  let { x, y } = local;
  if (comp.flip) x = -x;
  switch (comp.rotation) {
    case 90:
      [x, y] = [-y, x];
      break;
    case 180:
      [x, y] = [-x, -y];
      break;
    case 270:
      [x, y] = [y, -x];
      break;
  }
  return { x: comp.x + x, y: comp.y + y };
}
