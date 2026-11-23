import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitMerge, Wrench, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { getBranchLabel } from '../lib/roles';
import type { BranchDefinition, DecryptedMember } from '../types/zupu';

interface DuplicatePair {
  a: DecryptedMember;
  b: DecryptedMember;
  reason: string;
}

interface LinkIssue {
  id: string;
  memberId: string;
  memberName: string;
  kind: 'dangling_parent' | 'dangling_spouse' | 'asymmetric_spouse';
  targetId: string;
  description: string;
}

interface LineageAuditModalProps {
  open: boolean;
  onClose: () => void;
  members: DecryptedMember[];
  branches: BranchDefinition[];
  onApplyMemberBatch: (nextMembers: DecryptedMember[], auditSummary: string) => Promise<void>;
}

function normalizeText(raw?: string): string {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, '');
}

export const LineageAuditModal: React.FC<LineageAuditModalProps> = ({
  open,
  onClose,
  members,
  branches,
  onApplyMemberBatch,
}) => {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { duplicates, linkIssues } = useMemo(() => {
    const dupPairs: DuplicatePair[] = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        const zhA = normalizeText(a.chineseName);
        const zhB = normalizeText(b.chineseName);
        const romA = normalizeText(a.romanizedName);
        const romB = normalizeText(b.romanizedName);

        if (zhA && zhA === zhB) {
          dupPairs.push({ a, b, reason: a.chineseName });
          continue;
        }
        if (
          romA &&
          romA === romB &&
          ((a.birthYear && b.birthYear && a.birthYear === b.birthYear) ||
            a.generation === b.generation)
        ) {
          dupPairs.push({
            a,
            b,
            reason: `${a.romanizedName} (${a.birthYear || `Gen ${a.generation}`})`,
          });
        }
      }
    }

    const byId = new Map(members.map((m) => [m.id, m]));
    const issues: LinkIssue[] = [];
    for (const m of members) {
      for (const pid of m.parentIds) {
        if (!byId.has(pid) || pid === m.id) {
          issues.push({
            id: `dp-${m.id}-${pid}`,
            memberId: m.id,
            memberName: `${m.chineseName} (${m.romanizedName})`,
            kind: 'dangling_parent',
            targetId: pid,
            description: t.audit.issueDanglingParent,
          });
        }
      }
      for (const sid of m.spouseIds) {
        const partner = byId.get(sid);
        if (!partner || sid === m.id) {
          issues.push({
            id: `ds-${m.id}-${sid}`,
            memberId: m.id,
            memberName: `${m.chineseName} (${m.romanizedName})`,
            kind: 'dangling_spouse',
            targetId: sid,
            description: t.audit.issueDanglingSpouse,
          });
        } else if (!partner.spouseIds.includes(m.id)) {
          issues.push({
            id: `as-${m.id}-${sid}`,
            memberId: m.id,
            memberName: `${m.chineseName} → ${partner.chineseName}`,
            kind: 'asymmetric_spouse',
            targetId: sid,
            description: t.audit.issueAsymmetricSpouse,
          });
        }
      }
    }

    return { duplicates: dupPairs, linkIssues: issues };
  }, [members, t.audit.issueAsymmetricSpouse, t.audit.issueDanglingParent, t.audit.issueDanglingSpouse]);

  if (!open) return null;

  const handleMergePair = async (keep: DecryptedMember, drop: DecryptedMember) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const mergedBio =
        drop.biography && drop.biography.trim() && drop.biography.trim() !== keep.biography.trim()
          ? [keep.biography.trim(), drop.biography.trim()].filter(Boolean).join('\n\n')
          : keep.biography;
      const mergedSealed =
        drop.sealedTestament &&
        drop.sealedTestament.trim() &&
        drop.sealedTestament.trim() !== (keep.sealedTestament || '').trim()
          ? [(keep.sealedTestament || '').trim(), drop.sealedTestament.trim()]
              .filter(Boolean)
              .join('\n\n')
          : keep.sealedTestament;

      const mergedParents = Array.from(
        new Set([...keep.parentIds, ...drop.parentIds].filter((id) => id !== keep.id && id !== drop.id))
      );
      const mergedSpouses = Array.from(
        new Set([...keep.spouseIds, ...drop.spouseIds].filter((id) => id !== keep.id && id !== drop.id))
      );

      const mergedRecord: DecryptedMember = {
        ...keep,
        courtesyName: keep.courtesyName || drop.courtesyName || '',
        artName: keep.artName || drop.artName || '',
        birthOrder: keep.birthOrder || drop.birthOrder || '',
        birthYear: keep.birthYear || drop.birthYear || '',
        birthLunar: keep.birthLunar || drop.birthLunar || '',
        deathYear: keep.deathYear || drop.deathYear || '',
        deathLunar: keep.deathLunar || drop.deathLunar || '',
        birthplace: keep.birthplace || drop.birthplace || '',
        currentResidence: keep.currentResidence || drop.currentResidence || '',
        occupationOrTitle: keep.occupationOrTitle || drop.occupationOrTitle || '',
        portraitDataUrl: keep.portraitDataUrl || drop.portraitDataUrl || '',
        biography: mergedBio,
        sealedTestament: mergedSealed,
        parentIds: mergedParents,
        spouseIds: mergedSpouses,
        updatedAt: nowIso,
      };

      const rawNext = members
        .filter((m) => m.id !== drop.id)
        .map((m) => {
          if (m.id === keep.id) return mergedRecord;
          const nextParents = Array.from(
            new Set(
              m.parentIds
                .map((pid) => (pid === drop.id ? keep.id : pid))
                .filter((pid) => pid !== m.id)
            )
          );
          const nextSpouses = Array.from(
            new Set(
              m.spouseIds
                .map((sid) => (sid === drop.id ? keep.id : sid))
                .filter((sid) => sid !== m.id)
            )
          );
          return {
            ...m,
            parentIds: nextParents,
            spouseIds: nextSpouses,
          };
        });

      // Ensure reciprocal spouse links for merged record
      const finalMembers = rawNext.map((m) => {
        if (m.id !== keep.id && mergedSpouses.includes(m.id) && !m.spouseIds.includes(keep.id)) {
          return { ...m, spouseIds: [...m.spouseIds, keep.id], updatedAt: nowIso };
        }
        return m;
      });

      await onApplyMemberBatch(
        finalMembers,
        `Merged duplicate lineage record (${drop.chineseName} -> ${keep.chineseName})`
      );
      setNotice(t.audit.mergeSuccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to merge duplicate records');
    } finally {
      setBusy(false);
    }
  };

  const handleRepairAllLinks = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const validIds = new Set(members.map((m) => m.id));
      const nowIso = new Date().toISOString();

      // First strip dangling and self-referential links
      const cleaned = members.map((m) => ({
        ...m,
        parentIds: Array.from(new Set(m.parentIds.filter((pid) => pid !== m.id && validIds.has(pid)))),
        spouseIds: Array.from(new Set(m.spouseIds.filter((sid) => sid !== m.id && validIds.has(sid)))),
      }));

      // Enforce reciprocal spouse symmetry
      const reciprocalMap = new Map<string, Set<string>>();
      for (const m of cleaned) {
        reciprocalMap.set(m.id, new Set(m.spouseIds));
      }
      for (const m of cleaned) {
        for (const sid of m.spouseIds) {
          reciprocalMap.get(sid)?.add(m.id);
        }
      }

      const repaired = cleaned.map((m) => {
        const nextSpouses = Array.from(reciprocalMap.get(m.id) ?? []);
        const changed =
          nextSpouses.length !== m.spouseIds.length ||
          nextSpouses.some((s, idx) => s !== m.spouseIds[idx]);
        return changed ? { ...m, spouseIds: nextSpouses, updatedAt: nowIso } : m;
      });

      await onApplyMemberBatch(repaired, `Repaired ${linkIssues.length} lineage link anomalies`);
      setNotice(t.audit.repairSuccess);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to repair lineage links');
    } finally {
      setBusy(false);
    }
  };

  const isAllClean = duplicates.length === 0 && linkIssues.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lineage-audit-title"
    >
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#FBF9F5] border border-stone-200 rounded-xl p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <p className="text-xs text-stone-500">{t.audit.modalKicker}</p>
            <h2
              id="lineage-audit-title"
              className="font-display text-2xl font-semibold text-stone-900 mt-0.5"
            >
              {t.audit.modalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.dismiss}
            className="p-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">{t.audit.modalDesc}</p>

        {error && (
          <div role="alert" className="px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900">
            {error}
          </div>
        )}
        {notice && (
          <div className="px-4 py-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs text-emerald-900">
            {notice}
          </div>
        )}

        {isAllClean ? (
          <div className="p-6 rounded-xl border border-emerald-200 bg-white flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-stone-900">{t.audit.allCleanTitle}</p>
              <p className="text-xs text-stone-600 mt-1">{t.audit.allCleanDesc}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Possible Duplicate Pairs */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5 text-[#9E2A2B]" />
                {t.audit.duplicatesHeading} ({duplicates.length})
              </h3>
              {duplicates.length === 0 ? (
                <p className="text-xs text-stone-500 bg-white border border-stone-200 rounded-lg p-4">
                  {t.audit.noDuplicates}
                </p>
              ) : (
                <div className="space-y-3">
                  {duplicates.map(({ a, b, reason }) => (
                    <div
                      key={`${a.id}-${b.id}`}
                      className="p-4 rounded-xl bg-white border border-stone-200 space-y-3"
                    >
                      <p className="text-[11px] font-mono-tabular text-[#9E2A2B] font-medium">
                        {reason}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-[#FBF9F5] border border-stone-200 space-y-1">
                          <p className="font-semibold text-stone-900">
                            <span className="font-serif-zh mr-1.5">{a.chineseName}</span>
                            {a.romanizedName}
                          </p>
                          <p className="text-stone-500">
                            {t.common.genPrefix} {a.generation} · {getBranchLabel(a.branch, locale, branches)}
                          </p>
                          <p className="font-mono-tabular text-stone-500">
                            {a.birthYear || '?'} – {a.isLiving ? t.common.present : a.deathYear || '?'}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-[#FBF9F5] border border-stone-200 space-y-1">
                          <p className="font-semibold text-stone-900">
                            <span className="font-serif-zh mr-1.5">{b.chineseName}</span>
                            {b.romanizedName}
                          </p>
                          <p className="text-stone-500">
                            {t.common.genPrefix} {b.generation} · {getBranchLabel(b.branch, locale, branches)}
                          </p>
                          <p className="font-mono-tabular text-stone-500">
                            {b.birthYear || '?'} – {b.isLiving ? t.common.present : b.deathYear || '?'}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleMergePair(a, b)}
                          className="px-3 py-1.5 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg"
                        >
                          {busy ? t.audit.busyLabel : t.audit.keepLeftBtn}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleMergePair(b, a)}
                          className="px-3 py-1.5 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-800 rounded-lg"
                        >
                          {busy ? t.audit.busyLabel : t.audit.keepRightBtn}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Relationship Link Anomalies */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  {t.audit.linkIssuesHeading} ({linkIssues.length})
                </h3>
                {linkIssues.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRepairAllLinks}
                    className="px-3.5 py-1.5 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    {busy ? t.audit.busyLabel : t.audit.repairAllBtn}
                  </button>
                )}
              </div>
              {linkIssues.length === 0 ? (
                <p className="text-xs text-stone-500 bg-white border border-stone-200 rounded-lg p-4">
                  {t.audit.noLinkIssues}
                </p>
              ) : (
                <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
                  {linkIssues.map((issue) => (
                    <div key={issue.id} className="px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="font-medium text-stone-900">{issue.memberName}</span>
                      <span className="text-stone-600">{issue.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
