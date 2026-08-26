/**
 * Engineering-notation parsing and formatting.
 *
 * Accepts human input like "1k", "4.7k", "10u", "47n", "100p", "2.2M",
 * "1meg", "100m", optionally followed by a unit ("1kΩ", "10uF", "5V") and
 * returns the numeric SI value. Formatting picks the natural SI prefix so a
 * resistance reads as "4.7 kΩ" rather than "4700 Ω".
 */

const PREFIXES: Record<string, number> = {
  f: 1e-15,
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6, // note: SPICE-style "meg" handled below; bare M treated as mega here
  G: 1e9,
  T: 1e12,
};

/** Parse an engineering-notation string into a plain SI number, or null. */
export function parseEng(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === '') return null;
  s = s.replace(/,/g, '');

  // Strip a trailing unit symbol (Ω, F, H, V, A, Hz, s, W, ohm, etc.).
  s = s.replace(/\s*(ohm|Ω|farad|henry|hz|f|h|v|a|s|w)\.?$/i, '').trim();

  // SPICE "meg".
  const megMatch = s.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*meg$/i);
  if (megMatch) return parseFloat(megMatch[1]) * 1e6;

  const m = s.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*([fpnuµmkKMGT]?)$/);
  if (!m) {
    const num = parseFloat(s);
    return Number.isFinite(num) ? num : null;
  }
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  const prefix = m[2];
  return prefix ? value * PREFIXES[prefix] : value;
}

const FORMAT_PREFIXES: [number, string][] = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
  [1e-15, 'f'],
];

/** Format an SI number with an engineering prefix and optional unit. */
export function formatEng(value: number, unit = '', sig = 4): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return `0${unit ? ' ' + unit : ''}`;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  let chosen: [number, string] = [1, ''];
  for (const p of FORMAT_PREFIXES) {
    if (abs >= p[0]) {
      chosen = p;
      break;
    }
    chosen = p;
  }
  const scaled = abs / chosen[0];
  const num = trimZeros(scaled.toPrecision(sig));
  return `${sign}${num} ${chosen[1]}${unit}`.trimEnd();
}

function trimZeros(s: string): string {
  if (s.indexOf('.') === -1) return s;
  return s.replace(/\.?0+$/, '');
}

/** Format a voltage, current or similar for compact on-canvas overlays. */
export function formatValue(value: number, unit: string): string {
  return formatEng(value, unit, 3);
}
