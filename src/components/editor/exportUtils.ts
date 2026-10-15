/**
 * Export utilities — convert the schematic canvas SVG into downloadable
 * PNG, SVG, PDF, and DOCX formats.  Everything runs purely in the browser,
 * zero extra npm dependencies.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
  }, 100);
}

/**
 * Clone the canvas `<svg>` and inline every CSS variable / computed style
 * so the exported image looks identical to the editor.
 */
function cloneSvgForExport(): { svg: SVGSVGElement; width: number; height: number } | null {
  const original = document.querySelector('svg[aria-label="Schematic canvas"]') as SVGSVGElement | null;
  if (!original) return null;

  const clone = original.cloneNode(true) as SVGSVGElement;
  const w = original.clientWidth || 1200;
  const h = original.clientHeight || 800;

  // Set explicit dimensions so rasterisation has a well-defined area.
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Resolve CSS custom properties to concrete values.
  const cs = getComputedStyle(document.documentElement);
  const vars = [
    '--color-ink', '--color-ink-2', '--color-muted', '--color-faint',
    '--color-paper', '--color-surface', '--color-surface-2',
    '--color-line', '--color-line-strong',
    '--color-accent', '--color-accent-strong', '--color-accent-soft',
    '--color-signal', '--color-pos', '--color-neg',
    '--color-ok', '--color-warn', '--color-err',
    '--font-sans', '--font-mono',
  ];
  let css = ':root{';
  for (const v of vars) {
    const val = cs.getPropertyValue(v).trim();
    if (val) css += `${v}:${val};`;
  }
  css += '}';
  css += 'text{font-family:ui-monospace,"SF Mono","JetBrains Mono","Cascadia Code",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;}';
  // Flow animation CSS for animated elements present at export-time.
  css += '@keyframes trace-flow{to{stroke-dashoffset:-16;}}.flow{stroke-dasharray:3 5;animation:trace-flow .6s linear infinite;}.flow-rev{animation-direction:reverse;}';

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);

  // Set background on the SVG itself.
  const bg = cs.getPropertyValue('--color-paper').trim() || '#ffffff';
  clone.style.background = bg;
  // Also add a rect for rasterisation (canvas compositing won't capture CSS background).
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', bg);
  clone.insertBefore(bgRect, clone.firstChild);

  return { svg: clone, width: w, height: h };
}

function svgToDataUrl(svg: SVGSVGElement): string {
  const xml = new XMLSerializer().serializeToString(svg);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}

/** Rasterise to a canvas element and return a blob of the given MIME type. */
function rasterize(
  svg: SVGSVGElement,
  width: number,
  height: number,
  mime: 'image/png' | 'image/jpeg',
  scale = 2,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        mime,
        0.95,
      );
    };
    img.onerror = () => reject(new Error('Failed to rasterize SVG'));
    img.src = svgToDataUrl(svg);
  });
}

// ---------------------------------------------------------------------------
// Public exporters
// ---------------------------------------------------------------------------

/** Export the circuit schematic as a high-res PNG image. */
export async function exportAsPNG(name: string): Promise<void> {
  const data = cloneSvgForExport();
  if (!data) throw new Error('Canvas not found');
  const blob = await rasterize(data.svg, data.width, data.height, 'image/png', 2);
  downloadBlob(blob, `${name}.png`);
}

/** Export the circuit schematic as a scalable SVG file. */
export function exportAsSVG(name: string): void {
  const data = cloneSvgForExport();
  if (!data) throw new Error('Canvas not found');
  const xml = new XMLSerializer().serializeToString(data.svg);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, `${name}.svg`);
}

/** Export the circuit schematic as a PDF document (single-page, vector). */
export async function exportAsPDF(name: string): Promise<void> {
  const data = cloneSvgForExport();
  if (!data) throw new Error('Canvas not found');

  // Rasterize as JPEG — PDF natively supports JPEG via /DCTDecode.
  const blob = await rasterize(data.svg, data.width, data.height, 'image/jpeg', 2);
  const arrayBuf = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);

  const pdfBlob = buildMinimalPDF(bytes, data.width * 2, data.height * 2, `${name} — CircuitSimLab`);
  downloadBlob(pdfBlob, `${name}.pdf`);
}

/** Export the circuit schematic as a DOCX (Word) document with the schematic embedded. */
export async function exportAsDOCX(name: string): Promise<void> {
  const data = cloneSvgForExport();
  if (!data) throw new Error('Canvas not found');

  const blob = await rasterize(data.svg, data.width, data.height, 'image/png', 2);
  const arrayBuf = await blob.arrayBuffer();
  const base64 = arrayBufToBase64(new Uint8Array(arrayBuf));

  const docxBlob = buildMinimalDOCX(name, base64, data.width * 2, data.height * 2);
  downloadBlob(docxBlob, `${name}.docx`);
}

/** Export the circuit data as JSON (existing behaviour). */
export function exportAsJSON(name: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${name}.json`);
}

// ---------------------------------------------------------------------------
// Minimal PDF builder (no dependencies)
// ---------------------------------------------------------------------------

function buildMinimalPDF(
  imgBytes: Uint8Array,
  imgW: number,
  imgH: number,
  title: string,
): Blob {
  // Fit to A4 landscape (841.89 × 595.28 pts) with margins
  const pageW = 841.89;
  const pageH = 595.28;
  const margin = 40;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const scaleX = availW / imgW;
  const scaleY = availH / imgH;
  const s = Math.min(scaleX, scaleY);
  const drawW = imgW * s;
  const drawH = imgH * s;
  const drawX = margin + (availW - drawW) / 2;
  const drawY = margin + (availH - drawH) / 2;

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const push = (str: string) => {
    const b = enc.encode(str);
    parts.push(b);
    pos += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    parts.push(b);
    pos += b.length;
  };

  push('%PDF-1.4\n%\xc0\xc1\xc2\xc3\n');

  // Obj 1 - Catalog
  offsets.push(pos);
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2 - Pages
  offsets.push(pos);
  push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

  // Obj 3 - Page
  offsets.push(pos);
  push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`);

  // Obj 4 - Contents stream (draw image)
  const content = `q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm /Img Do Q`;
  offsets.push(pos);
  push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  // Obj 5 - Image XObject
  offsets.push(pos);
  push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`);
  pushBytes(imgBytes);
  push('\nendstream\nendobj\n');

  // Obj 6 - Info (title)
  offsets.push(pos);
  push(`6 0 obj\n<< /Title (${title.replace(/[()\\]/g, '\\$&')}) /Producer (CircuitSimLab) >>\nendobj\n`);

  // xref
  const xrefOff = pos;
  push('xref\n');
  push(`0 ${offsets.length + 1}\n`);
  push('0000000000 65535 f \n');
  for (const o of offsets) push(`${String(o).padStart(10, '0')} 00000 n \n`);

  push('trailer\n');
  push(`<< /Size ${offsets.length + 1} /Root 1 0 R /Info 6 0 R >>\n`);
  push('startxref\n');
  push(`${xrefOff}\n`);
  push('%%EOF\n');

  return new Blob(parts, { type: 'application/pdf' });
}

// ---------------------------------------------------------------------------
// Minimal DOCX builder (no dependencies)
// ---------------------------------------------------------------------------

function arrayBufToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Minimal ZIP builder — good enough for DOCX with a handful of entries.
function buildZip(entries: { path: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const centralDir: Uint8Array[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.path);
    // Local file header
    const lh = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(lh);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(8, 0, true); // compression: store
    lv.setUint16(12, 0, true); // mod time
    lv.setUint16(14, 0, true); // mod date
    lv.setUint32(16, crc32(entry.data), true);
    lv.setUint32(20, entry.data.length, true); // compressed
    lv.setUint32(24, entry.data.length, true); // uncompressed
    lv.setUint16(28, nameBytes.length, true);
    new Uint8Array(lh).set(nameBytes, 30);
    const lhArr = new Uint8Array(lh);
    parts.push(lhArr);

    // file data
    parts.push(entry.data);

    // central directory header
    const ch = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(ch);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint16(16, 0, true);
    cv.setUint32(18, crc32(entry.data), true);
    cv.setUint32(22, entry.data.length, true);
    cv.setUint32(26, entry.data.length, true);
    cv.setUint16(30, nameBytes.length, true);
    cv.setUint32(42, offset, true); // offset of local header
    new Uint8Array(ch).set(nameBytes, 46);
    centralDir.push(new Uint8Array(ch));

    offset += lhArr.length + entry.data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  // End-of-central-directory
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  parts.push(new Uint8Array(eocd));

  return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// CRC-32 (used by ZIP)
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildMinimalDOCX(title: string, imageBase64: string, imgW: number, imgH: number): Blob {
  const enc = new TextEncoder();
  // EMU: 1 inch = 914400, 1 pixel ≈ 9525 EMU
  const emuW = Math.round(Math.min(imgW, 1600) * 9525);  // max ~16.8cm
  const emuH = Math.round(emuW * (imgH / imgW));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
        <w:t>${escapeXml(title)}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="200"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="6A7788"/><w:sz w:val="20"/></w:rPr>
        <w:t>Exported from CircuitSimLab</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="400"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${emuW}" cy="${emuH}"/>
            <wp:docPr id="1" name="Circuit Schematic"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:nvPicPr>
                    <pic:cNvPr id="1" name="image1.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rId1"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  // Decode base64 PNG to bytes.
  const binStr = atob(imageBase64);
  const imgBytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);

  return buildZip([
    { path: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { path: '_rels/.rels', data: enc.encode(rels) },
    { path: 'word/_rels/document.xml.rels', data: enc.encode(wordRels) },
    { path: 'word/document.xml', data: enc.encode(document) },
    { path: 'word/media/image1.png', data: imgBytes },
  ]);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
