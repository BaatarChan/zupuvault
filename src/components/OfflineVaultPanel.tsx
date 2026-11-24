import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileDown,
  FileSpreadsheet,
  HardDrive,
  History,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  WifiOff,
  Server,
} from 'lucide-react';
import { api } from '../lib/api';
import { computeBundleChecksum, createPortableArchive } from '../lib/crypto';
import { CustodySheetPdfModal } from './CustodySheetPdfModal';
import {
  exportMembersToCsv,
  exportMembersToGedcom,
  parseCsvToMembers,
  parseGedcomToMembers,
} from '../lib/gedcomCsv';
import { useI18n } from '../lib/i18n';
import {
  createOfflineSnapshot,
  deleteOfflineSnapshot,
  listOfflineSnapshots,
} from '../lib/offlineVault';
import { getBranchesFromMetadata } from '../lib/roles';
import { defaultRomanizationScheme } from '../lib/romanizeName';
import type {
  DecryptedMember,
  EncryptedVaultBundle,
  OfflineSnapshot,
  PortableZupuArchive,
  StorageMode,
  UserProfile,
  VaultRevisionSummary,
} from '../types/zupu';

interface OfflineVaultPanelProps {
  currentUser: UserProfile;
  storageMode: StorageMode;
  pendingSync: boolean;
  bundle: EncryptedVaultBundle;
  members: DecryptedMember[];
  onChangeStorageMode: (mode: StorageMode) => Promise<void>;
  onSyncNow: () => Promise<void>;
  onRestoreBundle: (bundle: EncryptedVaultBundle) => Promise<void>;
  onHistoryRolledBack?: (bundle: EncryptedVaultBundle, serverRevision: number) => Promise<void>;
  onImportMembers: (
    imported: DecryptedMember[],
    mode: 'merge' | 'replace',
    sourceLabel: string
  ) => Promise<void>;
  onRequestExportPdf?: () => void;
}

export const OfflineVaultPanel: React.FC<OfflineVaultPanelProps> = ({
  currentUser,
  storageMode,
  pendingSync,
  bundle,
  members,
  onChangeStorageMode,
  onSyncNow,
  onRestoreBundle,
  onHistoryRolledBack,
  onImportMembers,
  onRequestExportPdf,
}) => {
  const { locale, t } = useI18n();
  const [snapshots, setSnapshots] = useState<OfflineSnapshot[]>([]);
  const [serverHistory, setServerHistory] = useState<VaultRevisionSummary[]>([]);
  const [confirmRollbackRev, setConfirmRollbackRev] = useState<number | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [bundleChecksum, setBundleChecksum] = useState<string>('...');
  const [custodyModalOpen, setCustodyModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingInterchange, setPendingInterchange] = useState<{
    fileName: string;
    formatLabel: 'CSV' | 'GEDCOM';
    parsed: DecryptedMember[];
  } | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const interchangeImportRef = useRef<HTMLInputElement>(null);

  const canManageServerHistory =
    storageMode === 'hybrid_sync' &&
    (currentUser.role === 'patriarch' || currentUser.permissions.canManageRoles);

  useEffect(() => {
    listOfflineSnapshots()
      .then(setSnapshots)
      .catch(() => setSnapshots([]));
    computeBundleChecksum(bundle)
      .then((sum) => setBundleChecksum(sum.slice(0, 24).toUpperCase()))
      .catch(() => setBundleChecksum('UNAVAILABLE'));
    if (canManageServerHistory) {
      api
        .getVaultHistory()
        .then((res) => setServerHistory(res.history))
        .catch(() => setServerHistory([]));
    } else {
      setServerHistory([]);
    }
  }, [bundle, canManageServerHistory]);

  const handleRollbackServerRevision = async (revision: number) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.restoreVaultRevision(revision);
      setConfirmRollbackRev(null);
      if (onHistoryRolledBack) {
        await onHistoryRolledBack(res.bundle, res.serverRevision);
      } else {
        await onRestoreBundle(res.bundle);
      }
      const refreshed = await api.getVaultHistory().catch(() => ({ history: [] }));
      setServerHistory(refreshed.history);
      setNotice(`${t.offline.rollbackSuccess} (#${revision} → rev ${res.serverRevision})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to roll back server revision');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const label = snapshotLabel.trim() || `Seal · ${new Date().toLocaleDateString()}`;
      const snap = await createOfflineSnapshot(bundle, label);
      setSnapshots((prev) => [snap, ...prev]);
      setSnapshotLabel('');
      setNotice(`Saved snapshot "${snap.label}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save local snapshot');
    } finally {
      setBusy(false);
    }
  };

  const handleExportZupu = async () => {
    setError(null);
    setNotice(null);
    try {
      const archive = await createPortableArchive(bundle, currentUser.displayName);
      const blob = new Blob([JSON.stringify(archive, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = bundle.metadata.clanName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      a.href = url;
      a.download = `${slug}_${new Date().toISOString().slice(0, 10)}.zupu.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Downloaded .zupu.json archive.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const handleImportArchive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PortableZupuArchive | EncryptedVaultBundle;
      let nextBundle: EncryptedVaultBundle;
      if ('format' in parsed && parsed.format === 'ZUPU_VAULT_ARCHIVE_V1') {
        const computed = await computeBundleChecksum(parsed.bundle);
        if (computed !== parsed.sha256Checksum) {
          throw new Error('Archive SHA-256 integrity checksum mismatch.');
        }
        nextBundle = parsed.bundle;
      } else {
        nextBundle = parsed as EncryptedVaultBundle;
      }
      await onRestoreBundle(nextBundle);
      setNotice(`Verified & restored archive from ${file.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import .zupu archive');
    } finally {
      setBusy(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const triggerTextDownload = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    setError(null);
    setNotice(null);
    try {
      const { csv, count } = exportMembersToCsv(
        members,
        currentUser,
        currentUser.permissions.branchScope
      );
      const slug = bundle.metadata.clanName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'zupu';
      triggerTextDownload(
        csv,
        `${slug}_${new Date().toISOString().slice(0, 10)}.csv`,
        'text/csv;charset=utf-8'
      );
      setNotice(`${t.offline.csvExportedNotice} (${count})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed');
    }
  };

  const handleExportGedcom = () => {
    setError(null);
    setNotice(null);
    try {
      const { gedcom, count } = exportMembersToGedcom(
        bundle.metadata,
        members,
        currentUser,
        currentUser.permissions.branchScope
      );
      const slug = bundle.metadata.clanName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'zupu';
      triggerTextDownload(
        gedcom,
        `${slug}_${new Date().toISOString().slice(0, 10)}.ged`,
        'text/plain;charset=utf-8'
      );
      setNotice(`${t.offline.gedExportedNotice} (${count})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GEDCOM export failed');
    }
  };

  const handleSelectInterchangeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const branches = getBranchesFromMetadata(bundle.metadata);
      const defaultBranch =
        currentUser.permissions.branchScope === 'all'
          ? branches[0]?.id || 'elder_branch'
          : currentUser.permissions.branchScope;
      const romanizeScheme = defaultRomanizationScheme(locale);
      const isGedcom =
        file.name.toLowerCase().endsWith('.ged') ||
        /^\s*0\s+HEAD/m.test(text);

      const parsed = isGedcom
        ? parseGedcomToMembers(text, { defaultBranch, romanizeScheme })
        : parseCsvToMembers(text, { defaultBranch, romanizeScheme, branches });

      setPendingInterchange({
        fileName: file.name,
        formatLabel: isGedcom ? 'GEDCOM' : 'CSV',
        parsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse CSV / GEDCOM file');
    } finally {
      if (interchangeImportRef.current) interchangeImportRef.current.value = '';
    }
  };

  const handleCommitInterchange = async (mode: 'merge' | 'replace') => {
    if (!pendingInterchange) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await onImportMembers(
        pendingInterchange.parsed,
        mode,
        `${pendingInterchange.formatLabel} (${pendingInterchange.fileName})`
      );
      setNotice(
        `${t.offline.importCommittedNotice} (${pendingInterchange.parsed.length} ${pendingInterchange.formatLabel})`
      );
      setPendingInterchange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to encrypt imported records');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500">{t.offline.kicker}</p>
          <h2 className="font-display text-3xl font-semibold text-stone-900 mt-0.5">
            {t.offline.title}
          </h2>
        </div>
        <p className="text-xs font-mono-tabular text-stone-500">
          SHA-256: {bundleChecksum}…
        </p>
      </div>

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

      {/* Storage Sovereignty Mode Selector */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          type="button"
          onClick={() => onChangeStorageMode('hybrid_sync')}
          className={`text-left p-6 rounded-xl border transition-colors ${
            storageMode === 'hybrid_sync'
              ? 'bg-white border-[#9E2A2B] ring-1 ring-[#9E2A2B]/25'
              : 'bg-white border-stone-200 hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-stone-900">
              <Server className="w-4 h-4 text-[#9E2A2B]" />
              {t.offline.hybridTitle}
            </span>
            <span className="text-xs text-stone-500">
              {storageMode === 'hybrid_sync' ? t.offline.selected : t.offline.switchLabel}
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-2 leading-relaxed">{t.offline.hybridDesc}</p>
        </button>

        <button
          type="button"
          onClick={() => onChangeStorageMode('offline_only')}
          className={`text-left p-6 rounded-xl border transition-colors ${
            storageMode === 'offline_only'
              ? 'bg-white border-[#9E2A2B] ring-1 ring-[#9E2A2B]/25'
              : 'bg-white border-stone-200 hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-stone-900">
              <WifiOff className="w-4 h-4 text-[#9E2A2B]" />
              {t.offline.airgapTitle}
            </span>
            <span className="text-xs text-stone-500">
              {storageMode === 'offline_only' ? t.offline.selected : t.offline.switchLabel}
            </span>
          </div>
          <p className="text-xs text-stone-600 mt-2 leading-relaxed">{t.offline.airgapDesc}</p>
        </button>
      </section>

      {/* Sync & Portable .zupu Archive Actions */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#9E2A2B]" />
            {t.offline.archiveTitle}
          </h3>
          <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
            {t.offline.archiveDesc}
          </p>
          {pendingSync && (
            <p className="text-xs text-amber-800 font-medium mt-2">{t.offline.pendingWarning}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {storageMode === 'hybrid_sync' && currentUser.permissions.canEditLineage && (
            <button
              type="button"
              disabled={busy}
              onClick={onSyncNow}
              className="px-4 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t.offline.pushSyncBtn}
            </button>
          )}

          {currentUser.permissions.canExportVault && (
            <>
              <button
                type="button"
                onClick={handleExportZupu}
                className="px-4 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                {t.offline.exportBtn}
              </button>
              {onRequestExportPdf && (
                <button
                  type="button"
                  onClick={onRequestExportPdf}
                  className="px-4 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileDown className="w-3.5 h-3.5 text-[#9E2A2B]" />
                  {t.pdf.exportBtn}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setCustodyModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileDown className="w-3.5 h-3.5 text-[#9E2A2B]" />
                {t.mfa.custodySheetBtn}
              </button>
            </>
          )}

          {currentUser.permissions.canEditLineage && (
            <button
              type="button"
              disabled={busy}
              onClick={() => importRef.current?.click()}
              className="px-4 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {t.offline.restoreFileBtn}
            </button>
          )}
          <input
            ref={importRef}
            type="file"
            accept=".json,.zupu,.zupu.json"
            onChange={handleImportArchive}
            className="hidden"
          />
        </div>
      </section>

      {/* Batch CSV & GEDCOM Interchange Section */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#9E2A2B]" />
              {t.offline.interchangeTitle}
            </h3>
            <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
              {t.offline.interchangeDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {currentUser.permissions.canExportVault && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#9E2A2B]" />
                  {t.offline.exportCsvBtn}
                </button>
                <button
                  type="button"
                  onClick={handleExportGedcom}
                  className="px-3.5 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#9E2A2B]" />
                  {t.offline.exportGedcomBtn}
                </button>
              </>
            )}

            {currentUser.permissions.canEditLineage && (
              <button
                type="button"
                disabled={busy}
                onClick={() => interchangeImportRef.current?.click()}
                className="px-3.5 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                {t.offline.importInterchangeBtn}
              </button>
            )}
            <input
              ref={interchangeImportRef}
              type="file"
              accept=".csv,.ged,.gedcom,text/csv"
              onChange={handleSelectInterchangeFile}
              className="hidden"
            />
          </div>
        </div>

        {pendingInterchange && (
          <div className="p-4 rounded-lg border border-stone-300 bg-[#FBF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-stone-900">
                {pendingInterchange.formatLabel} · {pendingInterchange.fileName}
              </p>
              <p className="text-xs text-stone-600">
                {t.offline.importPreviewPrefix} <strong>{pendingInterchange.parsed.length}</strong>{' '}
                {t.offline.importPreviewSuffix}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleCommitInterchange('merge')}
                className="px-3.5 py-1.5 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] text-white rounded-lg whitespace-nowrap"
              >
                {t.offline.mergeImportBtn}
              </button>
              {currentUser.permissions.branchScope === 'all' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleCommitInterchange('replace')}
                  className="px-3.5 py-1.5 text-xs font-medium border border-red-300 text-red-800 hover:bg-red-50 rounded-lg whitespace-nowrap"
                >
                  {t.offline.replaceImportBtn}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setPendingInterchange(null)}
                className="px-3 py-1.5 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Local IndexedDB Encrypted Snapshots */}
      <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[#9E2A2B]" />
              {t.offline.snapshotsTitle} ({snapshots.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">{t.offline.snapshotsDesc}</p>
            <p className="text-[11px] text-stone-400 mt-1">{t.offline.autoSnapshotHint}</p>
          </div>

          <form onSubmit={handleCreateSnapshot} className="flex items-center gap-2">
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder={t.offline.snapshotPlaceholder}
              className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg w-56"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-3.5 py-2 text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-lg whitespace-nowrap"
            >
              {t.offline.saveSnapshotBtn}
            </button>
          </form>
        </div>

        {snapshots.length === 0 ? (
          <p className="text-xs text-stone-500 py-4">{t.offline.noSnapshots}</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">{snap.label}</p>
                  <p className="text-xs text-stone-500 font-mono-tabular mt-0.5">
                    {snap.createdAt.replace('T', ' ').slice(0, 19)} · {snap.recordCount} · SHA-256{' '}
                    {snap.sha256Checksum.slice(0, 12).toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentUser.permissions.canEditLineage && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRestoreBundle(snap.bundle)}
                      className="px-3 py-1.5 text-xs font-medium border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-800"
                    >
                      {t.offline.restoreBtn}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteOfflineSnapshot(snap.id);
                      setSnapshots((prev) => prev.filter((s) => s.id !== snap.id));
                    }}
                    aria-label="Delete snapshot"
                    className="p-2 text-stone-400 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Server Encrypted Revision History & Rollback */}
      {canManageServerHistory && (
        <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-stone-200 pb-4">
            <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#9E2A2B]" />
              {t.offline.serverHistoryTitle}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">{t.offline.serverHistoryDesc}</p>
          </div>

          {serverHistory.length === 0 ? (
            <p className="text-xs text-stone-500 py-2">{t.offline.serverHistoryEmpty}</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {serverHistory.map((item) => {
                const isConfirming = confirmRollbackRev === item.revision;
                return (
                  <div
                    key={`${item.revision}-${item.savedAt}`}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900">
                        <span className="font-mono-tabular text-[#9E2A2B] mr-1.5">
                          rev #{item.revision}
                        </span>
                        {item.summary}
                      </p>
                      <p className="text-xs text-stone-500 font-mono-tabular mt-0.5">
                        {item.savedAt.replace('T', ' ').slice(0, 19)} · {item.savedByName} ·{' '}
                        {item.recordCount} · {item.keyFingerprint}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isConfirming ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRollbackServerRevision(item.revision)}
                            className="px-3 py-1.5 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] text-white rounded-lg whitespace-nowrap"
                          >
                            {t.offline.confirmRollbackBtn}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmRollbackRev(null)}
                            className="px-2.5 py-1.5 text-xs text-stone-600 hover:text-stone-900"
                          >
                            {t.common.cancel}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmRollbackRev(item.revision)}
                          className="px-3 py-1.5 text-xs font-medium border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-800 whitespace-nowrap"
                        >
                          {t.offline.rollbackBtn}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      <CustodySheetPdfModal
        open={custodyModalOpen}
        metadata={bundle.metadata}
        currentUser={currentUser}
        onClose={() => setCustodyModalOpen(false)}
        onExported={() => setNotice(t.mfa.custodySheetSuccess)}
      />
    </div>
  );
};
