import React, { useMemo, useState } from 'react';
import { GitMerge, Lock, Search } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { compareClanMembersByGeneration } from '../lib/lineageOrder';
import {
  DEFAULT_BRANCHES,
  getBranchLabel,
  getSensitivityLabel,
  SENSITIVITY_META,
} from '../lib/roles';
import type {
  BranchDefinition,
  DecryptedMember,
  RecordSensitivity,
  UserProfile,
} from '../types/zupu';

interface ClanRegistryTableProps {
  members: DecryptedMember[];
  branches?: BranchDefinition[];
  currentUser: UserProfile;
  onSelectMember: (id: string) => void;
  onOpenAudit?: () => void;
}

export const ClanRegistryTable: React.FC<ClanRegistryTableProps> = ({
  members,
  branches = DEFAULT_BRANCHES,
  currentUser,
  onSelectMember,
  onOpenAudit,
}) => {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState('');
  const [sensitivityFilter, setSensitivityFilter] = useState<'all' | RecordSensitivity>('all');

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...members]
      .filter((m) => {
        if (sensitivityFilter !== 'all' && m.sensitivity !== sensitivityFilter) return false;
        if (!q) return true;
        return (
          m.chineseName.toLowerCase().includes(q) ||
          m.romanizedName.toLowerCase().includes(q) ||
          (m.courtesyName || '').toLowerCase().includes(q) ||
          (m.birthplace || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => compareClanMembersByGeneration(a, b, branches));
  }, [members, branches, query, sensitivityFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <p className="text-xs text-stone-500">{t.ledger.kicker}</p>
          <h2 className="font-display text-3xl font-semibold text-stone-900 mt-0.5">
            {t.ledger.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.ledger.filterPlaceholder}
              className="pl-9 pr-3.5 py-2 text-xs bg-white border border-stone-300 rounded-lg w-56 focus:outline-none focus:border-[#9E2A2B]"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-lg">
            {(['all', 'public_clan', 'branch_restricted', 'elder_sealed'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setSensitivityFilter(tier)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sensitivityFilter === tier
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {tier === 'all' ? t.common.allTiers : getSensitivityLabel(tier, locale)}
              </button>
            ))}
          </div>

          {currentUser.permissions.canEditLineage && onOpenAudit && (
            <button
              type="button"
              onClick={onOpenAudit}
              className="px-3.5 py-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <GitMerge className="w-3.5 h-3.5 text-[#9E2A2B]" />
              {t.audit.openBtn}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr className="border-b border-stone-200 bg-[#FBF9F5] text-xs font-medium text-stone-500">
              <th className="py-3 px-4">{t.ledger.colGen}</th>
              <th className="py-3 px-4">{t.ledger.colName}</th>
              <th className="py-3 px-4">{t.ledger.colCourtesy}</th>
              <th className="py-3 px-4">{t.ledger.colBranch}</th>
              <th className="py-3 px-4">{t.ledger.colLifespan}</th>
              <th className="py-3 px-4">{t.ledger.colOrigin}</th>
              <th className="py-3 px-4">{t.ledger.colTier}</th>
              <th className="py-3 px-4 text-right">{t.ledger.colAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 px-4 text-center text-stone-500 text-xs">
                  {t.ledger.noMatches}
                </td>
              </tr>
            ) : (
              sorted.map((member) => {
                const hidePii = member.isLiving && !currentUser.permissions.canViewLivingPII;
                const sens = SENSITIVITY_META[member.sensitivity];
                return (
                  <tr
                    key={member.id}
                    onClick={() => onSelectMember(member.id)}
                    className="hover:bg-[#FBF9F5] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono-tabular text-xs text-stone-600">
                      {t.common.genPrefix} {member.generation}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-serif-zh font-semibold text-stone-900 mr-2">
                        {member.chineseName}
                      </span>
                      <span className="text-xs text-stone-600">{member.romanizedName}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 font-serif-zh">
                      {member.courtesyName ? `字 ${member.courtesyName}` : '—'}
                      {member.artName ? ` · 號 ${member.artName}` : ''}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-700">
                      {getBranchLabel(member.branch, locale, branches)}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-stone-600">
                      {member.birthYear || '?'} –{' '}
                      {member.isLiving ? t.common.present : member.deathYear || '?'}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">
                      {hidePii ? (
                        <span className="text-stone-400 inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          {t.ledger.piiRedacted}
                        </span>
                      ) : (
                        member.currentResidence || member.birthplace || '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className={sens.toneClass}>
                        {getSensitivityLabel(member.sensitivity, locale)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMember(member.id);
                        }}
                        className="text-xs font-medium text-[#9E2A2B] hover:underline"
                      >
                        {t.ledger.inspect}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
