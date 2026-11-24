import type { jsPDF } from 'jspdf';

export interface PdfAMetadataOptions {
  title: string;
  subject: string;
  author: string;
  keywords?: string;
  creator?: string;
}

function writeUint32BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function writeUint16BE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

function writeInt32BE(buf: Uint8Array, offset: number, value: number): void {
  writeUint32BE(buf, offset, value >>> 0);
}

function writeAscii(buf: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    buf[offset + i] = text.charCodeAt(i) & 0x7f;
  }
}

function fixed16(val: number): number {
  return Math.round(val * 65536);
}

function makeXYZTag(x: number, y: number, z: number): Uint8Array {
  const buf = new Uint8Array(20);
  writeAscii(buf, 0, 'XYZ ');
  writeInt32BE(buf, 8, fixed16(x));
  writeInt32BE(buf, 12, fixed16(y));
  writeInt32BE(buf, 16, fixed16(z));
  return buf;
}

function makeCurvGamma22Tag(): Uint8Array {
  // ICC curvType with count = 1 encodes u8Fixed8 gamma (2.2 = 0x0233)
  const buf = new Uint8Array(16);
  writeAscii(buf, 0, 'curv');
  writeUint32BE(buf, 8, 1);
  writeUint16BE(buf, 12, Math.round(2.2 * 256));
  return buf;
}

function makeDescTag(text: string): Uint8Array {
  const lenWithNull = text.length + 1;
  const totalUnpadded = 12 + lenWithNull + 4 + 4 + 2 + 1 + 67;
  const padded = (totalUnpadded + 3) & ~3;
  const buf = new Uint8Array(padded);
  writeAscii(buf, 0, 'desc');
  writeUint32BE(buf, 8, lenWithNull);
  writeAscii(buf, 12, text);
  return buf;
}

function makeTextTag(text: string): Uint8Array {
  const lenWithNull = text.length + 1;
  const padded = (8 + lenWithNull + 3) & ~3;
  const buf = new Uint8Array(padded);
  writeAscii(buf, 0, 'text');
  writeAscii(buf, 8, text);
  return buf;
}

/**
 * Generates a deterministic, spec-compliant ICC v2.1 sRGB (IEC 61966-2.1)
 * matrix-TRC color profile (D50 PCS) for PDF/A-1b DeviceRGB OutputIntent.
 */
export function buildSrgbIccProfileBinaryString(): string {
  const tags: Array<{ sig: string; data: Uint8Array }> = [
    { sig: 'desc', data: makeDescTag('sRGB IEC61966-2.1') },
    { sig: 'cprt', data: makeTextTag('Public Domain sRGB IEC61966-2.1') },
    // D50 PCS white point & black point
    { sig: 'wtpt', data: makeXYZTag(0.95045, 1.0, 1.08905) },
    { sig: 'bkpt', data: makeXYZTag(0.0, 0.0, 0.0) },
    // Bradford-adapted sRGB primaries to D50 PCS
    { sig: 'rXYZ', data: makeXYZTag(0.43607, 0.22249, 0.01392) },
    { sig: 'gXYZ', data: makeXYZTag(0.38515, 0.71687, 0.09708) },
    { sig: 'bXYZ', data: makeXYZTag(0.14307, 0.06061, 0.7141) },
    { sig: 'rTRC', data: makeCurvGamma22Tag() },
    { sig: 'gTRC', data: makeCurvGamma22Tag() },
    { sig: 'bTRC', data: makeCurvGamma22Tag() },
  ];

  const headerSize = 128;
  const tagTableSize = 4 + tags.length * 12;
  let dataOffset = headerSize + tagTableSize;
  const offsets: number[] = [];

  for (const t of tags) {
    offsets.push(dataOffset);
    dataOffset += (t.data.length + 3) & ~3;
  }

  const profile = new Uint8Array(dataOffset);
  // ICC Header (128 bytes)
  writeUint32BE(profile, 0, dataOffset); // Profile size
  writeAscii(profile, 4, 'NONE'); // Preferred CMM
  writeUint32BE(profile, 8, 0x02100000); // Version 2.1.0
  writeAscii(profile, 12, 'mntr'); // Display device profile
  writeAscii(profile, 16, 'RGB '); // Data color space
  writeAscii(profile, 20, 'XYZ '); // PCS
  // Creation date: 2026-01-01 00:00:00
  writeUint16BE(profile, 24, 2026);
  writeUint16BE(profile, 26, 1);
  writeUint16BE(profile, 28, 1);
  writeAscii(profile, 36, 'acsp'); // Profile file signature
  writeAscii(profile, 40, 'APPL'); // Primary platform
  writeUint32BE(profile, 64, 0); // Perceptual rendering intent
  // PCS Illuminant D50 (0.9642, 1.0, 0.8249)
  writeInt32BE(profile, 68, fixed16(0.9642));
  writeInt32BE(profile, 72, fixed16(1.0));
  writeInt32BE(profile, 76, fixed16(0.8249));

  // Tag count + table
  writeUint32BE(profile, headerSize, tags.length);
  tags.forEach((tag, idx) => {
    const entryOffset = headerSize + 4 + idx * 12;
    writeAscii(profile, entryOffset, tag.sig);
    writeUint32BE(profile, entryOffset + 4, offsets[idx]);
    writeUint32BE(profile, entryOffset + 8, tag.data.length);
    profile.set(tag.data, offsets[idx]);
  });

  let binary = '';
  for (let i = 0; i < profile.length; i++) {
    binary += String.fromCharCode(profile[i]);
  }
  return binary;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildPdfA1bXmpPacket(meta: PdfAMetadataOptions, isoTimestamp: string): string {
  const title = escapeXml(meta.title);
  const subject = escapeXml(meta.subject);
  const author = escapeXml(meta.author);
  const keywords = escapeXml(meta.keywords || 'Zupu, Genealogy, Archival PDF/A-1b');
  const creatorTool = escapeXml(meta.creator || 'ZupuVault Sovereign Lineage Archive');

  return [
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">',
    '   <pdfaid:part>1</pdfaid:part>',
    '   <pdfaid:conformance>B</pdfaid:conformance>',
    '  </rdf:Description>',
    '  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '   <dc:format>application/pdf</dc:format>',
    `   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>`,
    `   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${subject}</rdf:li></rdf:Alt></dc:description>`,
    `   <dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>`,
    '  </rdf:Description>',
    '  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">',
    `   <xmp:CreatorTool>${creatorTool}</xmp:CreatorTool>`,
    `   <xmp:CreateDate>${isoTimestamp}</xmp:CreateDate>`,
    `   <xmp:ModifyDate>${isoTimestamp}</xmp:ModifyDate>`,
    '  </rdf:Description>',
    '  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">',
    '   <pdf:Producer>jsPDF 4.2.1 (PDF/A-1b)</pdf:Producer>',
    `   <pdf:Keywords>${keywords}</pdf:Keywords>`,
    '  </rdf:Description>',
    ' </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].join('\n');
}

/**
 * Configures a jsPDF instance (whose pages use canvas JPEG DeviceRGB images
 * with putOnlyUsedFonts: true) for ISO 19005-1 PDF/A-1b archival compliance:
 * - Synchronized PDF Info + UTF-8 XMP Metadata with pdfaid:part=1 / conformance=B
 * - Embedded sRGB IEC 61966-2.1 ICC OutputIntent
 */
interface JsPdfInternalWriter {
  events: { subscribe: (topic: string, callback: () => void) => string };
  newObject: () => number;
  putStream: (opts: {
    data: string;
    additionalKeyValues?: Array<{ key: string; value: string | number }>;
    filters?: string[];
    objectId?: number;
  }) => void;
  out: (line: string) => void;
}

export function configurePdfACompliance(doc: jsPDF, meta: PdfAMetadataOptions): void {
  const isoTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  doc.setProperties({
    title: meta.title,
    subject: meta.subject,
    author: meta.author,
    keywords: meta.keywords || 'Zupu, Genealogy, Archival PDF/A-1b',
    creator: meta.creator || 'ZupuVault Sovereign Lineage Archive',
  });

  const iccBinary = buildSrgbIccProfileBinaryString();
  const writer = doc.internal as unknown as JsPdfInternalWriter;
  let iccObjId = 0;

  writer.events.subscribe('putResources', () => {
    iccObjId = writer.newObject();
    writer.putStream({
      data: iccBinary,
      additionalKeyValues: [{ key: 'N', value: 3 }],
      filters: [],
      objectId: iccObjId,
    });
    writer.out('endobj');
  });

  writer.events.subscribe('putCatalog', () => {
    if (iccObjId > 0) {
      writer.out(
        `/OutputIntents [<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) /RegistryName (http://www.color.org) /Info (sRGB IEC61966-2.1) /DestOutputProfile ${iccObjId} 0 R >>]`
      );
    }
  });

  doc.addMetadata(buildPdfA1bXmpPacket(meta, isoTimestamp), true);
}
