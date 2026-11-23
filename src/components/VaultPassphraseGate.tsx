import React, { useRef, useState } from 'react';
import { KeyRound, LockOpen, Upload, Shield, FileKey2 } from 'lucide-react';
import {
  createEncryptedVaultBundle,
  unlockEncryptedVaultBundle,
} from '../lib/crypto';
import { useI18n } from '../lib/i18n';
import { SAMPLE_CLAN_HEADER, SAMPLE_CLAN_MEMBERS } from '../lib/sampleClan';
import type {
  DecryptedMember,
  EncryptedVaultBundle,
  PortableZupuArchive,
  StorageMode,
  UserProfile,
} from '../types/zupu';
import { LanguageSwitcher } from './LanguageSwitcher';

interface VaultPassphraseGateProps {
  user: UserProfile;
  storageMode: StorageMode;
  existingBundle: EncryptedVaultBundle | null;
  onUnlocked: (
    bundle: EncryptedVaultBundle,
    key: CryptoKey,
    members: DecryptedMember[],
    isNewlyCreated: boolean
  ) => void;
  onSignOut: () => void;
}

export const VaultPassphraseGate: React.FC<VaultPassphraseGateProps> = ({
  user,
  storageMode,
  existingBundle,
  onUnlocked,
  onSignOut,
}) => {
  const { t } = useI18n();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');

  const [clanName, setClanName] = useState(SAMPLE_CLAN_HEADER.clanName);
  const [clanChineseName, setClanChineseName] = useState(SAMPLE_CLAN_HEADER.clanChineseName);
  const [hallName, setHallName] = useState(SAMPLE_CLAN_HEADER.hallName);
  const [ancestralOrigin, setAncestralOrigin] = useState(SAMPLE_CLAN_HEADER.ancestralOrigin);
  const [poemInput, setPoemInput] = useState(SAMPLE_CLAN_HEADER.generationPoem.join(' '));
  const [seedSample, setSeedSample] = useState(true);

  const [importedBundle, setImportedBundle] = useState<EncryptedVaultBundle | null>(null);
  const [importedLabel, setImportedLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBundle = importedBundle ?? existingBundle;

  const handleUnlockExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBundle) return;
    setError(null);
    setBusy(true);
    try {
      const { key, members } = await unlockEncryptedVaultBundle(passphrase, activeBundle);
      onUnlocked(activeBundle, key, members, Boolean(importedBundle));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to decrypt lineage vault');
    } finally {
      setBusy(false);
    }
  };

  const handleInitializeNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passphrase.length < 8) {
      setError('Family Encryption Passphrase must be at least 8 characters.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Encryption passphrases do not match.');
      return;
    }

    setBusy(true);
    try {
      const poemChars = poemInput
        .replace(/[\s,，·]+/g, '')
        .split('')
        .filter(Boolean);
      const members = seedSample ? SAMPLE_CLAN_MEMBERS : [];
      const { bundle, key } = await createEncryptedVaultBundle(
        passphrase,
        {
          clanName: clanName.trim() || 'Family Lineage Archive',
          clanChineseName: clanChineseName.trim() || '宗族譜牒',
          hallName: hallName.trim() || '堂號未設',
          ancestralOrigin: ancestralOrigin.trim() || 'Ancestral Origin',
          generationPoem: poemChars.length > 0 ? poemChars : ['德', '星', '啟', '瑞'],
        },
        members
      );
      onUnlocked(bundle, key, members, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize encrypted vault');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PortableZupuArchive | EncryptedVaultBundle;
      const bundle =
        'format' in parsed && parsed.format === 'ZUPU_VAULT_ARCHIVE_V1'
          ? parsed.bundle
          : (parsed as EncryptedVaultBundle);

      if (!bundle?.metadata?.verifierBlob || !Array.isArray(bundle?.records)) {
        throw new Error('Selected file is not a valid ZupuVault encrypted archive.');
      }
      setImportedBundle(bundle);
      setImportedLabel(`${file.name} · ${bundle.records.length} ${t.gate.encryptedRecords}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid archive file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex flex-col">
      <header className="border-b border-stone-200 px-6 py-4 flex items-center justify-between gap-8 bg-white/80">
        <span className="font-display text-2xl font-semibold text-stone-900 whitespace-nowrap shrink-0">
          {t.common.brand}
        </span>
        <span className="text-xs text-stone-500 hidden md:inline">
          {t.gate.signedInAs} {user.displayName} ({user.chineseName}) ·{' '}
          {storageMode === 'offline_only' ? t.ribbon.offlineOnly : t.ribbon.hybridSync}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          className="px-4 py-2 text-xs font-medium border border-stone-300 rounded-lg hover:bg-stone-50 text-stone-700 whitespace-nowrap shrink-0"
        >
          {t.common.signOut}
        </button>
      </header>

      <div className="px-6 py-2 border-b border-stone-200/70 bg-[#F5F1E8] flex justify-end">
        <LanguageSwitcher />
      </div>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white border border-stone-200 rounded-xl p-8">
          <div className="flex items-start justify-between gap-4 pb-6 border-b border-stone-200">
            <div>
              <p className="text-xs text-stone-500 mb-1">{t.gate.kicker}</p>
              <h1 className="font-display text-3xl font-semibold text-stone-900">
                {activeBundle ? t.gate.titleUnlock : t.gate.titleInit}
              </h1>
            </div>
            <div className="w-11 h-11 rounded-lg bg-[#9E2A2B]/10 text-[#9E2A2B] flex items-center justify-center shrink-0">
              {activeBundle ? <KeyRound className="w-5 h-5" /> : <FileKey2 className="w-5 h-5" />}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900"
            >
              {error}
            </div>
          )}

          {activeBundle ? (
            <form onSubmit={handleUnlockExisting} className="mt-6 space-y-5">
              <div className="p-4 rounded-lg bg-[#FBF9F5] border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>{importedLabel ? t.gate.importedArchive : t.gate.storedEnvelope}</span>
                  <span className="font-mono-tabular">
                    {t.gate.fingerprint} {activeBundle.metadata.keyFingerprint}
                  </span>
                </div>
                <p className="font-display text-xl font-semibold text-stone-900">
                  {activeBundle.metadata.clanChineseName} · {activeBundle.metadata.clanName}
                </p>
                <p className="text-xs text-stone-600">
                  {activeBundle.metadata.hallName} · {activeBundle.records.length} {t.gate.encryptedRecords}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t.gate.passphraseLabel}
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder={t.gate.passphrasePlaceholder}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
                <p className="text-xs text-stone-500 mt-1.5">
                  {t.gate.kdfNote} ({activeBundle.metadata.kdfIterations.toLocaleString()}).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <LockOpen className="w-4 h-4" />
                  {busy ? t.gate.unlockingBtn : t.gate.unlockBtn}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-4 border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" />
                  {t.gate.importBtn}
                </button>
                {importedBundle && (
                  <button
                    type="button"
                    onClick={() => {
                      setImportedBundle(null);
                      setImportedLabel(null);
                    }}
                    className="text-xs text-stone-500 hover:text-stone-800 underline"
                  >
                    {t.gate.revertBtn}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleInitializeNew} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.gate.clanNameEng}
                  </label>
                  <input
                    type="text"
                    required
                    value={clanName}
                    onChange={(e) => setClanName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.gate.clanTitleZh}
                  </label>
                  <input
                    type="text"
                    required
                    value={clanChineseName}
                    onChange={(e) => setClanChineseName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-serif-zh bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.gate.hallName}
                  </label>
                  <input
                    type="text"
                    required
                    value={hallName}
                    onChange={(e) => setHallName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.gate.ancestralOrigin}
                  </label>
                  <input
                    type="text"
                    required
                    value={ancestralOrigin}
                    onChange={(e) => setAncestralOrigin(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t.gate.generationPoem}
                </label>
                <input
                  type="text"
                  required
                  value={poemInput}
                  onChange={(e) => setPoemInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-serif-zh tracking-widest bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.gate.encPassphrase}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.gate.confirmPassphrase}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#FBF9F5] border border-stone-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedSample}
                  onChange={(e) => setSeedSample(e.target.checked)}
                  className="mt-0.5 accent-[#9E2A2B]"
                />
                <span className="text-xs text-stone-700 leading-relaxed">
                  <strong>{t.gate.seedSampleTitle}</strong> — {t.gate.seedSampleDesc}
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Shield className="w-4 h-4" />
                  {busy ? t.gate.creatingBtn : t.gate.createBtn}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-4 border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" />
                  {t.gate.importBtn}
                </button>
              </div>
            </form>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.zupu,.zupu.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </main>
    </div>
  );
};
