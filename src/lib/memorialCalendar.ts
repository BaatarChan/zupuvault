import type { DecryptedMember, UserProfile } from '../types/zupu';

export type MemorialEventKind = 'death_anniversary' | 'birthday' | 'festival';

export interface MemorialEvent {
  id: string;
  kind: MemorialEventKind;
  title: string;
  subtitle: string;
  lunarLabel: string;
  gregorianDate: Date;
  gregorianIso: string; // YYYY-MM-DD
  daysUntil: number;
  memberId?: string;
}

const MONTH_CN_MAP: Record<string, number> = {
  正: 1,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  冬: 11,
  十一: 11,
  臘: 12,
  腊: 12,
  十二: 12,
};

const DIGIT_CN: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function parseChineseDay(raw: string): number | null {
  const s = raw.trim().replace(/日$/, '');
  if (!s) return null;
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 30 ? n : null;
  }
  if (s === '初十') return 10;
  if (s === '二十') return 20;
  if (s === '三十') return 30;
  if (s.startsWith('初') && s.length === 2) {
    return DIGIT_CN[s[1]] ?? null;
  }
  if (s.startsWith('十')) {
    if (s.length === 1) return 10;
    const d = DIGIT_CN[s[1]];
    return d ? 10 + d : null;
  }
  if (s.startsWith('廿')) {
    if (s.length === 1) return 20;
    if (s[1] === '十') return 20;
    const d = DIGIT_CN[s[1]];
    return d ? 20 + d : null;
  }
  if (s.startsWith('二十') && s.length === 3) {
    const d = DIGIT_CN[s[2]];
    return d ? 20 + d : null;
  }
  return null;
}

export function parseLunarMonthDay(raw?: string): { month: number; day: number } | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  // Match Chinese format like "正月初九", "八月初三", "冬月十九", "臘月廿四", "十月十日"
  const zhMatch = text.match(/(十一|十二|[正一二三四五六七八九十冬臘腊])月(初[一二三四五六七八九十]|二十[一二三四五六七八九]?|廿[一二三四五六七八九十]?|十[一二三四五六七八九]?|三十|\d{1,2})日?/);
  if (zhMatch) {
    const month = MONTH_CN_MAP[zhMatch[1]];
    const day = parseChineseDay(zhMatch[2]);
    if (month && day) return { month, day };
  }

  // Match numeric lunar format like "8/3", "08-03"
  const numMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})\b/);
  if (numMatch) {
    const month = Number(numMatch[1]);
    const day = Number(numMatch[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 30) {
      return { month, day };
    }
  }

  return null;
}

export function parseGregorianMonthDay(raw?: string): { month: number; day: number } | null {
  if (!raw) return null;
  const m = raw.trim().match(/\b\d{4}[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return { month, day };
  }
  return null;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeUpcomingMemorials(
  members: DecryptedMember[],
  currentUser: UserProfile,
  referenceDate: Date = new Date()
): MemorialEvent[] {
  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0
  );

  // Pre-compute next 370 days mapping both Gregorian MM-DD and Lunar MM-DD -> Date
  const lunarLookup = new Map<string, { date: Date; daysUntil: number }>();
  const gregorianLookup = new Map<string, { date: Date; daysUntil: number }>();

  let chineseFmt: Intl.DateTimeFormat | null = null;
  try {
    chineseFmt = new Intl.DateTimeFormat('en-u-ca-chinese', {
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    chineseFmt = null;
  }

  for (let offset = 0; offset <= 370; offset++) {
    const d = new Date(startOfToday.getTime() + offset * 86_400_000);
    const gKey = `${d.getMonth() + 1}-${d.getDate()}`;
    if (!gregorianLookup.has(gKey)) {
      gregorianLookup.set(gKey, { date: d, daysUntil: offset });
    }
    if (chineseFmt) {
      const parts = chineseFmt.formatToParts(d);
      const mStr = parts.find((p) => p.type === 'month')?.value ?? '';
      const dStr = parts.find((p) => p.type === 'day')?.value ?? '';
      const lMonth = Number.parseInt(mStr, 10);
      const lDay = Number.parseInt(dStr, 10);
      // Prefer non-leap month ("bis") when matching standard anniversaries
      const isLeap = mStr.includes('bis');
      if (Number.isFinite(lMonth) && Number.isFinite(lDay) && !isLeap) {
        const lKey = `${lMonth}-${lDay}`;
        if (!lunarLookup.has(lKey)) {
          lunarLookup.set(lKey, { date: d, daysUntil: offset });
        }
      }
    }
  }

  const events: MemorialEvent[] = [];

  // Add major clan observance festivals: Qingming (Apr 5) & Chongyang (Lunar 9/9)
  const qingming = gregorianLookup.get('4-5');
  if (qingming) {
    events.push({
      id: 'festival_qingming',
      kind: 'festival',
      title: '清明節 · Qingming Ancestral Sweeping',
      subtitle: 'Traditional clan tomb sweeping & ancestral hall offerings',
      lunarLabel: 'April 5 (Solar Term)',
      gregorianDate: qingming.date,
      gregorianIso: toIsoDate(qingming.date),
      daysUntil: qingming.daysUntil,
    });
  }

  const chongyang = lunarLookup.get('9-9');
  if (chongyang) {
    events.push({
      id: 'festival_chongyang',
      kind: 'festival',
      title: '重陽節 · Chongyang Double-Ninth',
      subtitle: 'Autumn ancestral veneration & elder fellowship gathering',
      lunarLabel: '農曆九月初九',
      gregorianDate: chongyang.date,
      gregorianIso: toIsoDate(chongyang.date),
      daysUntil: chongyang.daysUntil,
    });
  }

  const allowLivingPii = currentUser.permissions.canViewLivingPII;

  for (const m of members) {
    // Death anniversary (忌辰) for ancestors
    if (!m.isLiving) {
      const lunarDeath = parseLunarMonthDay(m.deathLunar);
      const gregDeath = parseGregorianMonthDay(m.deathYear);
      const match = lunarDeath
        ? lunarLookup.get(`${lunarDeath.month}-${lunarDeath.day}`)
        : gregDeath
          ? gregorianLookup.get(`${gregDeath.month}-${gregDeath.day}`)
          : undefined;
      if (match) {
        events.push({
          id: `mem_death_${m.id}`,
          kind: 'death_anniversary',
          title: `${m.chineseName} (${m.romanizedName}) · 忌辰`,
          subtitle: m.deathYear ? `Recorded passing: ${m.deathYear}` : 'Ancestral memorial day',
          lunarLabel: m.deathLunar || m.deathYear || '',
          gregorianDate: match.date,
          gregorianIso: toIsoDate(match.date),
          daysUntil: match.daysUntil,
          memberId: m.id,
        });
      }
    }

    // Birthday / 壽誕 (respecting living PII permissions)
    if (!m.isLiving || allowLivingPii) {
      const lunarBirth = parseLunarMonthDay(m.birthLunar);
      const gregBirth = parseGregorianMonthDay(m.birthYear);
      const match = lunarBirth
        ? lunarLookup.get(`${lunarBirth.month}-${lunarBirth.day}`)
        : gregBirth
          ? gregorianLookup.get(`${gregBirth.month}-${gregBirth.day}`)
          : undefined;
      if (match) {
        events.push({
          id: `mem_birth_${m.id}`,
          kind: 'birthday',
          title: `${m.chineseName} (${m.romanizedName}) · ${m.isLiving ? '壽誕' : '冥壽'}`,
          subtitle: m.birthYear ? `Birth year: ${m.birthYear}` : 'Recorded birth commemoration',
          lunarLabel: m.birthLunar || m.birthYear || '',
          gregorianDate: match.date,
          gregorianIso: toIsoDate(match.date),
          daysUntil: match.daysUntil,
          memberId: m.id,
        });
      }
    }
  }

  return events.sort((a, b) => a.daysUntil - b.daysUntil || a.title.localeCompare(b.title));
}

function escapeIcsText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function exportMemorialsToIcs(clanName: string, events: MemorialEvent[]): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ZupuVault//Ancestral Memorial Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(`${clanName} Memorials`)}`,
  ];

  for (const ev of events) {
    const dtStart = ev.gregorianIso.replace(/-/g, '');
    const nextDay = new Date(ev.gregorianDate.getTime() + 86_400_000);
    const dtEnd = toIsoDate(nextDay).replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}-${dtStart}@zupuvault.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    lines.push(
      `DESCRIPTION:${escapeIcsText(`${ev.subtitle}${ev.lunarLabel ? ` (${ev.lunarLabel})` : ''}`)}`
    );
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
