import React, { useEffect, useState } from 'react';
import {
  Copy,
  Check,
  Crown,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  ShieldOff,
  UserPlus,
  Trash2,
  Save,
} from 'lucide-react';
import { api, setInMemoryAuthToken } from '../lib/api';
import { useI18n } from '../lib/i18n';
import {
  DEFAULT_BRANCHES,
  getBranchLabel,
  getRoleLabel,
  presetPermissionsForRole,
  ROLE_META,
} from '../lib/roles';
import {
  containsHanzi,
  defaultRomanizationScheme,
  romanizeChineseName,
  type RomanizationScheme,
} from '../lib/romanizeName';
import type {
  AuditEntry,
  BranchDefinition,
  BranchScope,
  ClanRole,
  GranularPermissions,
  InviteRecord,
  StorageMode,
  UserProfile,
} from '../types/zupu';

interface AccessRolesPanelProps {
  currentUser: UserProfile;
  storageMode: StorageMode;
  branches?: BranchDefinition[];
  onUserUpdated?: (user: UserProfile) => void;
}

export const AccessRolesPanel: React.FC<AccessRolesPanelProps> = ({
  currentUser,
  storageMode,
  branches = DEFAULT_BRANCHES,
  onUserUpdated,
}) => {
  const { locale, t } = useI18n();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [draftChineseName, setDraftChineseName] = useState('');
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftDisplayTouched, setDraftDisplayTouched] = useState(true);
  const [romanizeScheme, setRomanizeScheme] = useState<RomanizationScheme>(() =>
    defaultRomanizationScheme(locale)
  );
  const [draftRole, setDraftRole] = useState<ClanRole>('verified_relative');
  const [draftStatus, setDraftStatus] = useState<'active' | 'suspended'>('active');
  const [draftPerms, setDraftPerms] = useState<GranularPermissions>(
    presetPermissionsForRole('verified_relative')
  );
  const [savingMember, setSavingMember] = useState(false);

  const [draftNewPassword, setDraftNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [copiedResetPassword, setCopiedResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [confirmingMfaResetId, setConfirmingMfaResetId] = useState<string | null>(null);
  const [resettingMfa, setResettingMfa] = useState(false);
  const [confirmingPasskeyResetId, setConfirmingPasskeyResetId] = useState<string | null>(null);
  const [resettingPasskeys, setResettingPasskeys] = useState(false);

  const [inviteeName, setInviteeName] = useState('');
  const [inviteNameTouched, setInviteNameTouched] = useState(false);
  const [inviteeChineseName, setInviteeChineseName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ClanRole>('verified_relative');
  const [invitePerms, setInvitePerms] = useState<GranularPermissions>(
    presetPermissionsForRole('verified_relative')
  );
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferTotp, setTransferTotp] = useState('');
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [transferringCustody, setTransferringCustody] = useState(false);

  useEffect(() => {
    setRomanizeScheme(defaultRomanizationScheme(locale));
  }, [locale]);

  const canManageRoles =
    currentUser.role === 'patriarch' || currentUser.permissions.canManageRoles;
  const canInvite =
    currentUser.role === 'patriarch' || currentUser.permissions.canInviteRelatives;
  const canViewAudit =
    currentUser.role === 'patriarch' ||
    currentUser.role === 'archivist' ||
    currentUser.permissions.canManageRoles;

  const loadData = async () => {
    if (storageMode === 'offline_only') {
      setMembers([currentUser]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMembersAndInvites();
      setMembers(res.members);
      setInvites(res.invites);
      if (canViewAudit) {
        const auditRes = await api.getAuditLogs();
        setAuditLogs(auditRes.logs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load family access registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageMode, currentUser.id]);

  const beginEditMember = (member: UserProfile) => {
    setEditingMemberId(member.id);
    setDraftChineseName(member.chineseName);
    setDraftDisplayName(member.displayName);
    setDraftEmail(member.email);
    setDraftDisplayTouched(Boolean(member.displayName.trim()));
    setDraftRole(member.role);
    setDraftStatus(member.status);
    setDraftPerms({ ...member.permissions });
    setDraftNewPassword('');
    setShowResetPassword(false);
    setCopiedResetPassword(false);
    setConfirmingMfaResetId(null);
    setNotice(null);
    setError(null);
  };

  const generateStrongTempPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const bytes = new Uint32Array(14);
    window.crypto.getRandomValues(bytes);
    const pwd = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
    setDraftNewPassword(pwd);
    setShowResetPassword(true);
    setCopiedResetPassword(false);
  };

  const handleCustodianResetPassword = async (member: UserProfile) => {
    setError(null);
    setNotice(null);
    if (draftNewPassword.length < 8 || draftNewPassword.length > 128) {
      setError(t.roles.passwordMinLengthError);
      return;
    }
    setResettingPassword(true);
    try {
      const res = await api.resetMemberPassword(member.id, draftNewPassword);
      if (res.token) {
        setInMemoryAuthToken(res.token);
      }
      setMembers((prev) => prev.map((m) => (m.id === member.id ? res.member : m)));
      if (member.id === currentUser.id) {
        onUserUpdated?.(res.member);
      }
      setNotice(
        `${t.roles.passwordResetSuccess} ${res.member.chineseName} (${res.member.displayName}).`
      );
      if (canViewAudit) {
        const auditRes = await api.getAuditLogs();
        setAuditLogs(auditRes.logs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset member password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCustodianResetMfa = async (member: UserProfile) => {
    setError(null);
    setNotice(null);
    setResettingMfa(true);
    try {
      const res = await api.resetMemberMfa(member.id);
      if (res.token) {
        setInMemoryAuthToken(res.token);
      }
      setMembers((prev) => prev.map((m) => (m.id === member.id ? res.member : m)));
      if (member.id === currentUser.id) {
        onUserUpdated?.(res.member);
      }
      setConfirmingMfaResetId(null);
      setNotice(
        `${t.roles.mfaResetSuccess} ${res.member.chineseName} (${res.member.displayName}).`
      );
      if (canViewAudit) {
        const auditRes = await api.getAuditLogs();
        setAuditLogs(auditRes.logs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset member MFA');
    } finally {
      setResettingMfa(false);
    }
  };

  const handleCustodianResetPasskeys = async (member: UserProfile) => {
    setError(null);
    setNotice(null);
    setResettingPasskeys(true);
    try {
      const res = await api.resetMemberPasskeys(member.id);
      if (res.token) {
        setInMemoryAuthToken(res.token);
      }
      setMembers((prev) => prev.map((m) => (m.id === member.id ? res.member : m)));
      if (member.id === currentUser.id) {
        onUserUpdated?.(res.member);
      }
      setConfirmingPasskeyResetId(null);
      setNotice(
        `${t.roles.passkeysResetSuccess} ${res.member.chineseName} (${res.member.displayName}).`
      );
      if (canViewAudit) {
        const auditRes = await api.getAuditLogs();
        setAuditLogs(auditRes.logs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to clear member passkeys');
    } finally {
      setResettingPasskeys(false);
    }
  };

  const handleSaveMemberAccount = async (member: UserProfile, canEditPermissions: boolean) => {
    setError(null);
    setNotice(null);

    const cleanChinese = draftChineseName.trim();
    const cleanDisplay = draftDisplayName.trim();
    const cleanEmail = draftEmail.trim().toLowerCase();

    if (!cleanChinese || cleanDisplay.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError(t.roles.nameEmailRequiredError);
      return;
    }

    setSavingMember(true);
    try {
      const res = await api.updateMemberAccess(member.id, {
        chineseName: cleanChinese,
        displayName: cleanDisplay,
        email: cleanEmail,
        ...(canEditPermissions
          ? {
              role: draftRole,
              status: draftStatus,
              permissions: draftPerms,
            }
          : {}),
      });
      setMembers((prev) => prev.map((m) => (m.id === member.id ? res.member : m)));
      if (member.id === currentUser.id) {
        onUserUpdated?.(res.member);
      }
      setEditingMemberId(null);
      setNotice(`${t.roles.updatedNoticePrefix} ${res.member.chineseName} (${res.member.displayName}).`);
      if (canViewAudit) {
        const auditRes = await api.getAuditLogs();
        setAuditLogs(auditRes.logs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save member account details');
    } finally {
      setSavingMember(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingInvite(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.createInvite({
        inviteeName,
        inviteeChineseName,
        inviteeEmail: inviteeEmail.trim() || undefined,
        role: inviteRole,
        permissions: invitePerms,
      });
      setIssuedCode(res.rawCode);
      setInvites((prev) => [res.invite, ...prev]);
      setInviteeName('');
      setInviteNameTouched(false);
      setInviteeChineseName('');
      setInviteeEmail('');
      setNotice(`Issued invite for ${res.invite.inviteeName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await api.revokeInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to revoke invite');
    }
  };

  if (storageMode === 'offline_only') {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-8 max-w-2xl">
        <p className="text-xs text-stone-500">{t.ribbon.offlineOnly}</p>
        <h2 className="font-display text-3xl font-semibold text-stone-900 mt-1">
          {t.roles.offlineTitle}
        </h2>
        <p className="text-sm text-stone-600 mt-2 leading-relaxed">{t.roles.offlineDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-stone-500">{t.roles.kicker}</p>
          <h2 className="font-display text-3xl font-semibold text-stone-900 mt-0.5">
            {t.roles.title}
          </h2>
        </div>
        <p className="text-xs text-stone-500">
          {t.roles.yourRole}{' '}
          <strong className="text-stone-900">{getRoleLabel(currentUser.role, locale)}</strong>
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

      {/* Registered Family Accounts */}
      <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-stone-900">
            {t.roles.accountsTitle} ({members.length})
          </h3>
          <span className="text-xs text-stone-500">{t.roles.rbacSubtitle}</span>
        </div>

        {loading ? (
          <div className="p-6 text-xs text-stone-500">{t.roles.loading}</div>
        ) : (
          <div className="divide-y divide-stone-200">
            {members.map((member) => {
              const isEditing = editingMemberId === member.id;
              const canEditPermissions =
                canManageRoles && (currentUser.role === 'patriarch' || member.role !== 'patriarch');
              const canEditAccount = member.id === currentUser.id || canEditPermissions;

              return (
                <div key={member.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-serif-zh text-lg font-semibold text-stone-900">
                          {member.chineseName}
                        </span>
                        <span className="text-sm font-medium text-stone-800">
                          {member.displayName}
                        </span>
                        <span className="text-xs text-stone-400">·</span>
                        <span className="text-xs text-stone-600 font-mono-tabular">
                          {member.email}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        <span className="text-stone-800 font-medium">
                          {getRoleLabel(member.role, locale)}
                        </span>
                        {member.role !== 'patriarch' && member.permissions.canManageRoles && (
                          <>
                            {' · '}
                            <span className="text-[#9E2A2B] font-medium">
                              {t.roles.coCustodianBadge}
                            </span>
                          </>
                        )}
                        {' · '}
                        <span>{getBranchLabel(member.permissions.branchScope, locale, branches)}</span>
                        {' · '}
                        <span className={member.mfaEnabled ? 'text-emerald-700 font-medium' : 'text-amber-700'}>
                          {member.mfaEnabled ? t.roles.mfaActive : t.roles.mfaNotEnrolled}
                        </span>
                        {(member.passkeys?.length ?? 0) > 0 && (
                          <>
                            {' · '}
                            <span className="text-emerald-700 font-medium">
                              {member.passkeys!.length} {t.roles.passkeysRegisteredSuffix}
                            </span>
                          </>
                        )}
                        {' · '}
                        <span className={member.status === 'active' ? 'text-stone-600' : 'text-red-700 font-semibold'}>
                          {member.status === 'active' ? t.roles.statusActive : t.roles.statusSuspended}
                        </span>
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1.5">
                        {t.roles.grantsPrefix}{' '}
                        {[
                          member.permissions.canViewLivingPII && t.roles.permLivingPii,
                          member.permissions.canViewElderSealed && t.roles.permElderSealed,
                          member.permissions.canEditLineage && t.roles.permEditLineage,
                          member.permissions.canExportVault && t.roles.permExportVault,
                          member.permissions.canInviteRelatives && t.roles.permInviteRelatives,
                          member.permissions.canManageRoles && t.roles.permManageRoles,
                        ]
                          .filter(Boolean)
                          .join(' · ') || t.roles.readOnlyFallback}
                        {member.permissions.maxGenerationDepth > 0
                          ? ` · ${t.roles.depthCap} ${member.permissions.maxGenerationDepth}`
                          : ''}
                      </p>
                    </div>

                    {canEditAccount && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? setEditingMemberId(null) : beginEditMember(member)
                          }
                          className="px-3.5 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg whitespace-nowrap"
                        >
                          {isEditing
                            ? t.roles.cancelEditBtn
                            : canEditPermissions
                            ? t.roles.configureBtn
                            : t.roles.editAccountBtn}
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveMemberAccount(member, canEditPermissions);
                      }}
                      className="mt-5 pt-5 border-t border-stone-200 space-y-5"
                    >
                      {/* Account Identity & Contact Fields */}
                      <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                          {t.roles.accountIdentitySection}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              {t.roles.relZhName}
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={40}
                              value={draftChineseName}
                              onChange={(e) => {
                                const nextZh = e.target.value;
                                setDraftChineseName(nextZh);
                                if (!draftDisplayTouched || !draftDisplayName.trim()) {
                                  setDraftDisplayName(
                                    romanizeChineseName(nextZh, romanizeScheme)
                                  );
                                }
                              }}
                              className="w-full px-3 py-2 text-xs font-serif-zh bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <label className="block text-xs font-medium text-stone-700 truncate">
                                {t.roles.relEngName}
                              </label>
                              <div className="flex items-center gap-1 shrink-0">
                                <div className="inline-flex rounded border border-stone-300 bg-stone-50 overflow-hidden text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRomanizeScheme('cantonese');
                                      setDraftDisplayTouched(false);
                                      if (draftChineseName.trim()) {
                                        setDraftDisplayName(
                                          romanizeChineseName(draftChineseName, 'cantonese')
                                        );
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 transition-colors whitespace-nowrap ${
                                      romanizeScheme === 'cantonese'
                                        ? 'bg-[#9E2A2B] text-white font-medium'
                                        : 'text-stone-600 hover:bg-stone-100'
                                    }`}
                                  >
                                    {t.drawer.romanizeSchemeCantonese}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRomanizeScheme('pinyin');
                                      setDraftDisplayTouched(false);
                                      if (draftChineseName.trim()) {
                                        setDraftDisplayName(
                                          romanizeChineseName(draftChineseName, 'pinyin')
                                        );
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 transition-colors whitespace-nowrap ${
                                      romanizeScheme === 'pinyin'
                                        ? 'bg-[#9E2A2B] text-white font-medium'
                                        : 'text-stone-600 hover:bg-stone-100'
                                    }`}
                                  >
                                    {t.drawer.romanizeSchemePinyin}
                                  </button>
                                </div>
                                {containsHanzi(draftChineseName) && draftDisplayTouched && (
                                  <button
                                    type="button"
                                    title={t.drawer.romanizeRegenerate}
                                    aria-label={t.drawer.romanizeRegenerate}
                                    onClick={() => {
                                      setDraftDisplayTouched(false);
                                      setDraftDisplayName(
                                        romanizeChineseName(draftChineseName, romanizeScheme)
                                      );
                                    }}
                                    className="p-0.5 text-stone-500 hover:text-[#9E2A2B] rounded border border-stone-300 bg-white hover:bg-stone-50"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <input
                              type="text"
                              required
                              minLength={2}
                              maxLength={80}
                              value={draftDisplayName}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftDisplayName(val);
                                setDraftDisplayTouched(val.trim().length > 0);
                              }}
                              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              {t.roles.accountEmail}
                            </label>
                            <input
                              type="email"
                              required
                              maxLength={120}
                              value={draftEmail}
                              onChange={(e) => setDraftEmail(e.target.value)}
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Role & Access Permissions */}
                      {canEditPermissions && (
                        <div className="space-y-4 pt-4 border-t border-stone-100">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                            {t.roles.permissionsSection}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-stone-700 mb-1">
                                {t.roles.primaryRole}
                              </label>
                              <select
                                value={draftRole}
                                onChange={(e) => {
                                  const r = e.target.value as ClanRole;
                                  setDraftRole(r);
                                  setDraftPerms(presetPermissionsForRole(r));
                                }}
                                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                              >
                                {(Object.keys(ROLE_META) as ClanRole[])
                                  .filter((key) => currentUser.role === 'patriarch' || key !== 'patriarch')
                                  .map((key) => (
                                    <option key={key} value={key}>
                                      {getRoleLabel(key, locale)}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-stone-700 mb-1">
                                {t.roles.branchScope}
                              </label>
                              <select
                                value={draftPerms.branchScope}
                                onChange={(e) =>
                                  setDraftPerms({
                                    ...draftPerms,
                                    branchScope: e.target.value as BranchScope,
                                  })
                                }
                                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                              >
                                {(['all', ...branches.map((b) => b.id)] as BranchScope[]).map((key) => (
                                  <option key={key} value={key}>
                                    {getBranchLabel(key, locale, branches)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-stone-700 mb-1">
                                {t.roles.maxDepth}
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={30}
                                value={draftPerms.maxGenerationDepth}
                                onChange={(e) =>
                                  setDraftPerms({
                                    ...draftPerms,
                                    maxGenerationDepth: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 rounded-lg"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-stone-700 mb-1">
                                {t.roles.accountStatus}
                              </label>
                              <select
                                value={draftStatus}
                                onChange={(e) =>
                                  setDraftStatus(e.target.value as 'active' | 'suspended')
                                }
                                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                              >
                                <option value="active">{t.roles.activeMemberOpt}</option>
                                <option value="suspended">{t.roles.suspendedOpt}</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            {(
                              [
                                ['canViewLivingPII', t.roles.permLivingPii],
                                ['canViewElderSealed', t.roles.permElderSealed],
                                ['canEditLineage', t.roles.permEditLineage],
                                ['canExportVault', t.roles.permExportVault],
                                ['canInviteRelatives', t.roles.permInviteRelatives],
                                ['canManageRoles', t.roles.permManageRoles],
                              ] as const
                            ).map(([permKey, permLabel]) => (
                              <label
                                key={permKey}
                                className="flex items-center gap-2 p-2.5 rounded-lg border border-stone-200 bg-[#FBF9F5] cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={draftPerms[permKey]}
                                  onChange={(e) =>
                                    setDraftPerms({ ...draftPerms, [permKey]: e.target.checked })
                                  }
                                  className="accent-[#9E2A2B]"
                                />
                                <span className="text-stone-800">{permLabel}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={savingMember}
                          className="px-4 py-2 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {savingMember
                            ? t.roles.savingBtn
                            : canEditPermissions
                            ? t.roles.savePermsBtn
                            : t.roles.saveAccountBtn}
                        </button>
                      </div>

                      {/* Patriarch / Custodian Password & MFA Recovery */}
                      {currentUser.role === 'patriarch' && (
                        <div className="space-y-4 pt-5 border-t border-stone-200 bg-[#FBF9F5] p-4 rounded-xl border">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9E2A2B] flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5" />
                              {t.roles.custodianRecoverySection}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                            {/* Password Reset */}
                            <div className="lg:col-span-7 space-y-1.5">
                              <label className="block text-xs font-medium text-stone-700">
                                {t.roles.newTempPassword}
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[200px]">
                                  <input
                                    type={showResetPassword ? 'text' : 'password'}
                                    minLength={8}
                                    maxLength={128}
                                    value={draftNewPassword}
                                    onChange={(e) => {
                                      setDraftNewPassword(e.target.value);
                                      setCopiedResetPassword(false);
                                    }}
                                    placeholder={t.roles.newTempPasswordPlaceholder}
                                    className="w-full pl-3 pr-16 py-2 text-xs font-mono-tabular bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#9E2A2B]"
                                  />
                                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setShowResetPassword((v) => !v)}
                                      aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                                      className="p-1 text-stone-400 hover:text-stone-700"
                                    >
                                      {showResetPassword ? (
                                        <EyeOff className="w-3.5 h-3.5" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                    {draftNewPassword && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(draftNewPassword);
                                          setCopiedResetPassword(true);
                                          setTimeout(() => setCopiedResetPassword(false), 2000);
                                        }}
                                        aria-label={t.common.copy}
                                        className="p-1 text-stone-400 hover:text-[#9E2A2B]"
                                      >
                                        {copiedResetPassword ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={generateStrongTempPassword}
                                  className="px-3 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap"
                                >
                                  {t.roles.genTempPasswordBtn}
                                </button>
                                <button
                                  type="button"
                                  disabled={resettingPassword || draftNewPassword.length < 8}
                                  onClick={() => handleCustodianResetPassword(member)}
                                  className="px-3.5 py-2 text-xs font-medium bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-lg whitespace-nowrap inline-flex items-center gap-1.5"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  {resettingPassword
                                    ? t.roles.resettingPasswordBtn
                                    : t.roles.resetPasswordBtn}
                                </button>
                              </div>
                            </div>

                            {/* MFA & Passkeys Reset */}
                            <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-2">
                              {member.mfaEnabled ? (
                                confirmingMfaResetId === member.id ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={resettingMfa}
                                      onClick={() => handleCustodianResetMfa(member)}
                                      className="px-3.5 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg whitespace-nowrap inline-flex items-center gap-1.5"
                                    >
                                      <ShieldOff className="w-3.5 h-3.5" />
                                      {resettingMfa
                                        ? t.roles.resettingMfaBtn
                                        : t.roles.confirmResetMfaBtn}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={resettingMfa}
                                      onClick={() => setConfirmingMfaResetId(null)}
                                      className="px-3 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap"
                                    >
                                      {t.roles.cancelEditBtn}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingMfaResetId(member.id)}
                                    className="px-3.5 py-2 text-xs font-medium border border-[#9E2A2B]/40 bg-white hover:bg-red-50 text-[#9E2A2B] rounded-lg whitespace-nowrap inline-flex items-center gap-1.5"
                                  >
                                    <ShieldOff className="w-3.5 h-3.5" />
                                    {t.roles.resetMfaBtn}
                                  </button>
                                )
                              ) : (
                                <span className="text-xs text-stone-500 py-1">
                                  {t.roles.mfaAlreadyClear}
                                </span>
                              )}

                              {(member.passkeys?.length ?? 0) > 0 ? (
                                confirmingPasskeyResetId === member.id ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={resettingPasskeys}
                                      onClick={() => handleCustodianResetPasskeys(member)}
                                      className="px-3.5 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg whitespace-nowrap inline-flex items-center gap-1.5"
                                    >
                                      <Fingerprint className="w-3.5 h-3.5" />
                                      {resettingPasskeys
                                        ? t.roles.resettingPasskeysBtn
                                        : t.roles.confirmResetPasskeysBtn}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={resettingPasskeys}
                                      onClick={() => setConfirmingPasskeyResetId(null)}
                                      className="px-3 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap"
                                    >
                                      {t.roles.cancelEditBtn}
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingPasskeyResetId(member.id)}
                                    className="px-3.5 py-2 text-xs font-medium border border-[#9E2A2B]/40 bg-white hover:bg-red-50 text-[#9E2A2B] rounded-lg whitespace-nowrap inline-flex items-center gap-1.5"
                                  >
                                    <Fingerprint className="w-3.5 h-3.5" />
                                    {t.roles.resetPasskeysBtn} ({member.passkeys!.length})
                                  </button>
                                )
                              ) : (
                                <span className="text-xs text-stone-500 py-1">
                                  {t.roles.passkeysAlreadyClear}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] text-stone-500 leading-relaxed">
                            {t.roles.recoveryHint}
                          </p>
                        </div>
                      )}
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Invite Verified Relatives */}
      {canInvite && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-stone-200 rounded-xl p-6">
            <h3 className="font-display text-xl font-semibold text-stone-900">
              {t.roles.issueInviteTitle}
            </h3>
            <p className="text-xs text-stone-500 mt-1 mb-5">{t.roles.issueInviteDesc}</p>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.roles.relZhName}
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteeChineseName}
                    onChange={(e) => {
                      const nextZh = e.target.value;
                      setInviteeChineseName(nextZh);
                      if (!inviteNameTouched || !inviteeName.trim()) {
                        setInviteeName(romanizeChineseName(nextZh, romanizeScheme));
                      }
                    }}
                    placeholder="陳瑞蘭"
                    className="w-full px-3 py-2 text-xs font-serif-zh bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.roles.relEngName}
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteeName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInviteeName(val);
                      setInviteNameTouched(val.trim().length > 0);
                    }}
                    placeholder="Chan Sui Lan"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.roles.boundEmail}
                  </label>
                  <input
                    type="email"
                    value={inviteeEmail}
                    onChange={(e) => setInviteeEmail(e.target.value)}
                    placeholder="relative@family.org"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.roles.assignedRole}
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => {
                      const r = e.target.value as ClanRole;
                      setInviteRole(r);
                      setInvitePerms(presetPermissionsForRole(r));
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  >
                    {(Object.keys(ROLE_META) as ClanRole[])
                      .filter((k) => currentUser.role === 'patriarch' || k !== 'patriarch')
                      .map((key) => (
                        <option key={key} value={key}>
                          {getRoleLabel(key, locale)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  value={invitePerms.branchScope}
                  onChange={(e) =>
                    setInvitePerms({
                      ...invitePerms,
                      branchScope: e.target.value as BranchScope,
                    })
                  }
                  className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                >
                  {(['all', ...branches.map((b) => b.id)] as BranchScope[]).map((key) => (
                    <option key={key} value={key}>
                      {getBranchLabel(key, locale, branches)}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-[#FBF9F5]">
                  <input
                    type="checkbox"
                    checked={invitePerms.canViewLivingPII}
                    onChange={(e) =>
                      setInvitePerms({ ...invitePerms, canViewLivingPII: e.target.checked })
                    }
                    className="accent-[#9E2A2B]"
                  />
                  <span>{t.roles.permLivingPii}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={creatingInvite}
                className="w-full py-2.5 px-4 bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white text-xs font-medium rounded-lg inline-flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                {creatingInvite ? t.roles.generatingBtn : t.roles.genInviteBtn}
              </button>
            </form>

            {issuedCode && (
              <div className="mt-5 p-4 rounded-lg border border-emerald-300 bg-emerald-50">
                <p className="text-xs font-semibold text-emerald-900">{t.roles.inviteReady}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <code className="font-mono-tabular text-base font-bold text-stone-900">
                    {issuedCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(issuedCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="px-3 py-1.5 text-xs bg-white border border-emerald-300 rounded-md text-emerald-900 inline-flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? t.common.copied : t.common.copy}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-white border border-stone-200 rounded-xl p-6">
            <h3 className="font-display text-xl font-semibold text-stone-900 mb-4">
              {t.roles.issuedInvitesTitle} ({invites.length})
            </h3>
            {invites.length === 0 ? (
              <p className="text-xs text-stone-500 py-6">{t.roles.noInvites}</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {invites.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-stone-900">
                        {inv.inviteeChineseName} · {inv.inviteeName}{' '}
                        <span className="font-mono-tabular text-stone-500">({inv.codeHint})</span>
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {getRoleLabel(inv.role, locale)} ·{' '}
                        {getBranchLabel(inv.permissions.branchScope, locale, branches)} ·{' '}
                        {inv.usedAt
                          ? `${t.roles.redeemedOn} ${inv.usedAt.slice(0, 10)}`
                          : `${t.roles.expiresOn} ${inv.expiresAt.slice(0, 10)}`}
                      </p>
                    </div>
                    {!inv.usedAt && (
                      <button
                        type="button"
                        onClick={() => handleRevokeInvite(inv.id)}
                        aria-label="Revoke invite"
                        className="p-2 text-stone-400 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Patriarch Succession / Transfer Custody */}
      {storageMode === 'hybrid_sync' && currentUser.role === 'patriarch' && (
        <section className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <div className="border-b border-stone-200 pb-4">
            <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#9E2A2B]" />
              {t.roles.transferTitle}
            </h3>
            <p className="text-xs text-stone-500 mt-1">{t.roles.transferDesc}</p>
          </div>

          {(() => {
            const eligibleSuccessors = members.filter(
              (m) => m.id !== currentUser.id && m.status === 'active'
            );
            if (eligibleSuccessors.length === 0) {
              return (
                <p className="text-xs text-stone-500">{t.roles.noEligibleSuccessor}</p>
              );
            }
            const selectedId =
              eligibleSuccessors.some((m) => m.id === transferTargetId)
                ? transferTargetId
                : eligibleSuccessors[0].id;

            const handleTransfer = async () => {
              setError(null);
              setNotice(null);
              setTransferringCustody(true);
              try {
                const res = await api.transferPatriarchCustody({
                  targetUserId: selectedId,
                  currentPassword: transferPassword,
                  totpCode: currentUser.mfaEnabled ? transferTotp : undefined,
                });
                onUserUpdated?.(res.currentUser);
                setTransferPassword('');
                setTransferTotp('');
                setConfirmingTransfer(false);
                await loadData();
                setNotice(`${t.roles.transferSuccessPrefix} ${res.targetUser.displayName}.`);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Unable to transfer custody');
              } finally {
                setTransferringCustody(false);
              }
            };

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.roles.transferTargetLabel}
                  </label>
                  <select
                    value={selectedId}
                    onChange={(e) => {
                      setTransferTargetId(e.target.value);
                      setConfirmingTransfer(false);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  >
                    {eligibleSuccessors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.chineseName} · {m.displayName} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {t.roles.transferPasswordLabel}
                  </label>
                  <input
                    type="password"
                    value={transferPassword}
                    onChange={(e) => {
                      setTransferPassword(e.target.value);
                      setConfirmingTransfer(false);
                    }}
                    placeholder={t.auth.passwordLabel}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                  />
                </div>

                {currentUser.mfaEnabled ? (
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      {t.roles.transferTotpLabel}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={transferTotp}
                      onChange={(e) => {
                        setTransferTotp(e.target.value.replace(/\D/g, ''));
                        setConfirmingTransfer(false);
                      }}
                      placeholder="000000"
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="hidden md:block" />
                )}

                <div className="md:col-span-3">
                  {!confirmingTransfer ? (
                    <button
                      type="button"
                      disabled={
                        transferringCustody ||
                        !transferPassword ||
                        (currentUser.mfaEnabled && transferTotp.length !== 6)
                      }
                      onClick={() => setConfirmingTransfer(true)}
                      className="px-4 py-2 text-xs font-medium border border-[#9E2A2B]/40 bg-[#FBF9F5] hover:bg-white disabled:opacity-50 text-[#9E2A2B] rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      {t.roles.transferBtn}
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs text-amber-950">{t.roles.transferConfirmPrompt}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={transferringCustody}
                          onClick={handleTransfer}
                          className="px-3.5 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] disabled:opacity-60 text-white rounded-lg whitespace-nowrap"
                        >
                          {transferringCustody ? t.roles.transferringBtn : t.roles.transferConfirmBtn}
                        </button>
                        <button
                          type="button"
                          disabled={transferringCustody}
                          onClick={() => setConfirmingTransfer(false)}
                          className="px-3 py-2 text-xs font-medium border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg whitespace-nowrap"
                        >
                          {t.common.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* Immutable Clan Audit Log */}
      {canViewAudit && (
        <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-stone-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#9E2A2B]" />
              {t.roles.auditTitle}
            </h3>
            <span className="text-xs font-mono-tabular text-stone-500">
              {auditLogs.length} {t.roles.eventsCount}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-stone-200 bg-[#FBF9F5] text-xs font-medium text-stone-500">
                  <th className="py-2.5 px-4">{t.roles.colTime}</th>
                  <th className="py-2.5 px-4">{t.roles.colActor}</th>
                  <th className="py-2.5 px-4">{t.roles.colEvent}</th>
                  <th className="py-2.5 px-4">{t.roles.colTarget}</th>
                  <th className="py-2.5 px-4">{t.roles.colDetail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {auditLogs.slice(0, 20).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-4 font-mono-tabular text-stone-500 whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2.5 px-4 text-stone-900 font-medium">{log.actorName}</td>
                    <td className="py-2.5 px-4 font-mono-tabular text-[#9E2A2B]">{log.action}</td>
                    <td className="py-2.5 px-4 text-stone-700">{log.target}</td>
                    <td className="py-2.5 px-4 text-stone-600">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
