import React, { useState } from 'react';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Lock, ShieldCheck, UserPlus, HardDrive } from 'lucide-react';
import { api, setInMemoryAuthToken, type AuthStatusResponse } from '../lib/api';
import { useI18n } from '../lib/i18n';
import {
  defaultRomanizationScheme,
  romanizeChineseName,
} from '../lib/romanizeName';
import type { UserProfile } from '../types/zupu';
import { LanguageSwitcher } from './LanguageSwitcher';

interface AuthGateProps {
  authStatus: AuthStatusResponse;
  hasLocalOfflineVault: boolean;
  onAuthenticated: (user: UserProfile, mode: 'hybrid_sync' | 'offline_only') => void;
}

type AuthTab = 'claim' | 'login' | 'invite' | 'mfa';

export const AuthGate: React.FC<AuthGateProps> = ({
  authStatus,
  hasLocalOfflineVault,
  onAuthenticated,
}) => {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<AuthTab>(authStatus.custodyClaimed ? 'login' : 'claim');
  const [email, setEmail] = useState(authStatus.custodyClaimed ? '' : 'ChanChi1992@gmail.com');
  const [displayName, setDisplayName] = useState(authStatus.custodyClaimed ? '' : 'Chan Chi');
  const [chineseName, setChineseName] = useState(authStatus.custodyClaimed ? '' : '陳瑞智');
  const [displayNameTouched, setDisplayNameTouched] = useState(!authStatus.custodyClaimed);
  const [password, setPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [sealImgFailed, setSealImgFailed] = useState(false);

  const handleClaimCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.claimCustody({
        email,
        displayName,
        chineseName,
        password,
        adminPasscode: authStatus.envPasscodeConfigured ? adminPasscode : undefined,
      });
      setInMemoryAuthToken(res.token);
      onAuthenticated(res.user, 'hybrid_sync');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim custody');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.login({ email, password });
      setInMemoryAuthToken(res.token);
      if (res.mfaRequired) {
        setPendingUser(res.user);
        setTab('mfa');
      } else {
        onAuthenticated(res.user, 'hybrid_sync');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const handlePasskeyLogin = async () => {
    setError(null);
    if (!browserSupportsWebAuthn()) {
      setError(t.auth.passkeyUnsupported);
      return;
    }
    setPasskeyBusy(true);
    try {
      const { challengeId, options } = await api.getPasskeyLoginOptions(email);
      const assertion = await startAuthentication({ optionsJSON: options });
      const res = await api.verifyPasskeyLogin(challengeId, assertion);
      setInMemoryAuthToken(res.token);
      if (res.mfaRequired) {
        setPendingUser(res.user);
        setTab('mfa');
      } else {
        onAuthenticated(res.user, 'hybrid_sync');
      }
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
        setError(t.auth.passkeyCancelled);
      } else {
        setError(err instanceof Error ? err.message : 'Passkey sign in failed');
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleJoinInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.registerWithInvite({
        inviteCode,
        email,
        displayName,
        chineseName,
        password,
      });
      setInMemoryAuthToken(res.token);
      onAuthenticated(res.user, 'hybrid_sync');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify invite code');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.verifyMfaChallenge(
        useRecoveryCode ? { recoveryCode: mfaCode } : { code: mfaCode }
      );
      setInMemoryAuthToken(res.token);
      onAuthenticated(res.user, 'hybrid_sync');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setBusy(false);
    }
  };

  const handleEnterOfflineMode = () => {
    const fallbackName =
      locale === 'zh-HK' ? '本機掌譜人' : locale === 'zh-CN' ? '本地掌谱人' : 'Local Sovereign Custodian';
    const offlineProfile: UserProfile = {
      id: 'local_sovereign_custodian',
      email: email.trim() || 'local@offline.zupu',
      displayName: displayName.trim() || fallbackName,
      chineseName: chineseName.trim() || '宗族典藏人',
      role: 'patriarch',
      status: 'active',
      mfaEnabled: false,
      permissions: {
        canViewLivingPII: true,
        canViewElderSealed: true,
        canEditLineage: true,
        canExportVault: true,
        canInviteRelatives: false,
        canManageRoles: false,
        branchScope: 'all',
        maxGenerationDepth: 0,
      },
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    onAuthenticated(offlineProfile, 'offline_only');
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Auth Workspace */}
      <div className="lg:col-span-6 flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
          <div className="flex items-center gap-3">
            {!sealImgFailed ? (
              <img
                src="/src/assets/images/vermilion_clan_seal_1795328946321.jpg"
                alt="ZupuVault Vermilion Seal"
                referrerPolicy="no-referrer"
                onError={() => setSealImgFailed(true)}
                className="w-10 h-10 object-cover rounded border border-stone-300"
              />
            ) : (
              <div className="w-10 h-10 rounded border border-[#9E2A2B]/40 bg-[#9E2A2B]/10 flex items-center justify-center font-serif-zh text-[#9E2A2B] font-bold">
                譜
              </div>
            )}
            <span className="font-display text-2xl font-semibold tracking-tight text-stone-900">
              {t.common.brand}
            </span>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="max-w-md w-full mx-auto my-10">
          {tab !== 'mfa' && (
            <div className="mb-7">
              <p className="text-xs text-stone-500 mb-2">{t.auth.kicker}</p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-stone-900 leading-tight [text-wrap:balance]">
                {tab === 'claim'
                  ? t.auth.titleClaim
                  : tab === 'invite'
                  ? t.auth.titleInvite
                  : t.auth.titleLogin}
              </h1>
            </div>
          )}

          {tab !== 'mfa' && (
            <div className="flex items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-lg mb-6">
              {!authStatus.custodyClaimed && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setTab('claim');
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tab === 'claim'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t.auth.tabClaim}
                </button>
              )}
              {authStatus.custodyClaimed && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setTab('login');
                  }}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    tab === 'login'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {t.auth.tabLogin}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setTab('invite');
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === 'invite'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {t.auth.tabInvite}
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 px-4 py-3 rounded-lg border border-red-300 bg-red-50 text-xs text-red-900"
            >
              <strong className="font-semibold">{t.auth.accessNotice} </strong>
              {error}
            </div>
          )}

          {tab === 'claim' && (
            <form onSubmit={handleClaimCustody} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.auth.custodianEngName}
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDisplayName(val);
                      setDisplayNameTouched(val.trim().length > 0);
                    }}
                    placeholder="Chan Chi"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.auth.chineseNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={chineseName}
                    onChange={(e) => {
                      const nextZh = e.target.value;
                      setChineseName(nextZh);
                      if (!displayNameTouched || !displayName.trim()) {
                        setDisplayName(
                          romanizeChineseName(nextZh, defaultRomanizationScheme(locale))
                        );
                      }
                    }}
                    placeholder="陳瑞智"
                    className="w-full px-3.5 py-2.5 text-sm font-serif-zh bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t.auth.custodianEmail}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="custodian@family.org"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t.auth.custodianPassword}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>

              {authStatus.envPasscodeConfigured && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.auth.envPasscodeLabel}
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {busy ? t.auth.claimingButton : t.auth.claimButton}
              </button>
            </form>
          )}

          {tab === 'login' && (
            <div className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.auth.memberEmail}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@family.org"
                    autoComplete="username webauthn"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.auth.passwordLabel}
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || passkeyBusy}
                  className="w-full py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {busy ? t.auth.signingInButton : t.auth.signInButton}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-stone-200" />
                <span className="px-3 text-[11px] text-stone-400 whitespace-nowrap">
                  {t.auth.passkeyOrDivider}
                </span>
                <div className="flex-grow border-t border-stone-200" />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={busy || passkeyBusy}
                  onClick={handlePasskeyLogin}
                  className="w-full py-2.5 px-4 border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-60 text-stone-900 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Fingerprint className="w-4 h-4 text-[#9E2A2B]" />
                  {passkeyBusy ? t.auth.passkeySigningInBtn : t.auth.passkeySignInBtn}
                </button>
                <p className="text-[11px] text-stone-500 leading-relaxed">{t.auth.passkeyHint}</p>
              </div>
            </div>
          )}

          {tab === 'invite' && (
            <form onSubmit={handleJoinInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t.auth.inviteCodeLabel}
                </label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="ZUPU-XXXX-XXXX"
                  className="w-full px-3.5 py-2.5 text-sm font-mono-tabular bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.auth.fullNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDisplayName(val);
                      setDisplayNameTouched(val.trim().length > 0);
                    }}
                    placeholder="Chen Ruilan"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    {t.auth.chineseNameLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={chineseName}
                    onChange={(e) => {
                      const nextZh = e.target.value;
                      setChineseName(nextZh);
                      if (!displayNameTouched || !displayName.trim()) {
                        setDisplayName(
                          romanizeChineseName(nextZh, defaultRomanizationScheme(locale))
                        );
                      }
                    }}
                    placeholder="陳瑞蘭"
                    className="w-full px-3.5 py-2.5 text-sm font-serif-zh bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t.auth.emailAddressLabel}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="relative@family.org"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {t.auth.createPasswordLabel}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {busy ? t.auth.redeemingButton : t.auth.redeemButton}
              </button>
            </form>
          )}

          {tab === 'mfa' && (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="mb-4">
                <p className="text-xs text-stone-500 mb-1">
                  {t.auth.mfaKicker} · {pendingUser?.email}
                </p>
                <h2 className="font-display text-3xl font-semibold text-stone-900">
                  {t.auth.mfaTitle}
                </h2>
                <p className="text-sm text-stone-600 mt-1">{t.auth.mfaSubtitle}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  {useRecoveryCode ? t.auth.mfaRecoveryLabel : t.auth.mfaTotpLabel}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder={useRecoveryCode ? 'A1B2C-D3E4F' : '000000'}
                  className="w-full px-3.5 py-2.5 text-base font-mono-tabular tracking-widest bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                {busy ? t.auth.mfaVerifyingButton : t.auth.mfaVerifyButton}
              </button>
              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode((v) => !v);
                    setMfaCode('');
                    setError(null);
                  }}
                  className="text-stone-600 hover:text-stone-900 underline underline-offset-4"
                >
                  {useRecoveryCode ? t.auth.mfaUseApp : t.auth.mfaUseRecovery}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInMemoryAuthToken(null);
                    setPendingUser(null);
                    setMfaCode('');
                    setTab('login');
                  }}
                  className="text-stone-500 hover:text-stone-800"
                >
                  {t.auth.mfaCancel}
                </button>
              </div>
            </form>
          )}

          {/* Offline Sovereignty Option */}
          {tab !== 'mfa' && (
            <div className="mt-8 pt-6 border-t border-stone-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-stone-800">{t.auth.offlineTitle}</p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    {hasLocalOfflineVault ? t.auth.offlineExistingDesc : t.auth.offlineNewDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleEnterOfflineMode}
                  className="px-3.5 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <HardDrive className="w-3.5 h-3.5 text-[#9E2A2B]" />
                  {hasLocalOfflineVault ? t.auth.offlineOpenBtn : t.auth.offlineModeBtn}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-stone-400">{t.auth.footerNote}</p>
      </div>

      {/* Right Archival Landscape Showcase */}
      <div className="lg:col-span-6 relative min-h-[360px] lg:min-h-screen border-t lg:border-t-0 lg:border-l border-stone-200 overflow-hidden bg-[#EFEAE0]">
        {!heroImgFailed ? (
          <img
            src="/src/assets/images/ancestral_hall_backdrop_1795328945445.jpg"
            alt="Traditional Chinese ink-wash mountain landscape on aged xuan paper"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#F3EFE6] to-[#E5DEC9]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#1C1917]/85 via-[#1C1917]/30 to-transparent flex flex-col justify-end p-8 sm:p-12 text-stone-100">
          <div className="max-w-lg">
            <p className="text-xs tracking-widest uppercase text-stone-300 mb-2 font-serif-zh">
              {t.auth.heroKicker}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold leading-tight text-white [text-wrap:balance]">
              {t.auth.heroTitle}
            </h2>
            <p className="text-sm text-stone-200 mt-3 leading-relaxed">{t.auth.heroDesc}</p>
            <div className="mt-6 pt-5 border-t border-white/20 grid grid-cols-2 gap-4 text-xs text-stone-200">
              <div>
                <p className="font-semibold text-white">{t.auth.pillar1Title}</p>
                <p className="text-stone-300 mt-0.5">{t.auth.pillar1Desc}</p>
              </div>
              <div>
                <p className="font-semibold text-white">{t.auth.pillar2Title}</p>
                <p className="text-stone-300 mt-0.5">{t.auth.pillar2Desc}</p>
              </div>
              <div>
                <p className="font-semibold text-white">{t.auth.pillar3Title}</p>
                <p className="text-stone-300 mt-0.5">{t.auth.pillar3Desc}</p>
              </div>
              <div>
                <p className="font-semibold text-white">{t.auth.pillar4Title}</p>
                <p className="text-stone-300 mt-0.5">{t.auth.pillar4Desc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
