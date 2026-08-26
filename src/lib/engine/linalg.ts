/**
 * Dense linear algebra for the circuit solver.
 *
 * Two solvers live here:
 *  - `solve`      : real-valued Ax = b via LU decomposition with partial pivoting.
 *  - `solveComplex`: complex-valued Ax = b (used by AC analysis).
 *
 * Both operate on flat, mutable arrays for speed; they are deliberately free of
 * any circuit or UI concept so they can be unit-tested in isolation.
 */

/** Solve a real dense system A·x = b. `A` is row-major n×n, `b` length n. */
export function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Work on copies so callers can reuse their matrices.
  const M = A.map((row) => row.slice());
  const x = b.slice();

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the largest magnitude entry in this column.
    let pivot = col;
    let max = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > max) {
        max = v;
        pivot = r;
      }
    }
    if (max < 1e-14) {
      // Singular (or near-singular) matrix — no unique solution.
      return null;
    }
    if (pivot !== col) {
      const tmp = M[pivot];
      M[pivot] = M[col];
      M[col] = tmp;
      const tb = x[pivot];
      x[pivot] = x[col];
      x[col] = tb;
    }

    // Eliminate below the pivot.
    const pivVal = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivVal;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) {
        M[r][c] -= factor * M[col][c];
      }
      x[r] -= factor * x[col];
    }
  }

  // Back substitution.
  const out = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = x[row];
    for (let c = row + 1; c < n; c++) {
      sum -= M[row][c] * out[c];
    }
    out[row] = sum / M[row][row];
  }

  for (const v of out) {
    if (!Number.isFinite(v)) return null;
  }
  return out;
}

/** A complex number as a [real, imaginary] tuple. */
export type Complex = [number, number];

export function cAdd(a: Complex, b: Complex): Complex {
  return [a[0] + b[0], a[1] + b[1]];
}
export function cSub(a: Complex, b: Complex): Complex {
  return [a[0] - b[0], a[1] - b[1]];
}
export function cMul(a: Complex, b: Complex): Complex {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}
export function cDiv(a: Complex, b: Complex): Complex {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
}
export function cAbs(a: Complex): number {
  return Math.hypot(a[0], a[1]);
}
/** Phase in degrees. */
export function cPhaseDeg(a: Complex): number {
  return (Math.atan2(a[1], a[0]) * 180) / Math.PI;
}

/** Solve a complex dense system A·x = b (Gaussian elimination, partial pivot). */
export function solveComplex(A: Complex[][], b: Complex[]): Complex[] | null {
  const n = b.length;
  const M = A.map((row) => row.map((c) => [c[0], c[1]] as Complex));
  const x = b.map((c) => [c[0], c[1]] as Complex);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let max = cAbs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = cAbs(M[r][col]);
      if (v > max) {
        max = v;
        pivot = r;
      }
    }
    if (max < 1e-14) return null;
    if (pivot !== col) {
      [M[pivot], M[col]] = [M[col], M[pivot]];
      [x[pivot], x[col]] = [x[col], x[pivot]];
    }

    const pivVal = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = cDiv(M[r][col], pivVal);
      for (let c = col; c < n; c++) {
        M[r][c] = cSub(M[r][c], cMul(factor, M[col][c]));
      }
      x[r] = cSub(x[r], cMul(factor, x[col]));
    }
  }

  const out: Complex[] = new Array(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = x[row];
    for (let c = row + 1; c < n; c++) {
      sum = cSub(sum, cMul(M[row][c], out[c]));
    }
    out[row] = cDiv(sum, M[row][row]);
  }
  return out;
}
