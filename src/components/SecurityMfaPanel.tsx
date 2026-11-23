import React, { useState } from 'react';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  FileDown,
  Fingerprint,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { api, setInMemoryAuthToken } from '../lib/api';
import { createEncryptedVaultBundle } from '../lib/crypto';
import { downloadHeirCustodySheetPdf } from '../lib/custodySheetPdf';
import { useI18n } from '../lib/i18n';
import type {
  ClanMetadata,
  DecryptedMember,
  EncryptedVaultBundle,
  StorageMode,
  UserProfile,
} from '../types/zupu';

interface SecurityMfaPanelProps {
  currentUser: UserProfile;
  storageMode: StorageMode;
  metadata: ClanMetadata;
  members: DecryptedMember[];
  onUserUpdated: (user: UserProfile) => void;
  onVaultKeyRotated: (bundle: EncryptedVaultBundle, key: CryptoKey) => Promise<void>;
}

export const SecurityMfaPanel: React.FC<SecurityMfaPanelProps> = ({
  currentUser,
  storageMode,
  metadata,
  members,
  onUserUpdated,
  onVaultKeyRotated,
}) => {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [newVaultPassphrase, setNewVaultPassphrase] = useState('');
  const [confirmVaultPassphrase, setConfirmVaultPassphrase] = useState('');

  const [busy, setBusy] = useState(false);
  const [custodyBusy, setCustodyBusy] = useState(false);
  const [passkeyLabel, setPasskeyLabel] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [editingPasskeyLabel, setEditingPasskeyLabel] = useState('');
  const [confirmRemovePasskeyId, setConfirmRemovePasskeyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const userPasskeys = currentUser.passkeys ?? [];

  const handleAddPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!browserSupportsWebAuthn()) {
      setError(t.mfa.passkeyUnsupported);
      return;
    }
    setPasskeyBusy(true);
    try {
      const trimmedLabel = passkeyLabel.trim() || undefined;
      const { options } = await api.getPasskeyRegisterOptions(trimmedLabel);
      const regResponse = await startRegistration({ optionsJSON: options });
      const res = await api.verifyPasskeyRegister(regResponse, trimmedLabel);
      onUserUpdated(res.user);
      setPasskeyLabel('');
      setNotice(`${t.mfa.passkeyAddedNotice} ${res.passkey.label}`);
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setError(t.auth.passkeyCancelled);
      } else {
        setError(err instanceof Error ? err.message : 'Unable to register Passkey');
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleSavePasskeyName = async (passkeyId: string) => {
    setError(null);
    setNotice(null);
    const trimmed = editingPasskeyLabel.trim();
    if (!trimmed) return;
    setPasskeyBusy(true);
    try {
      const res = await api.renamePasskey(passkeyId, trimmed);
      onUserUpdated(res.user);
      setEditingPasskeyId(null);
      setEditingPasskeyLabel('');
      setNotice(t.mfa.passkeyRenamedNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rename Passkey');
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleDeletePasskey = async (passkeyId: string) => {
    setError(null);
    setNotice(null);
    setPasskeyBusy(true);
    try {
      const res = await api.deletePasskey(passkeyId);
      onUserUpdated(res.user);
      setConfirmRemovePasskeyId(null);
      setNotice(t.mfa.passkeyRemovedNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove Passkey');
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleStartMfaEnroll = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.initMfaEnrollment();
      const dataUrl = await QRCode.toDataURL(res.otpauthUri, {
        width: 220,
        margin: 1,
        color: { dark: '#1C1917', light: '#FFFFFF' },
      });
      setSecretBase32(res.secretBase32);
      setQrDataUrl(dataUrl);
      setRecoveryCodes(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start MFA enrollment');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmMfaEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.confirmMfaEnrollment(totpCode);
      if (res.token) {
        setInMemoryAuthToken(res.token);
      }
      onUserUpdated(res.user);
      setRecoveryCodes(res.recoveryCodes);
      setQrDataUrl(null);
      setSecretBase32(null);
      setTotpCode('');
      setNotice('TOTP Multi-Factor Authentication is now active on your account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid authenticator code');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.disableMfa({ currentPassword: disablePassword, code: disableCode });
      onUserUpdated(res.user);
      setDisablePassword('');
      setDisableCode('');
      setNotice('TOTP Multi-Factor Authentication has been disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable MFA');
    } finally {
      setBusy(false);
    }
  };

  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.rotatePassword({ currentPassword, newPassword });
      if (res.token) {
        setInMemoryAuthToken(res.token);
      }
      if (res.user) {
        onUserUpdated(res.user);
      }
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Your account login password has been rotated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    } finally {
      setBusy(false);
    }
  };

  const handleRotateVaultPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newVaultPassphrase.length < 8) {
      setError('New Family Encryption Passphrase must be at least 8 characters.');
      return;
    }
    if (newVaultPassphrase !== confirmVaultPassphrase) {
      setError('New encryption passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      const { bundle, key } = await createEncryptedVaultBundle(
        newVaultPassphrase,
        {
          clanName: metadata.clanName,
          clanChineseName: metadata.clanChineseName,
          hallName: metadata.hallName,
          ancestralOrigin: metadata.ancestralOrigin,
          generationPoem: metadata.generationPoem,
          branches: metadata.branches,
        },
        members
      );
      await onVaultKeyRotated(bundle, key);
      setNewVaultPassphrase('');
      setConfirmVaultPassphrase('');
      setNotice(
        `Re-encrypted ${members.length} records (${bundle.metadata.keyFingerprint}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate encryption key');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-200 pb-4">
        <p className="text-xs text-stone-500">{t.mfa.kicker}</p>
        <h2 className="font-display text-3xl font-semibold text-stone-900 mt-0.5">
          {t.mfa.title}
        </h2>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TOTP Multi-Factor Authentication & Passkeys */}
        <div className="lg:col-span-7 space-y-6">
        <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <p className="text-xs text-stone-500">{t.mfa.authenticatorSubtitle}</p>
              <h3 className="font-display text-2xl font-semibold text-stone-900 mt-0.5">
                {t.mfa.cardTitle}
              </h3>
            </div>
            <span
              className={`text-xs font-medium ${
                currentUser.mfaEnabled ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {currentUser.mfaEnabled ? t.mfa.activeBadge : t.mfa.notEnrolledBadge}
            </span>
          </div>

          {storageMode === 'offline_only' ? (
            <p className="text-xs text-stone-600 leading-relaxed">{t.mfa.offlineNote}</p>
          ) : currentUser.mfaEnabled ? (
            <div className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">{t.mfa.activeDesc}</p>

              {recoveryCodes && (
                <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 space-y-2">
                  <p className="text-xs font-semibold text-amber-950">{t.mfa.recoveryTitle}</p>
                  <p className="text-xs text-amber-900">{t.mfa.recoveryDesc}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono-tabular text-xs text-stone-900">
                    {recoveryCodes.map((code) => (
                      <div key={code} className="px-2.5 py-1.5 bg-white border border-amber-200 rounded">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleDisableMfa} className="pt-4 border-t border-stone-200 space-y-3">
                <p className="text-xs font-semibold text-stone-800">{t.mfa.disableTitle}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="password"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder={t.auth.passwordLabel}
                    className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder={t.auth.mfaTotpLabel}
                    className="px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium border border-red-300 text-red-800 hover:bg-red-50 rounded-lg"
                >
                  {t.mfa.disableBtn}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {!qrDataUrl ? (
                <>
                  <p className="text-xs text-stone-600 leading-relaxed">{t.mfa.enrollDesc}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleStartMfaEnroll}
                    className="px-4 py-2.5 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-xs font-medium rounded-lg inline-flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {t.mfa.enrollBtn}
                  </button>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    <img
                      src={qrDataUrl}
                      alt="TOTP Authenticator QR Code"
                      className="w-44 h-44 border border-stone-300 rounded-lg bg-white p-2 shrink-0"
                    />
                    <div className="space-y-3">
                      <p className="text-xs text-stone-700 leading-relaxed">{t.mfa.step1}</p>
                      <div className="flex items-center gap-2">
                        <code className="px-3 py-1.5 text-xs font-mono-tabular bg-[#FBF9F5] border border-stone-300 rounded select-all">
                          {secretBase32}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (secretBase32) navigator.clipboard?.writeText(secretBase32);
                            setCopiedSecret(true);
                            setTimeout(() => setCopiedSecret(false), 2000);
                          }}
                          className="p-2 border border-stone-300 rounded-lg hover:bg-stone-50"
                          aria-label="Copy Base32 secret"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <form onSubmit={handleConfirmMfaEnroll} className="space-y-3 pt-1">
                        <label className="block text-xs font-medium text-stone-700">
                          {t.mfa.step2}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            required
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value)}
                            placeholder="000000"
                            className="w-36 px-3 py-2 text-sm font-mono-tabular tracking-widest bg-white border border-stone-300 rounded-lg"
                          />
                          <button
                            type="submit"
                            disabled={busy}
                            className="px-4 py-2 bg-[#9E2A2B] hover:bg-[#822021] text-white text-xs font-medium rounded-lg"
                          >
                            {t.mfa.verifyActivateBtn}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Passkeys (Multiple Hardware & Biometric Keys) */}
        <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <p className="text-xs text-stone-500">{t.mfa.passkeySubtitle}</p>
              <h3 className="font-display text-2xl font-semibold text-stone-900 mt-0.5 flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-[#9E2A2B]" />
                {t.mfa.passkeyTitle}
              </h3>
            </div>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                userPasskeys.length > 0 ? 'text-emerald-700' : 'text-stone-500'
              }`}
            >
              {userPasskeys.length > 0
                ? `${userPasskeys.length} ${t.mfa.passkeyCountBadge}`
                : t.mfa.passkeyNoneBadge}
            </span>
          </div>

          {storageMode === 'offline_only' ? (
            <p className="text-xs text-stone-600 leading-relaxed">{t.mfa.passkeyOfflineNote}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">{t.mfa.passkeyDesc}</p>

              {userPasskeys.length > 0 && (
                <div className="divide-y divide-stone-200 border border-stone-200 rounded-lg bg-[#FBF9F5]">
                  {userPasskeys.map((pk) => {
                    const isEditing = editingPasskeyId === pk.id;
                    const isConfirmingRemove = confirmRemovePasskeyId === pk.id;
                    return (
                      <div
                        key={pk.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={60}
                                value={editingPasskeyLabel}
                                onChange={(e) => setEditingPasskeyLabel(e.target.value)}
                                className="px-2.5 py-1 text-xs bg-white border border-stone-300 rounded flex-1 min-w-0"
                              />
                              <button
                                type="button"
                                disabled={passkeyBusy || !editingPasskeyLabel.trim()}
                                onClick={() => handleSavePasskeyName(pk.id)}
                                className="px-2.5 py-1 text-xs font-medium bg-[#9E2A2B] text-white rounded hover:bg-[#822021]"
                              >
                                {t.mfa.passkeySaveNameBtn}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPasskeyId(null);
                                  setEditingPasskeyLabel('');
                                }}
                                className="px-2 py-1 text-xs text-stone-500 hover:text-stone-800"
                              >
                                {t.common.cancel}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-stone-900 truncate">
                                {pk.label}
                              </span>
                              <span className="text-[11px] font-medium text-stone-600 border border-stone-300 bg-white px-2 py-0.5 rounded">
                                {pk.deviceType === 'multiDevice'
                                  ? t.mfa.passkeyDeviceMulti
                                  : t.mfa.passkeyDeviceSingle}
                              </span>
                              {pk.backedUp && (
                                <span className="text-[11px] font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded">
                                  {t.mfa.passkeyBackedUp}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-[11px] text-stone-500 font-mono-tabular">
                            {t.mfa.passkeyAddedOn}: {pk.createdAt.slice(0, 10)} · {t.mfa.passkeyLastUsed}:{' '}
                            {pk.lastUsedAt ? pk.lastUsedAt.slice(0, 10) : t.mfa.passkeyNeverUsed}
                          </p>
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={passkeyBusy}
                              onClick={() => {
                                setConfirmRemovePasskeyId(null);
                                setEditingPasskeyId(pk.id);
                                setEditingPasskeyLabel(pk.label);
                              }}
                              className="px-2.5 py-1 text-xs border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3" />
                              {t.mfa.passkeyRenameBtn}
                            </button>

                            {isConfirmingRemove ? (
                              <>
                                <button
                                  type="button"
                                  disabled={passkeyBusy}
                                  onClick={() => handleDeletePasskey(pk.id)}
                                  className="px-2.5 py-1 text-xs font-medium bg-red-700 hover:bg-red-800 text-white rounded"
                                >
                                  {t.mfa.passkeyConfirmRemoveBtn}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemovePasskeyId(null)}
                                  className="px-2 py-1 text-xs text-stone-500 hover:text-stone-800"
                                >
                                  {t.common.cancel}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={passkeyBusy}
                                onClick={() => setConfirmRemovePasskeyId(pk.id)}
                                className="px-2.5 py-1 text-xs border border-red-200 bg-white hover:bg-red-50 text-red-700 rounded inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                {t.mfa.passkeyRemoveBtn}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleAddPasskey} className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  maxLength={60}
                  value={passkeyLabel}
                  onChange={(e) => setPasskeyLabel(e.target.value)}
                  placeholder={t.mfa.passkeyLabelPlaceholder}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
                <button
                  type="submit"
                  disabled={passkeyBusy || userPasskeys.length >= 10}
                  className="px-4 py-2 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-xs font-medium rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {passkeyBusy ? t.mfa.passkeyAddingBtn : t.mfa.passkeyAddBtn}
                </button>
              </form>
              <p className="text-[11px] text-stone-400">{t.mfa.passkeyMaxNote}</p>
            </div>
          )}
        </section>
        </div>

        {/* Key & Password Rotation */}
        <section className="lg:col-span-5 space-y-6">
          {currentUser.permissions.canEditLineage && (
            <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
              <div>
                <p className="text-xs text-stone-500 font-mono-tabular">
                  {t.gate.fingerprint} {metadata.keyFingerprint}
                </p>
                <h3 className="font-display text-xl font-semibold text-stone-900 mt-0.5 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#9E2A2B]" />
                  {t.mfa.rotateKeyTitle}
                </h3>
                <p className="text-xs text-stone-500 mt-1">{t.mfa.rotateKeyDesc}</p>
              </div>
              <form onSubmit={handleRotateVaultPassphrase} className="space-y-3">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newVaultPassphrase}
                  onChange={(e) => setNewVaultPassphrase(e.target.value)}
                  placeholder={t.gate.encPassphrase}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmVaultPassphrase}
                  onChange={(e) => setConfirmVaultPassphrase(e.target.value)}
                  placeholder={t.gate.confirmPassphrase}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2 px-4 border border-stone-300 bg-white hover:bg-stone-50 text-stone-900 text-xs font-medium rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t.mfa.reEncryptBtn}
                </button>
              </form>

              <div className="pt-4 border-t border-stone-200 space-y-2.5">
                <p className="text-xs font-semibold text-stone-800">{t.mfa.custodySheetTitle}</p>
                <p className="text-[11px] text-stone-500 leading-relaxed">{t.mfa.custodySheetDesc}</p>
                <button
                  type="button"
                  disabled={custodyBusy}
                  onClick={async () => {
                    setError(null);
                    setNotice(null);
                    setCustodyBusy(true);
                    try {
                      await downloadHeirCustodySheetPdf(
                        metadata,
                        currentUser,
                        window.location.origin
                      );
                      setNotice(t.mfa.custodySheetSuccess);
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : 'Unable to generate custody sheet PDF'
                      );
                    } finally {
                      setCustodyBusy(false);
                    }
                  }}
                  className="w-full py-2 px-4 border border-[#9E2A2B]/30 bg-[#FBF9F5] hover:bg-white text-[#9E2A2B] text-xs font-medium rounded-lg inline-flex items-center justify-center gap-1.5"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  {custodyBusy ? t.mfa.custodySheetGenerating : t.mfa.custodySheetBtn}
                </button>
              </div>
            </div>
          )}

          {storageMode !== 'offline_only' && (
            <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-stone-600" />
                  {t.mfa.changePwTitle}
                </h3>
              </div>
              <form onSubmit={handleRotatePassword} className="space-y-3">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t.auth.passwordLabel}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t.auth.createPasswordLabel}
                  className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2 px-4 border border-stone-300 bg-white hover:bg-stone-50 text-stone-900 text-xs font-medium rounded-lg"
                >
                  {t.mfa.updatePwBtn}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
