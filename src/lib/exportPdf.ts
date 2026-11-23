import { jsPDF } from 'jspdf';
import type { Locale, TranslationDict } from './i18n';
import {
  compareClanMembers,
  compareClanMembersByGeneration,
  getBranchRank,
} from './lineageOrder';
import {
  getBranchesFromMetadata,
  getBranchLabel,
  getRoleLabel,
  getSensitivityLabel,
} from './roles';
import { isValidPortraitDataUrl } from './portraitImage';
import clanSealUrl from '../assets/images/vermilion_clan_seal_1795328946321.jpg';
import type {
  BranchDefinition,
  BranchScope,
  ClanMetadata,
  DecryptedMember,
  UserProfile,
} from '../types/zupu';

export interface ExportPdfOptions {
  metadata: ClanMetadata;
  members: DecryptedMember[];
  currentUser: UserProfile;
  locale: Locale;
  t: TranslationDict;
  branchScope: BranchScope;
  includeTreeOverview: boolean;
  includeLivingPII: boolean;
  includeSealedTestaments: boolean;
}

type PageOrientation = 'portrait' | 'landscape';

interface RenderedPage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  orientation: PageOrientation;
  isCover?: boolean;
}

const PORTRAIT_W = 1400;
const PORTRAIT_H = 1980;
const LANDSCAPE_W = 1980;
const LANDSCAPE_H = 1400;

const MARGIN_X = 96;
const MARGIN_TOP = 96;
const MARGIN_BOTTOM = 110;

const COLOR_PAPER = '#FDFBF7';
const COLOR_WHITE = '#FFFFFF';
const COLOR_SURFACE = '#F7F3EA';
const COLOR_INK = '#1C1917';
const COLOR_MUTED = '#57534E';
const COLOR_SUBTLE = '#78716C';
const COLOR_BORDER = '#D6CEBE';
const COLOR_BORDER_LIGHT = '#E8E2D5';
const COLOR_VERMILION = '#9E2A2B';

const GENERATION_CHINESE = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function formatGenZh(gen: number): string {
  return gen >= 1 && gen <= GENERATION_CHINESE.length
    ? `第${GENERATION_CHINESE[gen - 1]}世`
    : `第${gen}世`;
}

const FONT_SERIF = '"Noto Serif TC", "Noto Serif SC", "Cormorant Garamond", Georgia, serif';
const FONT_SANS = '"Plus Jakarta Sans", "PingFang HK", "PingFang SC", "Microsoft JhengHei", sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

function loadSealImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 1500);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = clanSealUrl;
  });
}

async function loadPortraitMap(
  members: DecryptedMember[],
  allowLivingPII: boolean
): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  const eligible = members.filter(
    (m) => isValidPortraitDataUrl(m.portraitDataUrl) && (!m.isLiving || allowLivingPII)
  );
  await Promise.all(
    eligible.map(
      (m) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          const timer = window.setTimeout(() => resolve(), 1000);
          img.onload = () => {
            window.clearTimeout(timer);
            map.set(m.id, img);
            resolve();
          };
          img.onerror = () => {
            window.clearTimeout(timer);
            resolve();
          };
          img.src = m.portraitDataUrl!;
        })
    )
  );
  return map;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text.trim()) return [];
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    const chars = Array.from(para);

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const test = current + ch;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        const lastSpace = current.lastIndexOf(' ');
        if (lastSpace > 0 && /[A-Za-z0-9]/.test(ch)) {
          lines.push(current.slice(0, lastSpace));
          current = current.slice(lastSpace + 1) + ch;
        } else {
          if (current) lines.push(current);
          current = ch === ' ' ? '' : ch;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawCornerOrnaments(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const len = 24;
  ctx.strokeStyle = COLOR_VERMILION;
  ctx.lineWidth = 2;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - len);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + len, y + h);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - len);
  ctx.stroke();
}

function drawPageFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  withCorners = false
) {
  ctx.fillStyle = COLOR_PAPER;
  ctx.fillRect(0, 0, w, h);

  // Inner archival sheet background
  ctx.fillStyle = COLOR_WHITE;
  ctx.fillRect(46, 46, w - 92, h - 92);

  // Outer traditional double hairline frame
  ctx.strokeStyle = COLOR_BORDER;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(46, 46, w - 92, h - 92);

  ctx.strokeStyle = COLOR_BORDER_LIGHT;
  ctx.lineWidth = 1;
  ctx.strokeRect(54, 54, w - 108, h - 108);

  if (withCorners) {
    drawCornerOrnaments(ctx, 46, 46, w - 92, h - 92);
  }
}

function createPage(
  pages: RenderedPage[],
  orientation: PageOrientation = 'portrait',
  isCover = false
): RenderedPage {
  const w = orientation === 'landscape' ? LANDSCAPE_W : PORTRAIT_W;
  const h = orientation === 'landscape' ? LANDSCAPE_H : PORTRAIT_H;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for PDF export.');
  }
  drawPageFrame(ctx, w, h, isCover);
  const page: RenderedPage = { canvas, ctx, orientation, isCover };
  pages.push(page);
  return page;
}

function drawRunningChrome(pages: RenderedPage[], options: ExportPdfOptions) {
  const { metadata, t } = options;
  const total = pages.length;

  pages.forEach((page, idx) => {
    const { ctx, canvas, isCover } = page;
    const w = canvas.width;
    const h = canvas.height;

    if (!isCover) {
      // Quiet top running folio line
      ctx.fillStyle = COLOR_SUBTLE;
      ctx.font = `500 15px ${FONT_SERIF}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${metadata.clanChineseName} · ${metadata.clanName}`, MARGIN_X, 78);

      ctx.textAlign = 'right';
      ctx.font = `400 14px ${FONT_SANS}`;
      ctx.fillText(metadata.hallName || metadata.ancestralOrigin || '', w - MARGIN_X, 78);
      ctx.textAlign = 'left';

      ctx.strokeStyle = COLOR_BORDER_LIGHT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, 88);
      ctx.lineTo(w - MARGIN_X, 88);
      ctx.stroke();
    }

    // Running bottom footer across all pages
    const footerY = h - 68;
    ctx.strokeStyle = COLOR_BORDER_LIGHT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, footerY - 22);
    ctx.lineTo(w - MARGIN_X, footerY - 22);
    ctx.stroke();

    ctx.fillStyle = COLOR_SUBTLE;
    ctx.font = `400 15px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(t.pdf.confidentialFooter, MARGIN_X, footerY);

    ctx.font = `500 15px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${t.tree.vaultKey} ${metadata.keyFingerprint}  ·  ${t.pdf.pageLabel} ${idx + 1} / ${total}`,
      w - MARGIN_X,
      footerY
    );
    ctx.textAlign = 'left';
  });
}

export function filterMembersForPdf(
  members: DecryptedMember[],
  currentUser: UserProfile,
  requestedBranch: BranchScope,
  branches?: BranchDefinition[]
): DecryptedMember[] {
  const effectiveScope: BranchScope =
    currentUser.permissions.branchScope !== 'all'
      ? currentUser.permissions.branchScope
      : requestedBranch;

  return members
    .filter((m) => {
      if (
        currentUser.permissions.maxGenerationDepth > 0 &&
        m.generation > currentUser.permissions.maxGenerationDepth
      ) {
        return false;
      }
      if (!currentUser.permissions.canViewElderSealed && m.sensitivity === 'elder_sealed') {
        return false;
      }
      if (currentUser.role === 'guest_scholar' && m.sensitivity !== 'public_clan') {
        return false;
      }
      if (effectiveScope !== 'all' && m.generation > 1 && m.branch !== effectiveScope) {
        return false;
      }
      return true;
    })
    .sort((a, b) => compareClanMembersByGeneration(a, b, branches));
}

// --- Tidy Hierarchical Tree Layout for Landscape Page ---
interface PdfTreeUnit {
  id: string;
  generation: number;
  branch: string;
  members: DecryptedMember[];
  parentUnitId: string | null;
  children: PdfTreeUnit[];
  ownW: number;
  subtreeW: number;
  x: number;
  y: number;
  anchorX: number;
}

const TREE_CARD_W = 190;
const TREE_CARD_H = 100;
const TREE_SPOUSE_GAP = 28;
const TREE_UNIT_GAP = 32;
const TREE_ROW_H = 158;

function drawLineageTreePage(
  pages: RenderedPage[],
  filteredMembers: DecryptedMember[],
  options: ExportPdfOptions,
  allowLivingPII: boolean
) {
  if (filteredMembers.length === 0) return;

  const { metadata, locale, t } = options;
  const branches = getBranchesFromMetadata(metadata);
  const page = createPage(pages, 'landscape', false);
  const { ctx } = page;

  // Section header
  let cursorY = 128;
  ctx.fillStyle = COLOR_VERMILION;
  ctx.font = `600 15px ${FONT_SANS}`;
  ctx.fillText(t.pdf.coverKicker, MARGIN_X, cursorY);

  ctx.fillStyle = COLOR_INK;
  ctx.font = `700 32px ${FONT_SERIF}`;
  ctx.fillText(t.pdf.treeHeading, MARGIN_X, cursorY + 38);

  // Inline legend right-aligned on same header band
  ctx.textAlign = 'right';
  ctx.fillStyle = COLOR_MUTED;
  ctx.font = `400 16px ${FONT_SANS}`;
  ctx.fillText(
    `— ${t.tree.legendParent}    ·    ${t.tree.marriageChar} ${t.tree.legendSpouse}`,
    LANDSCAPE_W - MARGIN_X,
    cursorY + 34
  );
  ctx.textAlign = 'left';

  cursorY += 56;
  ctx.strokeStyle = COLOR_VERMILION;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, cursorY);
  ctx.lineTo(LANDSCAPE_W - MARGIN_X, cursorY);
  ctx.stroke();

  cursorY += 26;

  // Build hierarchical tree units
  const sorted = [...filteredMembers].sort((a, b) =>
    compareClanMembersByGeneration(a, b, branches)
  );
  const byId = new Map(sorted.map((m) => [m.id, m]));
  const genValues = Array.from(new Set(sorted.map((m) => m.generation))).sort((a, b) => a - b);
  const genRowMap = new Map<number, number>();
  genValues.forEach((g, idx) => genRowMap.set(g, idx));

  const usedInUnit = new Set<string>();
  const units: PdfTreeUnit[] = [];
  const memberToUnit = new Map<string, PdfTreeUnit>();

  for (const m of sorted) {
    if (usedInUnit.has(m.id)) continue;
    usedInUnit.add(m.id);

    const group: DecryptedMember[] = [m];
    for (const sid of m.spouseIds) {
      const sp = byId.get(sid);
      if (sp && !usedInUnit.has(sp.id) && sp.generation === m.generation) {
        usedInUnit.add(sp.id);
        group.push(sp);
      }
    }

    group.sort((a, b) => {
      const aHasP = a.parentIds.some((pid) => byId.has(pid)) ? 0 : 1;
      const bHasP = b.parentIds.some((pid) => byId.has(pid)) ? 0 : 1;
      if (aHasP !== bHasP) return aHasP - bHasP;
      if (a.gender !== b.gender) return a.gender === 'male' ? -1 : 1;
      return compareClanMembers(a, b, branches);
    });

    const primary = group[0];
    const ownW = group.length * TREE_CARD_W + Math.max(0, group.length - 1) * TREE_SPOUSE_GAP;
    const unit: PdfTreeUnit = {
      id: `pdf_unit_${group.map((x) => x.id).join('+')}`,
      generation: primary.generation,
      branch: primary.branch,
      members: group,
      parentUnitId: null,
      children: [],
      ownW,
      subtreeW: ownW,
      x: 0,
      y: 0,
      anchorX: 0,
    };
    units.push(unit);
    for (const gm of group) memberToUnit.set(gm.id, unit);
  }

  const roots: PdfTreeUnit[] = [];
  for (const unit of units) {
    let parentUnit: PdfTreeUnit | null = null;
    for (const gm of unit.members) {
      for (const pid of gm.parentIds) {
        const cand = memberToUnit.get(pid);
        if (cand && cand.id !== unit.id && cand.generation < unit.generation) {
          parentUnit = cand;
          break;
        }
      }
      if (parentUnit) break;
    }
    if (parentUnit) {
      unit.parentUnitId = parentUnit.id;
      parentUnit.children.push(unit);
    } else {
      roots.push(unit);
    }
  }

  const sortUnits = (a: PdfTreeUnit, b: PdfTreeUnit) => {
    const rankDiff = getBranchRank(a.branch, branches) - getBranchRank(b.branch, branches);
    if (rankDiff !== 0) return rankDiff;
    return compareClanMembers(a.members[0], b.members[0], branches);
  };
  roots.sort(sortUnits);
  for (const u of units) u.children.sort(sortUnits);

  const visitedW = new Set<string>();
  const calcSubtreeW = (u: PdfTreeUnit): number => {
    if (visitedW.has(u.id)) return u.ownW;
    visitedW.add(u.id);
    if (u.children.length === 0) {
      u.subtreeW = u.ownW;
      return u.subtreeW;
    }
    let span = 0;
    u.children.forEach((c, idx) => {
      span += calcSubtreeW(c);
      if (idx > 0) span += TREE_UNIT_GAP;
    });
    u.subtreeW = Math.max(u.ownW, span);
    return u.subtreeW;
  };
  for (const r of roots) calcSubtreeW(r);

  const placedMembers: { member: DecryptedMember; x: number; y: number }[] = [];
  const bridges: { x1: number; x2: number; y: number }[] = [];
  const placedUnits = new Set<string>();

  const placeSubtree = (u: PdfTreeUnit, leftX: number) => {
    if (placedUnits.has(u.id)) return;
    placedUnits.add(u.id);

    const rowIdx = genRowMap.get(u.generation) ?? 0;
    const centerX = leftX + u.subtreeW / 2;
    u.x = centerX - u.ownW / 2;
    u.y = rowIdx * TREE_ROW_H;
    u.anchorX = u.members.length >= 2 ? u.x + TREE_CARD_W + TREE_SPOUSE_GAP / 2 : u.x + TREE_CARD_W / 2;

    u.members.forEach((m, idx) => {
      const mx = u.x + idx * (TREE_CARD_W + TREE_SPOUSE_GAP);
      placedMembers.push({ member: m, x: mx, y: u.y });
      if (idx > 0) {
        const prevRight = u.x + (idx - 1) * (TREE_CARD_W + TREE_SPOUSE_GAP) + TREE_CARD_W;
        bridges.push({ x1: prevRight, x2: mx, y: u.y + TREE_CARD_H / 2 });
      }
    });

    if (u.children.length > 0) {
      const span =
        u.children.reduce((acc, c) => acc + c.subtreeW, 0) +
        (u.children.length - 1) * TREE_UNIT_GAP;
      let cx = centerX - span / 2;
      for (const c of u.children) {
        placeSubtree(c, cx);
        cx += c.subtreeW + TREE_UNIT_GAP;
      }
    }
  };

  let cursorX = 0;
  for (const r of roots) {
    placeSubtree(r, cursorX);
    cursorX += r.subtreeW + TREE_UNIT_GAP;
  }

  const rawTreeW = Math.max(300, cursorX - TREE_UNIT_GAP);
  const rawTreeH = Math.max(120, genValues.length * TREE_ROW_H - (TREE_ROW_H - TREE_CARD_H));

  const railW = 148;
  const areaX = MARGIN_X + railW + 24;
  const availW = LANDSCAPE_W - MARGIN_X - areaX;
  const availH = LANDSCAPE_H - MARGIN_BOTTOM - cursorY - 12;

  const scale = Math.min(1.08, availW / rawTreeW, availH / rawTreeH);
  const drawW = rawTreeW * scale;
  const offsetX = areaX + Math.max(0, (availW - drawW) / 2);
  const offsetY = cursorY + Math.max(0, (availH - rawTreeH * scale) / 2);

  // Left generation plaque rail & horizontal row lanes
  genValues.forEach((gen, idx) => {
    const bandY = offsetY + idx * TREE_ROW_H * scale;
    const bandH = TREE_CARD_H * scale;
    const poemChar = metadata.generationPoem[gen - 1];

    if (idx % 2 === 1) {
      ctx.fillStyle = COLOR_PAPER;
      ctx.fillRect(MARGIN_X, bandY - 10 * scale, LANDSCAPE_W - MARGIN_X * 2, bandH + 20 * scale);
    }

    ctx.fillStyle = COLOR_VERMILION;
    ctx.font = `700 22px ${FONT_SERIF}`;
    ctx.fillText(formatGenZh(gen), MARGIN_X, bandY + bandH / 2 - 4);

    ctx.fillStyle = COLOR_MUTED;
    ctx.font = `500 15px ${FONT_MONO}`;
    ctx.fillText(
      `${t.common.genPrefix} ${gen}${poemChar ? ` · ${poemChar}` : ''}`,
      MARGIN_X,
      bandY + bandH / 2 + 20
    );
  });

  // Vertical rail divider
  ctx.strokeStyle = COLOR_BORDER_LIGHT;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X + railW, offsetY - 12);
  ctx.lineTo(MARGIN_X + railW, offsetY + rawTreeH * scale + 12);
  ctx.stroke();

  // Render tree coordinates cleanly scaled
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const memberPosMap = new Map(placedMembers.map((p) => [p.member.id, p]));

  // Orthogonal parent->child paths
  for (const u of units) {
    if (!u.parentUnitId) continue;
    const pUnit = units.find((c) => c.id === u.parentUnitId);
    if (!pUnit) continue;

    const childMember =
      u.members.find((gm) => gm.parentIds.some((pid) => memberToUnit.get(pid)?.id === pUnit.id)) ??
      u.members[0];
    const cPos = memberPosMap.get(childMember.id);
    if (!cPos) continue;

    const px = pUnit.anchorX;
    const py = pUnit.members.length >= 2 ? pUnit.y + TREE_CARD_H / 2 : pUnit.y + TREE_CARD_H;
    const cx = cPos.x + TREE_CARD_W / 2;
    const cy = cPos.y;
    const busY = cy - (TREE_ROW_H - TREE_CARD_H) / 2;

    ctx.strokeStyle = '#C7BFB0';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, busY);
    ctx.lineTo(cx, busY);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }

  // Spouse marriage medallions
  for (const b of bridges) {
    const mx = (b.x1 + b.x2) / 2;
    ctx.strokeStyle = 'rgba(158, 42, 43, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y);
    ctx.lineTo(b.x2, b.y);
    ctx.stroke();

    ctx.fillStyle = COLOR_SURFACE;
    ctx.fillRect(mx - 10, b.y - 10, 20, 20);
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 10, b.y - 10, 20, 20);

    ctx.fillStyle = COLOR_VERMILION;
    ctx.font = `600 12px ${FONT_SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText(t.tree.marriageChar, mx, b.y + 4);
    ctx.textAlign = 'left';
  }

  // Member Cards
  for (const { member, x, y } of placedMembers) {
    ctx.fillStyle = COLOR_PAPER;
    ctx.fillRect(x, y, TREE_CARD_W, TREE_CARD_H);
    ctx.strokeStyle = COLOR_BORDER;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x, y, TREE_CARD_W, TREE_CARD_H);

    // Chinese name & lifespan
    ctx.fillStyle = COLOR_INK;
    ctx.font = `700 21px ${FONT_SERIF}`;
    ctx.fillText(member.chineseName, x + 12, y + 30, TREE_CARD_W - 24);

    ctx.fillStyle = COLOR_MUTED;
    ctx.font = `500 14px ${FONT_SANS}`;
    ctx.fillText(member.romanizedName, x + 12, y + 51, TREE_CARD_W - 24);

    ctx.fillStyle = COLOR_SUBTLE;
    ctx.font = `400 12px ${FONT_SANS}`;
    const subLabel = `${getBranchLabel(member.branch, locale, branches)}${member.courtesyName ? ` · 字${member.courtesyName}` : ''}`;
    ctx.fillText(subLabel, x + 12, y + 71, TREE_CARD_W - 24);

    ctx.strokeStyle = COLOR_BORDER_LIGHT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 80);
    ctx.lineTo(x + TREE_CARD_W - 12, y + 80);
    ctx.stroke();

    const lifespan = member.isLiving
      ? `${member.birthYear || '?'}–${t.common.present}`
      : `${member.birthYear || '?'}–${member.deathYear || '?'}`;
    ctx.fillStyle = COLOR_SUBTLE;
    ctx.font = `400 12px ${FONT_MONO}`;
    ctx.fillText(lifespan, x + 12, y + 94);

    ctx.textAlign = 'right';
    ctx.fillStyle = member.isLiving && !allowLivingPII ? COLOR_SUBTLE : COLOR_VERMILION;
    ctx.font = `500 11px ${FONT_SANS}`;
    ctx.fillText(
      member.isLiving
        ? allowLivingPII
          ? t.common.living
          : t.common.piiHidden
        : t.common.ancestor,
      x + TREE_CARD_W - 12,
      y + 94
    );
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

export async function exportZupuPdf(options: ExportPdfOptions): Promise<void> {
  if (!options.currentUser.permissions.canExportVault) {
    throw new Error('Your current role does not have permission to export vault records.');
  }

  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const sealImg = await loadSealImage();
  const { metadata, currentUser, locale, t } = options;
  const branches = getBranchesFromMetadata(metadata);

  const allowLivingPII =
    currentUser.permissions.canViewLivingPII && options.includeLivingPII;
  const allowSealed =
    currentUser.permissions.canViewElderSealed && options.includeSealedTestaments;

  const effectiveScope: BranchScope =
    currentUser.permissions.branchScope !== 'all'
      ? currentUser.permissions.branchScope
      : options.branchScope;

  const filteredMembers = filterMembersForPdf(
    options.members,
    currentUser,
    options.branchScope,
    branches
  );

  const portraitMap = await loadPortraitMap(filteredMembers, allowLivingPII);
  const memberById = new Map(filteredMembers.map((m) => [m.id, m]));
  const pages: RenderedPage[] = [];

  // ============================================================================
  // PAGE 1: CEREMONIAL ARCHIVAL FRONTISPIECE COVER (Portrait A4)
  // ============================================================================
  const cover = createPage(pages, 'portrait', true);
  const cCtx = cover.ctx;
  const contentW = PORTRAIT_W - MARGIN_X * 2;
  const centerX = PORTRAIT_W / 2;
  let y = 175;

  // Vermilion Clan Seal Emblem centered
  const sealSize = 148;
  if (sealImg) {
    cCtx.drawImage(sealImg, centerX - sealSize / 2, y, sealSize, sealSize);
    cCtx.strokeStyle = COLOR_BORDER;
    cCtx.lineWidth = 1.5;
    cCtx.strokeRect(centerX - sealSize / 2, y, sealSize, sealSize);
  } else {
    cCtx.fillStyle = 'rgba(158, 42, 43, 0.08)';
    cCtx.fillRect(centerX - sealSize / 2, y, sealSize, sealSize);
    cCtx.strokeStyle = COLOR_VERMILION;
    cCtx.lineWidth = 2.5;
    cCtx.strokeRect(centerX - sealSize / 2, y, sealSize, sealSize);
    cCtx.fillStyle = COLOR_VERMILION;
    cCtx.font = `700 72px ${FONT_SERIF}`;
    cCtx.textAlign = 'center';
    cCtx.fillText('譜', centerX, y + 98);
  }
  y += sealSize + 52;

  cCtx.textAlign = 'center';
  cCtx.fillStyle = COLOR_VERMILION;
  cCtx.font = `600 18px ${FONT_SANS}`;
  cCtx.fillText(t.pdf.coverKicker, centerX, y);
  y += 66;

  // Large Chinese Title & English Clan Name
  cCtx.fillStyle = COLOR_INK;
  cCtx.font = `700 66px ${FONT_SERIF}`;
  cCtx.fillText(metadata.clanChineseName, centerX, y, contentW);
  y += 50;

  cCtx.fillStyle = COLOR_MUTED;
  cCtx.font = `500 32px ${FONT_SERIF}`;
  cCtx.fillText(metadata.clanName, centerX, y, contentW);
  y += 38;

  // Ceremonial vermilion divider
  cCtx.strokeStyle = COLOR_VERMILION;
  cCtx.lineWidth = 1.6;
  cCtx.beginPath();
  cCtx.moveTo(centerX - 180, y);
  cCtx.lineTo(centerX + 180, y);
  cCtx.stroke();
  y += 42;

  const hallOrigin = [metadata.hallName, metadata.ancestralOrigin].filter(Boolean).join(' · ');
  if (hallOrigin) {
    cCtx.fillStyle = COLOR_INK;
    cCtx.font = `500 22px ${FONT_SERIF}`;
    cCtx.fillText(hallOrigin, centerX, y, contentW);
    y += 56;
  }

  // Generation Poem Seal Grid centered
  if (metadata.generationPoem.length > 0) {
    cCtx.fillStyle = COLOR_SUBTLE;
    cCtx.font = `600 17px ${FONT_SANS}`;
    cCtx.fillText(t.tree.poemTitle, centerX, y);
    y += 28;

    const tileW = 74;
    const tileH = 90;
    const tileGap = 14;
    const cols = Math.min(metadata.generationPoem.length, 8);
    const totalGridW = cols * tileW + (cols - 1) * tileGap;
    const startGridX = centerX - totalGridW / 2;

    metadata.generationPoem.forEach((char, idx) => {
      const row = Math.floor(idx / 8);
      const col = idx % 8;
      const tx = startGridX + col * (tileW + tileGap);
      const ty = y + row * (tileH + tileGap);

      cCtx.fillStyle = COLOR_SURFACE;
      cCtx.fillRect(tx, ty, tileW, tileH);
      cCtx.strokeStyle = COLOR_BORDER;
      cCtx.lineWidth = 1.2;
      cCtx.strokeRect(tx, ty, tileW, tileH);

      cCtx.fillStyle = COLOR_INK;
      cCtx.font = `700 34px ${FONT_SERIF}`;
      cCtx.fillText(char, tx + tileW / 2, ty + 48);

      cCtx.fillStyle = COLOR_SUBTLE;
      cCtx.font = `500 15px ${FONT_MONO}`;
      cCtx.fillText(String(idx + 1), tx + tileW / 2, ty + 76);
    });

    const poemRows = Math.ceil(metadata.generationPoem.length / 8);
    y += poemRows * (tileH + tileGap) + 44;
  }

  // Quantitative Archival Summary Strip (4 clean hairline columns)
  const genCount = new Set(filteredMembers.map((m) => m.generation)).size;
  const livingCount = filteredMembers.filter((m) => m.isLiving).length;
  const ancestorCount = filteredMembers.length - livingCount;

  const stripY = Math.max(y, 1220);
  const stripH = 114;
  cCtx.fillStyle = COLOR_SURFACE;
  cCtx.fillRect(MARGIN_X, stripY, contentW, stripH);
  cCtx.strokeStyle = COLOR_BORDER;
  cCtx.lineWidth = 1.2;
  cCtx.strokeRect(MARGIN_X, stripY, contentW, stripH);

  const stats = [
    { label: t.ledger.colGen, value: String(genCount) },
    { label: t.pdf.recordsCount, value: String(filteredMembers.length) },
    { label: t.common.ancestor, value: String(ancestorCount) },
    { label: t.common.living, value: String(livingCount) },
  ];
  const colW = contentW / 4;
  stats.forEach((stat, idx) => {
    const cx = MARGIN_X + idx * colW + colW / 2;
    if (idx > 0) {
      cCtx.strokeStyle = COLOR_BORDER_LIGHT;
      cCtx.lineWidth = 1;
      cCtx.beginPath();
      cCtx.moveTo(MARGIN_X + idx * colW, stripY + 18);
      cCtx.lineTo(MARGIN_X + idx * colW, stripY + stripH - 18);
      cCtx.stroke();
    }
    cCtx.fillStyle = COLOR_VERMILION;
    cCtx.font = `700 34px ${FONT_MONO}`;
    cCtx.fillText(stat.value, cx, stripY + 56);

    cCtx.fillStyle = COLOR_MUTED;
    cCtx.font = `500 16px ${FONT_SANS}`;
    cCtx.fillText(stat.label, cx, stripY + 90);
  });

  // Provenance & Privacy Colophon near bottom of Cover
  cCtx.textAlign = 'left';
  const colophonY = 1430;
  const colophonH = 260;
  cCtx.fillStyle = COLOR_PAPER;
  cCtx.fillRect(MARGIN_X, colophonY, contentW, colophonH);
  cCtx.strokeStyle = COLOR_BORDER_LIGHT;
  cCtx.lineWidth = 1.2;
  cCtx.strokeRect(MARGIN_X, colophonY, contentW, colophonH);

  const colPadX = MARGIN_X + 32;
  let cy = colophonY + 46;
  const rowsInfo: [string, string][] = [
    [
      t.pdf.exportedBy,
      `${currentUser.chineseName} (${currentUser.displayName}) · ${getRoleLabel(currentUser.role, locale)}`,
    ],
    [t.pdf.branchLabel, getBranchLabel(effectiveScope, locale, branches)],
    [t.pdf.exportedAt, new Date().toISOString().slice(0, 16).replace('T', ' ')],
    [
      t.drawer.residenceLabel,
      allowLivingPII ? t.pdf.includeLivingPii : t.pdf.livingPiiRestricted,
    ],
    [
      t.drawer.sealedTestament,
      allowSealed ? t.pdf.includeSealed : t.pdf.sealedRestricted,
    ],
  ];

  rowsInfo.forEach(([k, v]) => {
    cCtx.fillStyle = COLOR_SUBTLE;
    cCtx.font = `600 16px ${FONT_SANS}`;
    cCtx.fillText(k, colPadX, cy, 340);

    cCtx.fillStyle = COLOR_INK;
    cCtx.font = `400 16px ${FONT_SANS}`;
    cCtx.fillText(v, colPadX + 360, cy, contentW - 420);
    cy += 42;
  });

  // ============================================================================
  // PAGE 2: LANDSCAPE TIDY HIERARCHICAL LINEAGE TREE OVERVIEW
  // ============================================================================
  if (options.includeTreeOverview && filteredMembers.length > 0) {
    drawLineageTreePage(pages, filteredMembers, options, allowLivingPII);
  }

  // ============================================================================
  // PAGE 3+: OUYANG-STYLE EDITORIAL GENERATIONAL CHRONICLES (Portrait A4)
  // ============================================================================
  let { ctx } = createPage(pages, 'portrait', false);
  let cursorY = 128;

  ctx.fillStyle = COLOR_VERMILION;
  ctx.font = `600 15px ${FONT_SANS}`;
  ctx.fillText(t.ledger.kicker, MARGIN_X, cursorY);

  ctx.fillStyle = COLOR_INK;
  ctx.font = `700 34px ${FONT_SERIF}`;
  ctx.fillText(t.pdf.chroniclesHeading, MARGIN_X, cursorY + 40);
  cursorY += 58;

  ctx.strokeStyle = COLOR_VERMILION;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, cursorY);
  ctx.lineTo(PORTRAIT_W - MARGIN_X, cursorY);
  ctx.stroke();
  cursorY += 34;

  if (filteredMembers.length === 0) {
    ctx.fillStyle = COLOR_SUBTLE;
    ctx.font = `400 19px ${FONT_SANS}`;
    ctx.fillText(t.common.noneRecorded, MARGIN_X, cursorY + 20);
  } else {
    let lastGen = -1;

    for (const member of filteredMembers) {
      const needsGenBanner = member.generation !== lastGen;
      const poemChar = metadata.generationPoem[member.generation - 1];

      const genderLabel =
        member.gender === 'female' ? t.drawer.genderFemale : t.drawer.genderMale;
      const subTitles = [
        member.courtesyName ? `字 ${member.courtesyName}` : '',
        member.artName ? `號 ${member.artName}` : '',
        member.birthOrder || '',
        member.occupationOrTitle || '',
      ]
        .filter(Boolean)
        .join(' · ');

      const lifespan = member.isLiving
        ? `${member.birthYear || '?'} – ${t.common.present}`
        : `${member.birthYear || '?'} – ${member.deathYear || '?'}`;
      const lunarPart = [
        member.birthLunar ? `${t.drawer.lunarBirth}: ${member.birthLunar}` : '',
        !member.isLiving && member.deathLunar ? `${t.drawer.lunarDeath}: ${member.deathLunar}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const dateStr = `${lifespan}${lunarPart ? ` (${lunarPart})` : ''}`;

      const parentsStr =
        member.parentIds
          .map((id) => memberById.get(id))
          .filter((p): p is DecryptedMember => Boolean(p))
          .map((p) => `${p.chineseName} (${p.romanizedName})`)
          .join(', ') || t.drawer.foundingUnlinked;

      const spousesStr =
        member.spouseIds
          .map((id) => memberById.get(id))
          .filter((s): s is DecryptedMember => Boolean(s))
          .map((s) => `${s.chineseName} (${s.romanizedName})`)
          .join(', ') || t.common.noneRecorded;

      const childrenStr =
        filteredMembers
          .filter((c) => c.parentIds.includes(member.id))
          .map((c) => `${c.chineseName} (${c.romanizedName})`)
          .join(', ') || t.common.noneRecorded;

      const residenceDisplay = member.isLiving
        ? allowLivingPII
          ? member.currentResidence || t.common.noneRecorded
          : t.pdf.redactedAddress
        : '';

      const metaColW = contentW - 44;
      ctx.font = `400 17px ${FONT_SANS}`;
      const originLines = wrapText(
        ctx,
        `${t.drawer.originLabel}: ${member.birthplace || '—'}${
          residenceDisplay ? `   ·   ${t.drawer.residenceLabel}: ${residenceDisplay}` : ''
        }`,
        metaColW
      );
      const linksLines = wrapText(
        ctx,
        `${t.drawer.parents} ${parentsStr}   ·   ${t.drawer.spouse} ${spousesStr}   ·   ${t.drawer.children} ${childrenStr}`,
        metaColW
      );

      ctx.font = `400 19px ${FONT_SERIF}`;
      const bioLines = wrapText(ctx, member.biography || t.drawer.noBio, contentW);

      const showSealed = allowSealed && Boolean(member.sealedTestament?.trim());
      ctx.font = `400 17px ${FONT_SANS}`;
      const sealedLines = showSealed
        ? wrapText(ctx, `${t.drawer.sealedTestament}: ${member.sealedTestament}`, contentW - 36)
        : [];

      const hasPortrait = portraitMap.has(member.id);
      const specBoxH = 28 + 26 + originLines.length * 24 + linksLines.length * 24 + 14;
      const headerH = hasPortrait
        ? Math.max(92, subTitles ? 78 : 50)
        : 42 + (subTitles ? 28 : 0);
      const entryH =
        headerH +
        specBoxH +
        18 +
        bioLines.length * 29 +
        (showSealed ? 16 + sealedLines.length * 24 + 26 : 0) +
        30; // bottom rule & spacing

      const neededH = (needsGenBanner ? 64 : 0) + entryH;
      if (cursorY + neededH > PORTRAIT_H - MARGIN_BOTTOM) {
        ({ ctx } = createPage(pages, 'portrait', false));
        cursorY = 128;
      }

      if (needsGenBanner) {
        lastGen = member.generation;
        ctx.fillStyle = COLOR_SURFACE;
        ctx.fillRect(MARGIN_X, cursorY, contentW, 44);
        ctx.strokeStyle = COLOR_BORDER;
        ctx.lineWidth = 1;
        ctx.strokeRect(MARGIN_X, cursorY, contentW, 44);

        ctx.fillStyle = COLOR_VERMILION;
        ctx.font = `700 22px ${FONT_SERIF}`;
        ctx.fillText(
          `${formatGenZh(member.generation)} · ${t.common.genPrefix} ${member.generation}${
            poemChar ? ` · ${poemChar}${t.tree.genPoemSuffix}` : ''
          }`,
          MARGIN_X + 18,
          cursorY + 30
        );
        cursorY += 62;
      }

      const portraitImg = portraitMap.get(member.id) ?? null;
      const portraitBox = portraitImg ? 78 : 0;
      const headerOffsetX = portraitImg ? portraitBox + 18 : 0;

      // Member Monograph Entry Header (unboxed editorial typography + optional framed portrait)
      if (portraitImg) {
        ctx.drawImage(portraitImg, MARGIN_X, cursorY, portraitBox, portraitBox);
        ctx.strokeStyle = COLOR_BORDER;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(MARGIN_X, cursorY, portraitBox, portraitBox);
      }

      ctx.fillStyle = COLOR_INK;
      ctx.font = `700 30px ${FONT_SERIF}`;
      ctx.fillText(member.chineseName, MARGIN_X + headerOffsetX, cursorY + 26);
      const zhW = ctx.measureText(member.chineseName).width;

      ctx.fillStyle = COLOR_MUTED;
      ctx.font = `500 21px ${FONT_SERIF}`;
      ctx.fillText(
        `  ${member.romanizedName} · ${genderLabel}`,
        MARGIN_X + headerOffsetX + zhW,
        cursorY + 25
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = COLOR_SUBTLE;
      ctx.font = `500 16px ${FONT_SANS}`;
      ctx.fillText(
        `${getBranchLabel(member.branch, locale, branches)} · ${getSensitivityLabel(member.sensitivity, locale)}`,
        PORTRAIT_W - MARGIN_X,
        cursorY + 23
      );
      ctx.textAlign = 'left';

      if (subTitles) {
        ctx.fillStyle = COLOR_VERMILION;
        ctx.font = `500 18px ${FONT_SERIF}`;
        ctx.fillText(subTitles, MARGIN_X + headerOffsetX, cursorY + 62, contentW - headerOffsetX);
      }

      cursorY += portraitImg ? Math.max(portraitBox + 14, subTitles ? 78 : 50) : subTitles ? 66 : 38;

      // Structured Archival Spec Strip
      ctx.fillStyle = COLOR_PAPER;
      ctx.fillRect(MARGIN_X, cursorY, contentW, specBoxH);
      ctx.strokeStyle = COLOR_BORDER_LIGHT;
      ctx.lineWidth = 1;
      ctx.strokeRect(MARGIN_X, cursorY, contentW, specBoxH);

      let sy = cursorY + 26;
      const sx = MARGIN_X + 20;

      ctx.fillStyle = COLOR_INK;
      ctx.font = `500 16px ${FONT_MONO}`;
      ctx.fillText(dateStr, sx, sy, metaColW);
      sy += 26;

      ctx.fillStyle = COLOR_MUTED;
      ctx.font = `400 17px ${FONT_SANS}`;
      for (const line of originLines) {
        ctx.fillText(line, sx, sy);
        sy += 24;
      }

      ctx.fillStyle = COLOR_SUBTLE;
      ctx.font = `400 16px ${FONT_SANS}`;
      for (const line of linksLines) {
        ctx.fillText(line, sx, sy);
        sy += 24;
      }

      cursorY += specBoxH + 22;

      // Biography Prose
      ctx.fillStyle = COLOR_INK;
      ctx.font = `400 19px ${FONT_SERIF}`;
      for (const line of bioLines) {
        ctx.fillText(line, MARGIN_X, cursorY);
        cursorY += 29;
      }

      // Elder-Sealed Testament Callout (only when authorized + opted in)
      if (showSealed) {
        cursorY += 8;
        const boxH = sealedLines.length * 24 + 26;
        ctx.fillStyle = '#FDF7F7';
        ctx.fillRect(MARGIN_X, cursorY, contentW, boxH);
        ctx.strokeStyle = 'rgba(158, 42, 43, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(MARGIN_X, cursorY, contentW, boxH);

        let sealY = cursorY + 26;
        ctx.fillStyle = COLOR_VERMILION;
        ctx.font = `500 17px ${FONT_SANS}`;
        for (const line of sealedLines) {
          ctx.fillText(line, MARGIN_X + 18, sealY);
          sealY += 24;
        }
        cursorY += boxH + 8;
      }

      // Crisp horizontal hairline separating entries
      cursorY += 10;
      ctx.strokeStyle = COLOR_BORDER_LIGHT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, cursorY);
      ctx.lineTo(PORTRAIT_W - MARGIN_X, cursorY);
      ctx.stroke();
      cursorY += 28;
    }
  }

  drawRunningChrome(pages, options);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((page, index) => {
    const isLandscape = page.orientation === 'landscape';
    if (index > 0) {
      pdf.addPage('a4', page.orientation);
    }
    const imgData = page.canvas.toDataURL('image/jpeg', 0.93);
    pdf.addImage(
      imgData,
      'JPEG',
      0,
      0,
      isLandscape ? 297 : 210,
      isLandscape ? 210 : 297,
      undefined,
      'FAST'
    );
  });

  const slug =
    metadata.clanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'clan_zupu';
  const dateStr = new Date().toISOString().slice(0, 10);
  pdf.save(`${slug}_zupu_${dateStr}.pdf`);
}
