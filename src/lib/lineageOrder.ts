import type { BranchDefinition, DecryptedMember } from '../types/zupu';

export const BRANCH_RANK: Record<string, number> = {
  elder_branch: 0,
  second_branch: 1,
  third_branch: 2,
};

export function getBranchRank(branchId: string, branchOrder?: BranchDefinition[]): number {
  if (branchOrder && branchOrder.length > 0) {
    const idx = branchOrder.findIndex((b) => b.id === branchId);
    if (idx !== -1) return idx;
  }
  return BRANCH_RANK[branchId] ?? 99;
}

/**
 * Extracts a numeric calendar birth year if known; returns null when missing or "?".
 */
export function parseBirthYear(birthYear?: string): number | null {
  if (!birthYear) return null;
  const trimmed = birthYear.trim();
  if (!trimmed || trimmed === '?') return null;
  const match = trimmed.match(/\d{3,4}/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  return Number.isFinite(num) ? num : null;
}

/**
 * Extracts ordinal seniority rank from Chinese/English birth order strings
 * (e.g. "長子 · Eldest Son" -> 1, "次女" -> 2, "四世次孫女" -> 2, "3rd Son" -> 3).
 */
export function parseBirthOrderRank(birthOrder?: string): number | null {
  if (!birthOrder) return null;

  // Strip generation qualifiers ("四世", "4th Generation", "Gen 4") before reading seniority
  const cleaned = birthOrder
    .trim()
    .toLowerCase()
    .replace(/[一二三四五六七八九十\d]+\s*世/g, ' ')
    .replace(/\b\d+(st|nd|rd|th)?\s*generation\b/gi, ' ')
    .replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+generation\b/gi, ' ')
    .replace(/\bgen\s*\d+\b/gi, ' ')
    .trim();

  if (!cleaned) return null;

  const numMatch = cleaned.match(/\d+/);
  if (numMatch) {
    const val = parseInt(numMatch[0], 10);
    if (Number.isFinite(val) && val > 0) return val;
  }

  const englishRules: [RegExp, number][] = [
    [/\b(eldest|oldest|first|only)\b/, 1],
    [/\bsecond\b/, 2],
    [/\bthird\b/, 3],
    [/\bfourth\b/, 4],
    [/\bfifth\b/, 5],
    [/\bsixth\b/, 6],
    [/\bseventh\b/, 7],
    [/\beighth\b/, 8],
    [/\bninth\b/, 9],
    [/\btenth\b/, 10],
  ];
  for (const [re, rank] of englishRules) {
    if (re.test(cleaned)) return rank;
  }

  const chineseRules: [RegExp, number][] = [
    [/([長长伯元始獨独]|老[大一]|第?[一壹][子男兒儿女孫孙]?)/, 1],
    [/([次仲]|老[二貳]|第?[二貳贰][子男兒儿女孫孙]?)/, 2],
    [/([叔]|老三|第?[三叁][子男兒儿女孫孙]?)/, 3],
    [/([季]|老四|第?[四肆][子男兒儿女孫孙]?)/, 4],
    [/(老五|第?[五伍][子男兒儿女孫孙]?)/, 5],
    [/(老六|第?[六陸陆][子男兒儿女孫孙]?)/, 6],
    [/(老七|第?[七柒][子男兒儿女孫孙]?)/, 7],
    [/(老八|第?[八捌][子男兒儿女孫孙]?)/, 8],
    [/(老九|第?[九玖][子男兒儿女孫孙]?)/, 9],
    [/(老十|第?[十拾][子男兒儿女孫孙]?)/, 10],
  ];
  for (const [re, rank] of chineseRules) {
    if (re.test(cleaned)) return rank;
  }

  return null;
}

/**
 * Compares seniority between two relatives:
 * 1. If both have a known Birth Year, sorts chronologically by Birth Year (then Birth Order on ties).
 * 2. If Birth Year is unknown for either/both, sorts by parsed Birth Order rank when comparable.
 * 3. Falls back cleanly to explicit Birth Order text, known Birth Year, and Chinese Name.
 */
export function compareSeniorityWithinBranch(
  a: DecryptedMember,
  b: DecryptedMember
): number {
  const ya = parseBirthYear(a.birthYear);
  const yb = parseBirthYear(b.birthYear);
  const ra = parseBirthOrderRank(a.birthOrder);
  const rb = parseBirthOrderRank(b.birthOrder);

  if (ya !== null && yb !== null) {
    if (ya !== yb) return ya - yb;
  }

  // Use Birth Order whenever either member has an unknown birth year (or same birth year)
  if ((ya === null || yb === null || ya === yb) && ra !== null && rb !== null) {
    if (ra !== rb) return ra - rb;
  }

  if (ya === null && yb === null) {
    if (ra !== null && rb === null) return -1;
    if (ra === null && rb !== null) return 1;

    const ba = (a.birthOrder || '').trim();
    const bb = (b.birthOrder || '').trim();
    if (ba && bb && ba !== bb) return ba.localeCompare(bb);
    if (ba && !bb) return -1;
    if (!ba && bb) return 1;
  }

  if (ya !== null && yb === null) return -1;
  if (ya === null && yb !== null) return 1;

  return a.chineseName.localeCompare(b.chineseName);
}

export function compareClanMembers(
  a: DecryptedMember,
  b: DecryptedMember,
  branchOrder?: BranchDefinition[]
): number {
  const rankDiff = getBranchRank(a.branch, branchOrder) - getBranchRank(b.branch, branchOrder);
  if (rankDiff !== 0) return rankDiff;
  if (a.branch !== b.branch && getBranchRank(a.branch, branchOrder) === 99) {
    return a.branch.localeCompare(b.branch);
  }
  return compareSeniorityWithinBranch(a, b);
}

export function compareClanMembersByGeneration(
  a: DecryptedMember,
  b: DecryptedMember,
  branchOrder?: BranchDefinition[]
): number {
  if (a.generation !== b.generation) return a.generation - b.generation;
  return compareClanMembers(a, b, branchOrder);
}
