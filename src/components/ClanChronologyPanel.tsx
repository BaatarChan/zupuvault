import React, { useMemo, useState } from 'react';
import { Calendar, CalendarClock, Download, GitBranch, Lock, MapPin, Users } from 'lucide-react';
import { filterMembersForPdf } from '../lib/exportPdf';
import { useI18n } from '../lib/i18n';
import { compareClanMembersByGeneration } from '../lib/lineageOrder';
import {
  computeUpcomingMemorials,
  exportMemorialsToIcs,
  type MemorialEventKind,
} from '../lib/memorialCalendar';
import { getBranchesFromMetadata, getBranchLabel } from '../lib/roles';
import type {
  BranchScope,
  ClanMetadata,
  DecryptedMember,
  UserProfile,
} from '../types/zupu';

interface ClanChronologyPanelProps {
  metadata: ClanMetadata;
  members: DecryptedMember[];
  currentUser: UserProfile;
  onSelectMember: (id: string) => void;
}

const GENERATION_CHINESE = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function formatGenZh(gen: number): string {
  return gen >= 1 && gen <= GENERATION_CHINESE.length
    ? `第${GENERATION_CHINESE[gen - 1]}世`
    : `第${gen}世`;
}

function parseNumericYear(raw?: string): number | null {
  if (!raw) return null;
  const match = raw.match(/\b(1\d{3}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export const ClanChronologyPanel: React.FC<ClanChronologyPanelProps> = ({
  metadata,
  members,
  currentUser,
  onSelectMember,
}) => {
  const { locale, t } = useI18n();
  const [branchFilter, setBranchFilter] = useState<BranchScope>('all');
  const [memorialFilter, setMemorialFilter] = useState<'all' | MemorialEventKind>('all');
  const [icsNotice, setIcsNotice] = useState<string | null>(null);

  const branches = useMemo(() => getBranchesFromMetadata(metadata), [metadata]);

  const authorizedMembers = useMemo(
    () => filterMembersForPdf(members, currentUser, branchFilter, branches),
    [members, currentUser, branchFilter, branches]
  );

  const upcomingMemorials = useMemo(
    () => computeUpcomingMemorials(authorizedMembers, currentUser),
    [authorizedMembers, currentUser]
  );

  const filteredMemorials = useMemo(
    () =>
      memorialFilter === 'all'
        ? upcomingMemorials
        : upcomingMemorials.filter((ev) => ev.kind === memorialFilter),
    [upcomingMemorials, memorialFilter]
  );

  const handleExportIcs = () => {
    const ics = exportMemorialsToIcs(metadata.clanName, filteredMemorials);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = metadata.clanName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'zupu';
    a.href = url;
    a.download = `${slug}_memorials.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setIcsNotice(`${t.chronology.memorialIcsSuccess} (${filteredMemorials.length})`);
    window.setTimeout(() => setIcsNotice(null), 4000);
  };

  const stats = useMemo(() => {
    const total = authorizedMembers.length;
    const living = authorizedMembers.filter((m) => m.isLiving).length;
    const ancestors = total - living;

    const genSet = Array.from(new Set(authorizedMembers.map((m) => m.generation))).sort(
      (a, b) => a - b
    );
    const byGen = genSet.map((gen) => {
      const list = authorizedMembers.filter((m) => m.generation === gen);
      const genLiving = list.filter((m) => m.isLiving).length;
      return {
        generation: gen,
        poemChar: metadata.generationPoem[gen - 1] ?? '',
        total: list.length,
        living: genLiving,
        ancestors: list.length - genLiving,
      };
    });
    const maxGenCount = Math.max(1, ...byGen.map((g) => g.total));

    const knownBranchIds = branches.map((b) => b.id);
    for (const m of authorizedMembers) {
      if (m.branch && !knownBranchIds.includes(m.branch)) {
        knownBranchIds.push(m.branch);
      }
    }
    const byBranch = knownBranchIds.map((b) => {
      const list = authorizedMembers.filter((m) => m.branch === b);
      const gens = list.map((m) => m.generation);
      return {
        branch: b,
        total: list.length,
        living: list.filter((m) => m.isLiving).length,
        minGen: gens.length > 0 ? Math.min(...gens) : null,
        maxGen: gens.length > 0 ? Math.max(...gens) : null,
      };
    });

    // Unique spouse unions
    const unionKeys = new Set<string>();
    const scopedIds = new Set(authorizedMembers.map((m) => m.id));
    for (const m of authorizedMembers) {
      for (const sid of m.spouseIds) {
        if (scopedIds.has(sid)) {
          unionKeys.add([m.id, sid].sort().join('+'));
        }
      }
    }

    // Dated chronology timeline
    const datedEntries = authorizedMembers
      .map((m) => ({
        member: m,
        birthNum: parseNumericYear(m.birthYear),
        deathNum: m.isLiving ? null : parseNumericYear(m.deathYear),
      }))
      .sort((a, b) => {
        if (a.birthNum !== null && b.birthNum !== null && a.birthNum !== b.birthNum) {
          return a.birthNum - b.birthNum;
        }
        if (a.birthNum !== null && b.birthNum === null) return -1;
        if (a.birthNum === null && b.birthNum !== null) return 1;
        return compareClanMembersByGeneration(a.member, b.member, branches);
      });

    const earliestYear = datedEntries.reduce<number | null>(
      (min, item) =>
        item.birthNum !== null && (min === null || item.birthNum < min) ? item.birthNum : min,
      null
    );
    const latestYear = datedEntries.reduce<number | null>(
      (max, item) =>
        item.birthNum !== null && (max === null || item.birthNum > max) ? item.birthNum : max,
      null
    );

    // Ancestral birthplaces & living residence hubs
    const originCounts = new Map<string, number>();
    const residenceCounts = new Map<string, number>();
    for (const m of authorizedMembers) {
      const bp = (m.birthplace || '').trim();
      if (bp) {
        originCounts.set(bp, (originCounts.get(bp) ?? 0) + 1);
      }
      if (m.isLiving && currentUser.permissions.canViewLivingPII) {
        const res = (m.currentResidence || '').trim();
        if (res) {
          residenceCounts.set(res, (residenceCounts.get(res) ?? 0) + 1);
        }
      }
    }

    const topOrigins = Array.from(originCounts.entries()).sort((a, b) => b[1] - a[1]);
    const topResidences = Array.from(residenceCounts.entries()).sort((a, b) => b[1] - a[1]);

    return {
      total,
      living,
      ancestors,
      genCount: genSet.length,
      byGen,
      maxGenCount,
      byBranch,
      unionCount: unionKeys.size,
      datedEntries,
      earliestYear,
      latestYear,
      topOrigins,
      topResidences,
    };
  }, [authorizedMembers, branches, metadata.generationPoem, currentUser.permissions.canViewLivingPII]);

  return (
    <div className="space-y-8">
      {/* Header + Branch Filter */}
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500">{t.chronology.kicker}</p>
          <h2 className="font-display text-3xl font-semibold text-stone-900 mt-0.5">
            {t.chronology.title}
          </h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-lg overflow-x-auto">
          {(['all', ...branches.map((b) => b.id)] as BranchScope[]).map(
            (scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => setBranchFilter(scope)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  branchFilter === scope
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {getBranchLabel(scope, locale, branches)}
              </button>
            )
          )}
        </div>
      </div>

      {/* 4-Column Archival Key Metrics Strip */}
      <section className="bg-white border border-stone-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-stone-200">
        <div className="p-5 sm:p-6">
          <p className="text-xs text-stone-500">{t.chronology.metricRecords}</p>
          <p className="font-mono-tabular text-3xl font-semibold text-stone-900 mt-1">
            {stats.total}
          </p>
          <p className="text-xs text-stone-500 mt-1 font-mono-tabular">
            {stats.ancestors} {t.common.ancestor} · {stats.living} {t.common.living}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-stone-500">{t.chronology.metricGenerations}</p>
          <p className="font-mono-tabular text-3xl font-semibold text-[#9E2A2B] mt-1">
            {stats.genCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {metadata.generationPoem.length > 0
              ? `${metadata.generationPoem.slice(0, 8).join('')} (${t.tree.genPoemSuffix})`
              : t.common.noneRecorded}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-stone-500">{t.chronology.metricSpan}</p>
          <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-stone-900 mt-1">
            {stats.earliestYear && stats.latestYear
              ? `${stats.earliestYear}–${stats.latestYear}`
              : '—'}
          </p>
          <p className="text-xs text-stone-500 mt-1">{t.chronology.recordedBirthSpan}</p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-xs text-stone-500">{t.chronology.metricUnions}</p>
          <p className="font-mono-tabular text-3xl font-semibold text-stone-900 mt-1">
            {stats.unionCount}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {stats.byBranch.filter((b) => b.total > 0).length} {t.chronology.activeBranchesSuffix}
          </p>
        </div>
      </section>

      {stats.total === 0 ? (
        <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
          <p className="font-display text-2xl font-semibold text-stone-900">
            {t.tree.emptyTitle}
          </p>
          <p className="text-xs text-stone-500 mt-1">{t.tree.emptyFilterDesc}</p>
        </div>
      ) : (
        <>
          {/* Generational Breakdown & Branch Balance */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6 space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#9E2A2B]" />
                    {t.chronology.genBreakdownTitle}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">{t.chronology.genBreakdownDesc}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-stone-500 shrink-0">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 bg-[#9E2A2B] rounded-xs" />
                    {t.common.ancestor}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 bg-stone-400 rounded-xs" />
                    {t.common.living}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {stats.byGen.map((row) => {
                  const pctTotal = Math.round((row.total / stats.maxGenCount) * 100);
                  const ancPct = row.total > 0 ? Math.round((row.ancestors / row.total) * 100) : 0;
                  const sharePct =
                    stats.total > 0 ? Math.round((row.total / stats.total) * 100) : 0;

                  return (
                    <div key={row.generation} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-stone-800">
                          <span className="font-serif-zh text-[#9E2A2B] mr-1.5">
                            {formatGenZh(row.generation)}
                          </span>
                          <span className="font-mono-tabular text-stone-500">
                            ({t.common.genPrefix} {row.generation}
                            {row.poemChar ? ` · ${row.poemChar}` : ''})
                          </span>
                        </span>
                        <span className="font-mono-tabular text-stone-700">
                          {row.total} ({sharePct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#F5F1E8] rounded overflow-hidden">
                        <div
                          className="h-full flex"
                          style={{ width: `${Math.max(4, pctTotal)}%` }}
                        >
                          {row.ancestors > 0 && (
                            <div
                              className="h-full bg-[#9E2A2B]"
                              style={{ width: `${ancPct}%` }}
                            />
                          )}
                          {row.living > 0 && (
                            <div
                              className="h-full bg-stone-500"
                              style={{ width: `${100 - ancPct}%` }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Branch Balance & Geographic Origins */}
            <section className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="border-b border-stone-200 pb-3">
                  <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-[#9E2A2B]" />
                    {t.chronology.branchBalanceTitle}
                  </h3>
                </div>
                <dl className="divide-y divide-stone-100 text-xs">
                  {stats.byBranch.map((b) => (
                    <div key={b.branch} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <dt className="font-semibold text-stone-900">
                          {getBranchLabel(b.branch, locale, branches)}
                        </dt>
                        <dd className="text-stone-500 mt-0.5 font-mono-tabular">
                          {b.minGen && b.maxGen
                            ? `${t.common.genPrefix} ${b.minGen}–${b.maxGen}`
                            : t.common.noneRecorded}
                        </dd>
                      </div>
                      <div className="text-right font-mono-tabular">
                        <p className="text-sm font-semibold text-stone-900">{b.total}</p>
                        <p className="text-[11px] text-stone-500">
                          {b.living} {t.common.living}
                        </p>
                      </div>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
                <div className="border-b border-stone-200 pb-3">
                  <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#9E2A2B]" />
                    {t.chronology.migrationTitle}
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <p className="font-semibold text-stone-700 mb-2">
                      {t.chronology.ancestralTownsLabel}
                    </p>
                    {stats.topOrigins.length === 0 ? (
                      <p className="text-stone-400">{t.common.noneRecorded}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {stats.topOrigins.slice(0, 6).map(([place, count]) => (
                          <li
                            key={place}
                            className="flex items-center justify-between text-stone-700"
                          >
                            <span className="truncate">{place}</span>
                            <span className="font-mono-tabular text-stone-500 shrink-0">
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pt-3 border-t border-stone-100">
                    <p className="font-semibold text-stone-700 mb-2">
                      {t.chronology.livingHubsLabel}
                    </p>
                    {!currentUser.permissions.canViewLivingPII ? (
                      <p className="text-stone-400 inline-flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        {t.drawer.piiRestrictedMsg}
                      </p>
                    ) : stats.topResidences.length === 0 ? (
                      <p className="text-stone-400">{t.common.noneRecorded}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {stats.topResidences.slice(0, 6).map(([place, count]) => (
                          <li
                            key={place}
                            className="flex items-center justify-between text-stone-700"
                          >
                            <span className="truncate">{place}</span>
                            <span className="font-mono-tabular text-stone-500 shrink-0">
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Chronological Era Timeline Table */}
          <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 bg-[#FBF9F5] flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#9E2A2B]" />
                  {t.chronology.timelineTitle}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">{t.chronology.timelineDesc}</p>
              </div>
              <span className="text-xs font-mono-tabular text-stone-500 shrink-0">
                {stats.datedEntries.length} {t.pdf.recordsCount}
              </span>
            </div>

            <div className="divide-y divide-stone-100">
              {stats.datedEntries.map(({ member }) => {
                const lifespan = member.isLiving
                  ? `${member.birthYear || '?'} – ${t.common.present}`
                  : `${member.birthYear || '?'} – ${member.deathYear || '?'}`;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onSelectMember(member.id)}
                    className="w-full px-6 py-3.5 text-left hover:bg-[#FBF9F5] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-2.5 min-w-0">
                      <span className="font-mono-tabular text-xs font-medium text-[#9E2A2B] w-28 shrink-0">
                        {lifespan}
                      </span>
                      <span className="font-serif-zh text-base font-semibold text-stone-900">
                        {member.chineseName}
                      </span>
                      <span className="text-xs text-stone-600">{member.romanizedName}</span>
                      {member.occupationOrTitle && (
                        <span className="text-xs text-stone-500 truncate">
                          · {member.occupationOrTitle}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-stone-500 font-mono-tabular shrink-0">
                      {formatGenZh(member.generation)} · {getBranchLabel(member.branch, locale, branches)}
                      {member.birthplace ? ` · ${member.birthplace}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Ancestral Memorial Calendar & .ics Export */}
          <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 bg-[#FBF9F5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#9E2A2B]" />
                  {t.chronology.memorialTitle}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">{t.chronology.memorialDesc}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-lg overflow-x-auto">
                  {(
                    [
                      ['all', t.chronology.memorialFilterAll],
                      ['death_anniversary', t.chronology.memorialFilterDeath],
                      ['birthday', t.chronology.memorialFilterBirth],
                      ['festival', t.chronology.memorialFilterFestival],
                    ] as const
                  ).map(([kindKey, label]) => (
                    <button
                      key={kindKey}
                      type="button"
                      onClick={() => setMemorialFilter(kindKey)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        memorialFilter === kindKey
                          ? 'bg-white text-stone-900 shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={filteredMemorials.length === 0}
                  onClick={handleExportIcs}
                  className="px-3.5 py-2 border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#9E2A2B]" />
                  {t.chronology.memorialExportIcs}
                </button>
              </div>
            </div>

            {icsNotice && (
              <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-900">
                {icsNotice}
              </div>
            )}

            {filteredMemorials.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500">
                {t.chronology.memorialEmpty}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {filteredMemorials.map((ev) => {
                  const countdownLabel =
                    ev.daysUntil === 0
                      ? t.chronology.memorialToday
                      : ev.daysUntil === 1
                        ? t.chronology.memorialTomorrow
                        : `${t.chronology.memorialInDaysPrefix} ${ev.daysUntil} ${t.chronology.memorialInDaysSuffix}`;

                  const rowBody = (
                    <div className="w-full px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
                      <div className="flex flex-wrap items-baseline gap-3 min-w-0">
                        <span className="font-mono-tabular text-xs font-semibold text-[#9E2A2B] w-24 shrink-0">
                          {ev.gregorianIso}
                        </span>
                        <span className="font-serif-zh text-sm font-semibold text-stone-900">
                          {ev.title}
                        </span>
                        {ev.lunarLabel && (
                          <span className="text-xs font-serif-zh text-stone-600">
                            ({ev.lunarLabel})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-stone-500 hidden md:inline">{ev.subtitle}</span>
                        <span className="font-mono-tabular font-medium text-stone-700">
                          {countdownLabel}
                        </span>
                      </div>
                    </div>
                  );

                  return ev.memberId ? (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelectMember(ev.memberId!)}
                      className="w-full hover:bg-[#FBF9F5] transition-colors block"
                    >
                      {rowBody}
                    </button>
                  ) : (
                    <div key={ev.id} className="bg-[#FDFBF7]">
                      {rowBody}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
