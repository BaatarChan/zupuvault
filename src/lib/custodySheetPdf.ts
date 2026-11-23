import { jsPDF } from 'jspdf';
import type { ClanMetadata, UserProfile } from '../types/zupu';

const PAGE_W = 1400;
const PAGE_H = 1980;
const FONT_SERIF = '"Noto Serif TC", "Noto Serif SC", "Cormorant Garamond", Georgia, serif';
const FONT_SANS = '"Plus Jakarta Sans", "PingFang HK", "PingFang SC", sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

export async function downloadHeirCustodySheetPdf(
  metadata: ClanMetadata,
  custodian: UserProfile,
  serverOrigin: string
): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Warm ceremonial archival stock
  ctx.fillStyle = '#FDFBF7';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Outer vermilion double archival frame
  ctx.strokeStyle = '#9E2A2B';
  ctx.lineWidth = 4;
  ctx.strokeRect(56, 56, PAGE_W - 112, PAGE_H - 112);
  ctx.strokeStyle = '#D6CEBE';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(70, 70, PAGE_W - 140, PAGE_H - 140);

  // Header
  ctx.fillStyle = '#9E2A2B';
  ctx.font = `600 18px ${FONT_SANS}`;
  ctx.fillText('SOVEREIGN LINEAGE CUSTODY RECORD · 宗族金鑰交接憑證', 110, 145);

  ctx.fillStyle = '#1C1917';
  ctx.font = `700 48px ${FONT_SERIF}`;
  ctx.fillText(`${metadata.clanChineseName} · ${metadata.clanName}`, 110, 212);

  ctx.fillStyle = '#57534E';
  ctx.font = `500 22px ${FONT_SANS}`;
  ctx.fillText(
    `${metadata.hallName || 'Ancestral Hall'} · ${metadata.ancestralOrigin || ''}`,
    110,
    254
  );

  ctx.strokeStyle = '#E8E2D5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(110, 286);
  ctx.lineTo(PAGE_W - 110, 286);
  ctx.stroke();

  // Vault cryptographic specifications table
  const boxY = 320;
  ctx.fillStyle = '#F7F3EA';
  ctx.fillRect(110, boxY, PAGE_W - 220, 320);
  ctx.strokeStyle = '#D6CEBE';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(110, boxY, PAGE_W - 220, 320);

  const specs: [string, string][] = [
    ['Server Endpoint · 家族伺服器網址', serverOrigin || 'https://zupu.yourdomain.com'],
    ['Key Fingerprint · 密鑰指紋', metadata.keyFingerprint],
    [
      'Cipher Suite · 加密規格',
      `AES-256-GCM · PBKDF2-SHA256 (${metadata.kdfIterations.toLocaleString()} iterations)`,
    ],
    [
      'Primary Custodian · 掌譜族長',
      `${custodian.chineseName} (${custodian.displayName}) · ${custodian.email}`,
    ],
    ['Issued Date · 繕製日期', new Date().toISOString().slice(0, 10)],
  ];

  specs.forEach(([label, value], i) => {
    const rowY = boxY + 52 + i * 54;
    ctx.fillStyle = '#78716C';
    ctx.font = `600 17px ${FONT_SANS}`;
    ctx.fillText(label, 144, rowY);

    ctx.fillStyle = '#1C1917';
    ctx.font = `500 18px ${FONT_MONO}`;
    ctx.fillText(value, 540, rowY);
  });

  // Passphrase Handwritten Custody Boxes
  ctx.fillStyle = '#9E2A2B';
  ctx.font = `700 24px ${FONT_SERIF}`;
  ctx.fillText(
    '01. Family Encryption Passphrase (Store Offline — Never Held by Server)',
    110,
    720
  );
  ctx.fillStyle = '#57534E';
  ctx.font = `400 18px ${FONT_SANS}`;
  ctx.fillText(
    'Write carefully by hand in permanent ink, or split across two trusted heirs below for 2-of-2 custody.',
    110,
    756
  );

  // Full Passphrase Box
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(110, 784, PAGE_W - 220, 150);
  ctx.strokeStyle = '#9E2A2B';
  ctx.lineWidth = 2;
  ctx.strokeRect(110, 784, PAGE_W - 220, 150);
  ctx.fillStyle = '#78716C';
  ctx.font = `600 15px ${FONT_SANS}`;
  ctx.fillText('OPTION A — FULL PASSPHRASE (家族解鎖主密語 · 完整手寫欄)', 134, 818);

  // Split Custody Boxes
  const halfW = (PAGE_W - 220 - 30) / 2;
  [
    { x: 110, title: 'OPTION B — HEIR 1 HALF (第一繼承人保管前半段)' },
    { x: 110 + halfW + 30, title: 'OPTION B — HEIR 2 HALF (第二繼承人保管後半段)' },
  ].forEach((b) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(b.x, 964, halfW, 170);
    ctx.strokeStyle = '#D6CEBE';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, 964, halfW, 170);
    ctx.fillStyle = '#78716C';
    ctx.font = `600 14px ${FONT_SANS}`;
    ctx.fillText(b.title, b.x + 22, 998);
    ctx.fillStyle = '#A8A29E';
    ctx.font = `400 14px ${FONT_SANS}`;
    ctx.fillText('Heir Name / Signature · 保管人簽署:', b.x + 22, 1112);
  });

  // Recovery Assets Checklist
  ctx.fillStyle = '#1C1917';
  ctx.font = `700 24px ${FONT_SERIF}`;
  ctx.fillText('02. Emergency Server & Archive Recovery Locations (備份檔案存放紀錄)', 110, 1215);

  const checklist = [
    ['Encrypted .zupu.json Archive Location', 'USB / Safe Deposit / Cloud Drive:'],
    ['Oracle Cloud Server Store Backup', '/opt/zupuvault/data/zupu-vault-store.json · OCI Bucket:'],
    ['Server .env SESSION_SECRET Location', 'Password Manager / Sealed Envelope:'],
    ['TOTP MFA Single-Use Recovery Codes', 'Printed Envelope / Hardware Key:'],
  ];

  checklist.forEach(([title, prompt], idx) => {
    const y = 1260 + idx * 126;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(110, y, PAGE_W - 220, 102);
    ctx.strokeStyle = '#D6CEBE';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(110, y, PAGE_W - 220, 102);
    ctx.fillStyle = '#1C1917';
    ctx.font = `600 17px ${FONT_SANS}`;
    ctx.fillText(title, 134, y + 36);
    ctx.fillStyle = '#78716C';
    ctx.font = `400 16px ${FONT_SANS}`;
    ctx.fillText(prompt, 134, y + 72);
  });

  // Footer
  ctx.fillStyle = '#78716C';
  ctx.font = `400 16px ${FONT_SANS}`;
  ctx.fillText(
    'Generated locally in browser memory · Zero secrets transmitted · Store inside fireproof safe or bank vault.',
    110,
    PAGE_H - 96
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  const a4W = doc.internal.pageSize.getWidth();
  const a4H = doc.internal.pageSize.getHeight();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  doc.addImage(dataUrl, 'JPEG', 0, 0, a4W, a4H, undefined, 'FAST');
  const slug = metadata.clanName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'zupu';
  doc.save(`${slug}_heir_custody_sheet.pdf`);
}
