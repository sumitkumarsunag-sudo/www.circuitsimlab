/**
 * Circuit serialisation and shareable-URL encoding.
 *
 * The JSON form is the canonical storage format. Share URLs embed a compact
 * base64url payload after `#` so no server round-trip is needed to reconstruct
 * a circuit (`/s/<id>` pages read the fragment on load).
 */
import type { Circuit } from './types.ts';
import { emptyCircuit } from './types.ts';

export function serializeCircuit(circuit: Circuit): string {
  return JSON.stringify(circuit);
}

export function deserializeCircuit(json: string): Circuit {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return emptyCircuit();
    return normalize(parsed);
  } catch {
    return emptyCircuit();
  }
}

/** Coerce arbitrary parsed data into a valid Circuit (defensive). */
export function normalize(data: unknown): Circuit {
  const d = data as Partial<Circuit>;
  const components = Array.isArray(d.components)
    ? d.components.filter((c) => c && typeof c.kind === 'string')
    : [];
  const wires = Array.isArray(d.wires) ? d.wires.filter((w) => w && typeof w.x1 === 'number') : [];
  return { schemaVersion: 1, components: components as Circuit['components'], wires: wires as Circuit['wires'] };
}

// --- UTF-8 safe base64url ---------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodeShare(circuit: Circuit): string {
  const json = serializeCircuit(circuit);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(bytes);
}

export function decodeShare(payload: string): Circuit {
  try {
    const bytes = fromBase64Url(payload);
    const json = new TextDecoder().decode(bytes);
    return deserializeCircuit(json);
  } catch {
    return emptyCircuit();
  }
}

/** A short id for /s/<id> style links (local, non-cryptographic). */
export function shortId(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}
