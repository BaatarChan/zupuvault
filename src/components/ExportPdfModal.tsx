import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Lock, X } from 'lucide-react';
import { exportZupuPdf, filterMembersForPdf } from '../lib/exportPdf';
import { useI18n } from '../lib/i18n';
import { getBranchesFromMetadata, getBranchLabel } from '../lib/roles';
import type {
  BranchScope,
  ClanMetadata,
  DecryptedMember,
  UserProfile,
} from '../types/zupu';

interface ExportPdfModalProps {
  open: boolean;
  onClose: () => void;
  metadata: ClanMetadata;
  members: DecryptedMember[];
  currentUser: UserProfile;
  initialBranch?: BranchScope;
  onExported?: () => void;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  open,
  onClose,
  metadata,
  members,
  currentUser,
  initialBranch = 'all',
  onExported,
}) => {
  const { locale, t } = useI18n();
  const branches = useMemo(() => getBranchesFromMetadata(metadata), [metadata]);
  const lockedBranch = currentUser.permissions.branchScope !== 'all';
  const [branchScope, setBranchScope] = useState<BranchScope>(
    lockedBranch ? currentUser.permissions.branchScope : initialBranch
  );
  const [includeTreeOverview, setIncludeTreeOverview] = useState(true);
  const [includeLivingPII, setIncludeLivingPII] = useState(
    currentUser.permissions.canViewLivingPII
  );
  const [includeSealedTestaments, setIncludeSealedTestaments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBranchScope(lockedBranch ? currentUser.permissions.branchScope : initialBranch);
      setIncludeLivingPII(currentUser.permissions.canViewLivingPII);
      setIncludeSealedTestaments(false);
      setError(null);
    }
  }, [open, lockedBranch, currentUser.permissions.branchScope, currentUser.permissions.canViewLivingPII, initialBranch]);

  const previewCount = useMemo(
    () => filterMembersForPdf(members, currentUser, branchScope, branches).length,
    [members, currentUser, branchScope, branches]
  );

  if (!open) return null;

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await exportZupuPdf({
        metadata,
        members,
        currentUser,
        locale,
        t,
        branchScope,
        includeTreeOverview,
        includeLivingPII,
        includeSealedTestaments,
      });
      onExported?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-pdf-title"
    >
      <div className="w-full max-w-lg bg-[#FBF9F5] border border-stone-200 rounded-xl p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <p className="text-xs text-stone-500">{t.pdf.modalKicker}</p>
            <h2 id="export-pdf-title" className="font-display text-2xl font-semibold text-stone-900 mt-0.5">
              {t.pdf.modalTitle}
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

        <p className="text-xs text-stone-600 leading-relaxed">{t.pdf.modalDesc}</p>

        {error && (
          <div role="alert" className="px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleDownload} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              {t.pdf.branchLabel}
            </label>
            <select
              value={lockedBranch ? currentUser.permissions.branchScope : branchScope}
              disabled={lockedBranch}
              onChange={(e) => setBranchScope(e.target.value as BranchScope)}
              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg disabled:bg-stone-100"
            >
              {(['all', ...branches.map((b) => b.id)] as BranchScope[]).map(
                (scope) => (
                  <option key={scope} value={scope}>
                    {getBranchLabel(scope, locale, branches)}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="space-y-2.5 p-4 rounded-lg bg-white border border-stone-200">
            <label className="flex items-start gap-2.5 text-xs text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTreeOverview}
                onChange={(e) => setIncludeTreeOverview(e.target.checked)}
                className="mt-0.5 accent-[#9E2A2B]"
              />
              <span>{t.pdf.includeTree}</span>
            </label>

            {currentUser.permissions.canViewLivingPII ? (
              <label className="flex items-start gap-2.5 text-xs text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLivingPII}
                  onChange={(e) => setIncludeLivingPII(e.target.checked)}
                  className="mt-0.5 accent-[#9E2A2B]"
                />
                <span>{t.pdf.includeLivingPii}</span>
              </label>
            ) : (
              <p className="flex items-center gap-2 text-xs text-stone-400">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>{t.pdf.livingPiiRestricted}</span>
              </p>
            )}

            {currentUser.permissions.canViewElderSealed ? (
              <label className="flex items-start gap-2.5 text-xs text-[#9E2A2B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSealedTestaments}
                  onChange={(e) => setIncludeSealedTestaments(e.target.checked)}
                  className="mt-0.5 accent-[#9E2A2B]"
                />
                <span>{t.pdf.includeSealed}</span>
              </label>
            ) : (
              <p className="flex items-center gap-2 text-xs text-stone-400">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>{t.pdf.sealedRestricted}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-stone-600 pt-1">
            <span>
              {t.pdf.recordsPreview}{' '}
              <strong className="font-mono-tabular text-stone-900">{previewCount}</strong>
            </span>
            <span className="font-mono-tabular text-stone-500">
              {metadata.clanChineseName} · {metadata.keyFingerprint}
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap shrink-0"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              {busy ? t.pdf.generatingBtn : t.pdf.downloadBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
