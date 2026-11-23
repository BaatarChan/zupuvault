import { filterMembersForPdf } from './exportPdf';
import { romanizeChineseName, type RomanizationScheme } from './romanizeName';
import type {
  BranchDefinition,
  BranchScope,
  ClanMetadata,
  DecryptedMember,
  RecordSensitivity,
  UserProfile,
} from '../types/zupu';

type BranchValue = string;

const VALID_SENSITIVITY: RecordSensitivity[] = [
  'public_clan',
  'branch_restricted',
  'elder_sealed',
];

function sanitizeCsvCell(raw: string): string {
  const s = raw ?? '';
  // Neutralize formula-injection characters cleanly for spreadsheet tools
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportMembersToCsv(
  members: DecryptedMember[],
  currentUser: UserProfile,
  branchScope: BranchScope = 'all'
): { csv: string; count: number } {
  if (!currentUser.permissions.canExportVault) {
    throw new Error('Your role does not permit exporting vault records.');
  }

  const scoped = filterMembersForPdf(members, currentUser, branchScope);
  const allowPii = currentUser.permissions.canViewLivingPII;
  const allowSealed = currentUser.permissions.canViewElderSealed;

  const headers = [
    'id',
    'generation',
    'branch',
    'sensitivity',
    'chineseName',
    'romanizedName',
    'gender',
    'courtesyName',
    'artName',
    'birthOrder',
    'isLiving',
    'birthYear',
    'birthLunar',
    'deathYear',
    'deathLunar',
    'birthplace',
    'currentResidence',
    'occupationOrTitle',
    'parentIds',
    'spouseIds',
    'biography',
    'sealedTestament',
  ];

  const rows = scoped.map((m) => {
    const residence = m.isLiving
      ? allowPii
        ? m.currentResidence ?? ''
        : '[Living PII Redacted]'
      : '';
    const sealed = allowSealed ? m.sealedTestament ?? '' : '';

    return [
      m.id,
      String(m.generation),
      m.branch,
      m.sensitivity,
      m.chineseName,
      m.romanizedName,
      m.gender,
      m.courtesyName ?? '',
      m.artName ?? '',
      m.birthOrder ?? '',
      m.isLiving ? 'true' : 'false',
      m.birthYear ?? '',
      m.birthLunar ?? '',
      m.isLiving ? '' : m.deathYear ?? '',
      m.isLiving ? '' : m.deathLunar ?? '',
      m.birthplace ?? '',
      residence,
      m.occupationOrTitle ?? '',
      m.parentIds.join(';'),
      m.spouseIds.join(';'),
      m.biography ?? '',
      sealed,
    ]
      .map(sanitizeCsvCell)
      .join(',');
  });

  // Prepend UTF-8 BOM for Microsoft Excel compatibility with Traditional/Simplified Chinese
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return { csv, count: scoped.length };
}

function parseCsvRows(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      currentRow.push(cell);
      rows.push(currentRow);
      currentRow = [];
      cell = '';
    } else if (ch === '\n') {
      currentRow.push(cell);
      rows.push(currentRow);
      currentRow = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || currentRow.length > 0) {
    currentRow.push(cell);
    rows.push(currentRow);
  }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

function normalizeBranch(
  raw: string,
  fallback: BranchValue,
  customBranches?: BranchDefinition[]
): BranchValue {
  const clean = raw.trim();
  const v = clean.toLowerCase();
  if (!v) return fallback;
  if (customBranches && customBranches.length > 0) {
    const exact = customBranches.find(
      (b) =>
        b.id.toLowerCase() === v ||
        b.label.toLowerCase() === v ||
        b.chinese.toLowerCase() === v
    );
    if (exact) return exact.id;
  }
  if (['elder_branch', 'second_branch', 'third_branch'].includes(v)) return v;
  if (v.includes('second') || v.includes('二')) return 'second_branch';
  if (v.includes('third') || v.includes('三')) return 'third_branch';
  if (v.includes('elder') || v.includes('first') || v.includes('長') || v.includes('长')) {
    return 'elder_branch';
  }
  if (/^[a-z0-9_]{2,40}$/.test(v) && v !== 'all') return v;
  return fallback;
}

function normalizeSensitivity(raw: string): RecordSensitivity {
  const v = raw.trim().toLowerCase();
  if ((VALID_SENSITIVITY as string[]).includes(v)) return v as RecordSensitivity;
  if (v.includes('seal') || v.includes('密')) return 'elder_sealed';
  if (v.includes('branch') || v.includes('房')) return 'branch_restricted';
  return 'public_clan';
}

function ensureSymmetricalSpouses(list: DecryptedMember[]): DecryptedMember[] {
  const validIds = new Set(list.map((m) => m.id));
  const spouseMap = new Map<string, Set<string>>();
  for (const m of list) {
    spouseMap.set(m.id, new Set(m.spouseIds.filter((sid) => sid !== m.id && validIds.has(sid))));
  }
  for (const m of list) {
    for (const sid of spouseMap.get(m.id) ?? []) {
      spouseMap.get(sid)?.add(m.id);
    }
  }
  return list.map((m) => ({
    ...m,
    parentIds: m.parentIds.filter((pid) => pid !== m.id && validIds.has(pid)),
    spouseIds: Array.from(spouseMap.get(m.id) ?? []),
  }));
}

export function parseCsvToMembers(
  csvText: string,
  options: {
    defaultBranch?: BranchValue;
    romanizeScheme?: RomanizationScheme;
    branches?: BranchDefinition[];
  } = {}
): DecryptedMember[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    throw new Error('CSV file must include a header row and at least one member row.');
  }

  const headerMap = new Map<string, number>();
  rows[0].forEach((h, idx) => {
    headerMap.set(h.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ''), idx);
  });

  const getVal = (row: string[], ...aliases: string[]): string => {
    for (const a of aliases) {
      const idx = headerMap.get(a.toLowerCase());
      if (idx !== undefined && row[idx] !== undefined) {
        return row[idx].replace(/^'(?=[=+\-@])/, '').trim();
      }
    }
    return '';
  };

  const defaultBranch = options.defaultBranch ?? 'elder_branch';
  const scheme = options.romanizeScheme ?? 'cantonese';
  const now = new Date().toISOString();
  const parsed: DecryptedMember[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const chineseName = getVal(row, 'chinesename', 'zhname', '姓名', '中文姓名');
    let romanizedName = getVal(row, 'romanizedname', 'englishname', 'name', '英文姓名');

    if (!chineseName && !romanizedName) continue;
    const finalZh = chineseName || romanizedName;
    if (!romanizedName) {
      romanizedName = romanizeChineseName(finalZh, scheme) || finalZh;
    }

    const genNum = Number.parseInt(getVal(row, 'generation', 'gen', '世次', '世代'), 10);
    const generation = Number.isInteger(genNum) && genNum >= 1 && genNum <= 50 ? genNum : 1;
    const branch = normalizeBranch(
      getVal(row, 'branch', '房別', '房别'),
      defaultBranch,
      options.branches
    );
    const sensitivity = normalizeSensitivity(getVal(row, 'sensitivity', 'tier', '保密等級'));
    const rawGender = getVal(row, 'gender', 'sex', '性別', '性别').toLowerCase();
    const gender: 'male' | 'female' =
      rawGender === 'female' || rawGender === 'f' || rawGender === '女' ? 'female' : 'male';

    const rawLiving = getVal(row, 'isliving', 'living', '在世').toLowerCase();
    const deathYear = getVal(row, 'deathyear', 'died', '卒年');
    const isLiving = rawLiving ? rawLiving === 'true' || rawLiving === '1' || rawLiving === 'yes' || rawLiving === '是' : !deathYear;

    const rawId = getVal(row, 'id');
    const id = rawId && /^[a-zA-Z0-9_-]{2,64}$/.test(rawId) ? rawId : `csv_${Date.now()}_${i}`;

    const parentIds = getVal(row, 'parentids', 'parents')
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const spouseIds = getVal(row, 'spouseids', 'spouses')
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const residenceRaw = getVal(row, 'currentresidence', 'residence', '現居地', '现居地');
    const currentResidence = residenceRaw === '[Living PII Redacted]' ? '' : residenceRaw;

    parsed.push({
      id,
      generation,
      branch,
      sensitivity,
      parentIds,
      spouseIds,
      chineseName: finalZh,
      romanizedName,
      courtesyName: getVal(row, 'courtesyname', 'courtesy', '字'),
      artName: getVal(row, 'artname', 'hao', '號', '号'),
      birthOrder: getVal(row, 'birthorder', 'order', '排行'),
      gender,
      isLiving,
      birthYear: getVal(row, 'birthyear', 'born', '生年'),
      birthLunar: getVal(row, 'birthlunar', '農曆生辰'),
      deathYear: isLiving ? '' : deathYear,
      deathLunar: isLiving ? '' : getVal(row, 'deathlunar', '農曆忌辰'),
      birthplace: getVal(row, 'birthplace', 'origin', '祖籍', '出生地'),
      currentResidence: isLiving ? currentResidence : '',
      occupationOrTitle: getVal(row, 'occupationortitle', 'occupation', 'title', '職銜'),
      biography: getVal(row, 'biography', 'bio', 'notes', '生平事略'),
      sealedTestament: getVal(row, 'sealedtestament', 'sealed', '長老密錄'),
      updatedAt: now,
    });
  }

  if (parsed.length === 0) {
    throw new Error('No valid family member rows found in CSV file.');
  }
  return ensureSymmetricalSpouses(parsed);
}

// ============================================================================
// GEDCOM 5.5.1 Import & Export
// ============================================================================

export function exportMembersToGedcom(
  metadata: ClanMetadata,
  members: DecryptedMember[],
  currentUser: UserProfile,
  branchScope: BranchScope = 'all'
): { gedcom: string; count: number } {
  if (!currentUser.permissions.canExportVault) {
    throw new Error('Your role does not permit exporting vault records.');
  }

  const scoped = filterMembersForPdf(members, currentUser, branchScope);
  const allowPii = currentUser.permissions.canViewLivingPII;

  const xrefByMemberId = new Map<string, string>();
  scoped.forEach((m, idx) => {
    xrefByMemberId.set(m.id, `@I${idx + 1}@`);
  });

  // Group children + spouses cleanly into GEDCOM FAM records
  interface FamGroup {
    id: string;
    husb?: string;
    wife?: string;
    children: string[];
  }
  const fams: FamGroup[] = [];
  const famByPairKey = new Map<string, FamGroup>();
  const famsForIndi = new Map<string, string[]>();
  const famcForIndi = new Map<string, string>();

  const getOrCreateFam = (p1?: DecryptedMember, p2?: DecryptedMember): FamGroup => {
    const ids = [p1?.id, p2?.id].filter((x): x is string => Boolean(x)).sort();
    const key = ids.join('+');
    const existing = famByPairKey.get(key);
    if (existing) return existing;

    const famXref = `@F${fams.length + 1}@`;
    let husb: string | undefined;
    let wife: string | undefined;
    for (const p of [p1, p2].filter((x): x is DecryptedMember => Boolean(x))) {
      const xref = xrefByMemberId.get(p.id);
      if (!xref) continue;
      if (p.gender === 'female' && !wife) wife = xref;
      else if (!husb) husb = xref;
      else if (!wife) wife = xref;
      const list = famsForIndi.get(p.id) ?? [];
      if (!list.includes(famXref)) list.push(famXref);
      famsForIndi.set(p.id, list);
    }

    const fg: FamGroup = { id: famXref, husb, wife, children: [] };
    fams.push(fg);
    famByPairKey.set(key, fg);
    return fg;
  };

  const scopedMap = new Map(scoped.map((m) => [m.id, m]));

  // Register marriage pairs first
  for (const m of scoped) {
    for (const sid of m.spouseIds) {
      const sp = scopedMap.get(sid);
      if (sp) getOrCreateFam(m, sp);
    }
  }

  // Attach children to parent FAM
  for (const child of scoped) {
    const parents = child.parentIds
      .map((pid) => scopedMap.get(pid))
      .filter((p): p is DecryptedMember => Boolean(p));
    if (parents.length === 0) continue;

    const p1 = parents[0];
    let p2: DecryptedMember | undefined = parents[1];
    if (!p2 && p1.spouseIds.length === 1) {
      p2 = scopedMap.get(p1.spouseIds[0]);
    }
    const fg = getOrCreateFam(p1, p2);
    const childXref = xrefByMemberId.get(child.id);
    if (childXref && !fg.children.includes(childXref)) {
      fg.children.push(childXref);
      famcForIndi.set(child.id, fg.id);
    }
  }

  const lines: string[] = [
    '0 HEAD',
    '1 SOUR ZupuVault',
    `2 NAME ${metadata.clanName} (${metadata.clanChineseName})`,
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    `1 NOTE ${metadata.hallName || 'ZupuVault'} · ${metadata.ancestralOrigin || ''}`,
  ];

  const pushMultilineTag = (level: number, tag: string, content: string) => {
    const clean = content.replace(/\r/g, '').trim();
    if (!clean) return;
    const chunks = clean.split('\n');
    lines.push(`${level} ${tag} ${chunks[0]}`);
    for (let i = 1; i < chunks.length; i++) {
      lines.push(`${level + 1} CONT ${chunks[i]}`);
    }
  };

  for (const m of scoped) {
    const xref = xrefByMemberId.get(m.id)!;
    lines.push(`0 ${xref} INDI`);
    lines.push(`1 NAME ${m.romanizedName} /${m.chineseName}/`);
    lines.push(`1 SEX ${m.gender === 'female' ? 'F' : 'M'}`);

    if (m.birthYear || m.birthplace) {
      lines.push('1 BIRT');
      if (m.birthYear) lines.push(`2 DATE ${m.birthYear}`);
      if (m.birthplace) lines.push(`2 PLAC ${m.birthplace}`);
    }

    if (!m.isLiving) {
      lines.push('1 DEAT');
      if (m.deathYear) lines.push(`2 DATE ${m.deathYear}`);
    }

    if (m.occupationOrTitle) {
      lines.push(`1 OCCU ${m.occupationOrTitle}`);
    }

    if (m.isLiving && allowPii && m.currentResidence) {
      lines.push('1 RESI');
      lines.push(`2 PLAC ${m.currentResidence}`);
    }

    const noteParts = [
      m.courtesyName ? `字: ${m.courtesyName}` : '',
      m.artName ? `號: ${m.artName}` : '',
      m.birthOrder ? `排行: ${m.birthOrder}` : '',
      m.birthLunar ? `農曆生辰: ${m.birthLunar}` : '',
      !m.isLiving && m.deathLunar ? `農曆忌辰: ${m.deathLunar}` : '',
      m.biography || '',
    ].filter(Boolean);
    if (noteParts.length > 0) {
      pushMultilineTag(1, 'NOTE', noteParts.join(' · '));
    }

    const famc = famcForIndi.get(m.id);
    if (famc) lines.push(`1 FAMC ${famc}`);
    for (const famsId of famsForIndi.get(m.id) ?? []) {
      lines.push(`1 FAMS ${famsId}`);
    }
  }

  for (const f of fams) {
    lines.push(`0 ${f.id} FAM`);
    if (f.husb) lines.push(`1 HUSB ${f.husb}`);
    if (f.wife) lines.push(`1 WIFE ${f.wife}`);
    for (const ch of f.children) {
      lines.push(`1 CHIL ${ch}`);
    }
  }

  lines.push('0 TRLR');
  return { gedcom: lines.join('\r\n'), count: scoped.length };
}

function containsCjkChar(str: string): boolean {
  return /[\u3400-\u9fff]/.test(str);
}

function extractYearFromGedDate(raw: string): string {
  const m = raw.match(/\b(\d{4})\b/);
  return m ? m[1] : raw.trim();
}

export function parseGedcomToMembers(
  gedText: string,
  options: { defaultBranch?: BranchValue; romanizeScheme?: RomanizationScheme } = {}
): DecryptedMember[] {
  const defaultBranch = options.defaultBranch ?? 'elder_branch';
  const scheme = options.romanizeScheme ?? 'cantonese';
  const rawLines = gedText.replace(/^\uFEFF/, '').split(/\r?\n/);

  interface GedIndi {
    xref: string;
    rawName: string;
    gender: 'male' | 'female';
    birthYear: string;
    birthplace: string;
    hasDeath: boolean;
    deathYear: string;
    occupation: string;
    residence: string;
    notes: string[];
  }
  interface GedFam {
    xref: string;
    husb?: string;
    wife?: string;
    children: string[];
  }

  const indis = new Map<string, GedIndi>();
  const fams = new Map<string, GedFam>();

  let currentIndi: GedIndi | null = null;
  let currentFam: GedFam | null = null;
  let currentTag1 = '';

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(\d+)\s+(@[^@]+@|\S+)(?:\s+(.*))?$/);
    if (!match) continue;
    const level = Number(match[1]);
    const token = match[2];
    const rest = (match[3] ?? '').trim();

    if (level === 0) {
      currentIndi = null;
      currentFam = null;
      currentTag1 = '';
      if (token.startsWith('@') && rest === 'INDI') {
        currentIndi = {
          xref: token,
          rawName: '',
          gender: 'male',
          birthYear: '',
          birthplace: '',
          hasDeath: false,
          deathYear: '',
          occupation: '',
          residence: '',
          notes: [],
        };
        indis.set(token, currentIndi);
      } else if (token.startsWith('@') && rest === 'FAM') {
        currentFam = { xref: token, children: [] };
        fams.set(token, currentFam);
      }
      continue;
    }

    if (currentIndi) {
      if (level === 1) {
        currentTag1 = token;
        if (token === 'NAME' && !currentIndi.rawName) {
          currentIndi.rawName = rest;
        } else if (token === 'SEX') {
          currentIndi.gender = rest.toUpperCase().startsWith('F') ? 'female' : 'male';
        } else if (token === 'DEAT') {
          currentIndi.hasDeath = true;
        } else if (token === 'OCCU') {
          currentIndi.occupation = rest;
        } else if (token === 'NOTE') {
          currentIndi.notes.push(rest);
        }
      } else if (level === 2) {
        if (currentTag1 === 'BIRT') {
          if (token === 'DATE') currentIndi.birthYear = extractYearFromGedDate(rest);
          if (token === 'PLAC') currentIndi.birthplace = rest;
        } else if (currentTag1 === 'DEAT') {
          if (token === 'DATE') currentIndi.deathYear = extractYearFromGedDate(rest);
        } else if (currentTag1 === 'RESI') {
          if (token === 'PLAC' || token === 'ADDR') currentIndi.residence = rest;
        } else if (currentTag1 === 'NOTE') {
          if (token === 'CONT') currentIndi.notes.push(rest);
          else if (token === 'CONC' && currentIndi.notes.length > 0) {
            currentIndi.notes[currentIndi.notes.length - 1] += rest;
          }
        }
      }
    } else if (currentFam && level === 1) {
      if (token === 'HUSB') currentFam.husb = rest;
      else if (token === 'WIFE') currentFam.wife = rest;
      else if (token === 'CHIL') currentFam.children.push(rest);
    }
  }

  if (indis.size === 0) {
    throw new Error('No INDI (individual) records found in GEDCOM file.');
  }

  const now = new Date().toISOString();
  const stamp = Date.now();
  const idByXref = new Map<string, string>();
  let idx = 0;
  for (const xref of indis.keys()) {
    idx++;
    const safeXref = xref.replace(/[^a-zA-Z0-9_-]/g, '');
    idByXref.set(xref, `ged_${stamp}_${idx}_${safeXref}`);
  }

  const parentsOf = new Map<string, Set<string>>();
  const spousesOf = new Map<string, Set<string>>();
  for (const id of idByXref.values()) {
    parentsOf.set(id, new Set());
    spousesOf.set(id, new Set());
  }

  for (const fam of fams.values()) {
    const hId = fam.husb ? idByXref.get(fam.husb) : undefined;
    const wId = fam.wife ? idByXref.get(fam.wife) : undefined;
    if (hId && wId) {
      spousesOf.get(hId)?.add(wId);
      spousesOf.get(wId)?.add(hId);
    }
    for (const cXref of fam.children) {
      const cId = idByXref.get(cXref);
      if (!cId) continue;
      if (hId) parentsOf.get(cId)?.add(hId);
      if (wId) parentsOf.get(cId)?.add(wId);
    }
  }

  // Assign generation levels via BFS topological propagation from root individuals
  const childrenOf = new Map<string, string[]>();
  for (const [cid, pids] of parentsOf.entries()) {
    for (const pid of pids) {
      const list = childrenOf.get(pid) ?? [];
      list.push(cid);
      childrenOf.set(pid, list);
    }
  }

  const genById = new Map<string, number>();
  const queue: string[] = [];
  for (const id of idByXref.values()) {
    if ((parentsOf.get(id)?.size ?? 0) === 0) {
      genById.set(id, 1);
      queue.push(id);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const currGen = genById.get(curr) ?? 1;
    // Align same-generation spouses
    for (const sid of spousesOf.get(curr) ?? []) {
      const spGen = genById.get(sid);
      if (spGen === undefined || spGen < currGen) {
        genById.set(sid, currGen);
        queue.push(sid);
      }
    }
    for (const cid of childrenOf.get(curr) ?? []) {
      const nextGen = Math.min(30, currGen + 1);
      if ((genById.get(cid) ?? 0) < nextGen) {
        genById.set(cid, nextGen);
        queue.push(cid);
      }
    }
  }

  const members: DecryptedMember[] = [];
  for (const [xref, indi] of indis.entries()) {
    const id = idByXref.get(xref)!;
    const parts = indi.rawName.split('/').map((s) => s.trim()).filter(Boolean);
    let chineseName = '';
    let romanizedName = '';

    for (const part of parts) {
      if (containsCjkChar(part)) {
        chineseName = chineseName ? `${chineseName}${part}` : part;
      } else {
        romanizedName = romanizedName ? `${romanizedName} ${part}` : part;
      }
    }

    if (!chineseName) {
      chineseName = romanizedName || xref.replace(/@/g, '');
    }
    if (!romanizedName) {
      romanizedName = romanizeChineseName(chineseName, scheme) || chineseName;
    }

    const isLiving = !indi.hasDeath && !indi.deathYear;

    members.push({
      id,
      generation: genById.get(id) ?? 1,
      branch: defaultBranch,
      sensitivity: 'public_clan',
      parentIds: Array.from(parentsOf.get(id) ?? []),
      spouseIds: Array.from(spousesOf.get(id) ?? []),
      chineseName,
      romanizedName,
      gender: indi.gender,
      isLiving,
      birthYear: indi.birthYear,
      deathYear: isLiving ? '' : indi.deathYear,
      birthplace: indi.birthplace,
      currentResidence: isLiving ? indi.residence : '',
      occupationOrTitle: indi.occupation,
      biography: indi.notes.join('\n'),
      updatedAt: now,
    });
  }

  return ensureSymmetricalSpouses(members);
}
