import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { AccessRolesPanel } from './components/AccessRolesPanel';
import { AuthGate } from './components/AuthGate';
import { ClanChronologyPanel } from './components/ClanChronologyPanel';
import { ClanRegistryTable } from './components/ClanRegistryTable';
import { ExportPdfModal } from './components/ExportPdfModal';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { LineageAuditModal } from './components/LineageAuditModal';
import { LineageTreeCanvas } from './components/LineageTreeCanvas';
import { MemberDetailDrawer } from './components/MemberDetailDrawer';
import { OfflineVaultPanel } from './components/OfflineVaultPanel';
import { SecurityMfaPanel } from './components/SecurityMfaPanel';
import { VaultConflictModal } from './components/VaultConflictModal';
import { VaultPassphraseGate } from './components/VaultPassphraseGate';
import { api, setInMemoryAuthToken, type AuthStatusResponse } from './lib/api';
import { decryptMemberRecord, encryptMemberRecord } from './lib/crypto';
import { useI18n } from './lib/i18n';
import {
  createOfflineSnapshot,
  getPendingSyncFlag,
  getStorageModePreference,
  loadLocalEncryptedVault,
  saveLocalEncryptedVault,
  setPendingSyncFlag,
  setStorageModePreference,
} from './lib/offlineVault';
import { getBranchesFromMetadata, getRoleLabel } from './lib/roles';
import type {
  BranchScope,
  ClanMetadata,
  DecryptedMember,
  EncryptedVaultBundle,
  StorageMode,
  UserProfile,
} from './types/zupu';

type WorkspaceTab = 'tree' | 'ledger' | 'chronology' | 'roles' | 'mfa' | 'offline';

const AUTO_LOCK_STORAGE_KEY = 'zupu_auto_lock_minutes';
const VALID_AUTO_LOCK_MINUTES = [0, 5, 15, 30, 60] as const;

function readInitialAutoLockMinutes(): number {
  try {
    const raw = window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY);
    const parsed = raw !== null ? Number(raw) : 15;
    return VALID_AUTO_LOCK_MINUTES.includes(parsed as (typeof VALID_AUTO_LOCK_MINUTES)[number])
      ? parsed
      : 15;
  } catch {
    return 15;
  }
}

function formatCountdown(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const { locale, t } = useI18n();
  const [booting, setBooting] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [hasLocalVault, setHasLocalVault] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>('hybrid_sync');
  const [pendingSync, setPendingSync] = useState(false);

  const [existingBundle, setExistingBundle] = useState<EncryptedVaultBundle | null>(null);
  const [activeBundle, setActiveBundle] = useState<EncryptedVaultBundle | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [members, setMembers] = useState<DecryptedMember[]>([]);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tree');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [createPreset, setCreatePreset] = useState<{
    generation?: number;
    branch?: Exclude<BranchScope, 'all'>;
    parentIds?: string[];
    spouseIds?: string[];
  } | null>(null);
  const [exportPdfOpen, setExportPdfOpen] = useState(false);
  const [exportPdfBranch, setExportPdfBranch] = useState<BranchScope>('all');
  const [auditOpen, setAuditOpen] = useState(false);
  const [serverRevision, setServerRevision] = useState<number | undefined>(undefined);
  const [conflictState, setConflictState] = useState<{
    bundle: EncryptedVaultBundle;
    auditSummary: string;
    serverRevision?: number;
  } | null>(null);

  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(readInitialAutoLockMinutes);
  const [autoLockRemainingSec, setAutoLockRemainingSec] = useState<number | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const lastActivityAtRef = useRef<number>(Date.now());

  const [globalError, setGlobalError] = useState<string | null>(null);

  const refreshBootState = async () => {
    setBooting(true);
    try {
      const [statusRes, localBundle, prefMode, pendingFlag] = await Promise.all([
        api.getAuthStatus().catch(() => ({
          custodyClaimed: false,
          envPasscodeConfigured: false,
          hasVaultBundle: false,
          memberCount: 0,
        })),
        loadLocalEncryptedVault().catch(() => null),
        getStorageModePreference().catch(() => 'hybrid_sync' as StorageMode),
        getPendingSyncFlag().catch(() => false),
      ]);
      setAuthStatus(statusRes);
      setHasLocalVault(Boolean(localBundle));
      setStorageMode(prefMode);
      setPendingSync(pendingFlag);
    } finally {
      setBooting(false);
    }
  };

  useEffect(() => {
    refreshBootState();
  }, []);

  const handleAuthenticated = async (
    user: UserProfile,
    chosenMode: StorageMode
  ) => {
    setGlobalError(null);
    setLockNotice(null);
    setCurrentUser(user);
    setStorageMode(chosenMode);
    await setStorageModePreference(chosenMode).catch(() => undefined);

    if (chosenMode === 'offline_only') {
      const localBundle = await loadLocalEncryptedVault().catch(() => null);
      setExistingBundle(localBundle);
      return;
    }

    try {
      const [{ bundle, serverRevision: rev }, localBundle] = await Promise.all([
        api.getVault(),
        loadLocalEncryptedVault().catch(() => null),
      ]);
      setServerRevision(rev);
      setExistingBundle(bundle ?? localBundle);
    } catch {
      const localBundle = await loadLocalEncryptedVault().catch(() => null);
      setExistingBundle(localBundle);
    }
  };

  const persistBundle = async (
    nextBundle: EncryptedVaultBundle,
    auditSummary: string,
    forceOverwrite = false
  ) => {
    await saveLocalEncryptedVault(nextBundle);
    setHasLocalVault(true);
    setActiveBundle(nextBundle);

    if (storageMode === 'hybrid_sync') {
      try {
        const res = await api.syncVault(nextBundle, auditSummary, {
          expectedRevision: forceOverwrite ? undefined : serverRevision,
          forceOverwrite,
        });
        setServerRevision(res.serverRevision);
        setConflictState(null);
        await setPendingSyncFlag(false);
        setPendingSync(false);
      } catch (err) {
        const apiErr = err as Error & { conflict?: boolean; currentRevision?: number };
        await setPendingSyncFlag(true);
        setPendingSync(true);
        if (apiErr.conflict) {
          setConflictState({
            bundle: nextBundle,
            auditSummary,
            serverRevision: apiErr.currentRevision,
          });
        } else {
          setGlobalError(
            err instanceof Error
              ? `Saved encrypted locally in IndexedDB; server sync queued (${err.message}).`
              : 'Saved encrypted locally; server sync queued.'
          );
        }
      }
    }
  };

  const handleReloadServerVaultOnConflict = async () => {
    setGlobalError(null);
    const { bundle, serverRevision: latestRev } = await api.getVault();
    setServerRevision(latestRev);
    setConflictState(null);
    if (!bundle) return;

    await saveLocalEncryptedVault(bundle);
    await setPendingSyncFlag(false);
    setPendingSync(false);

    if (vaultKey) {
      try {
        const decrypted = await Promise.all(
          bundle.records.map((env) => decryptMemberRecord(vaultKey, env))
        );
        setActiveBundle(bundle);
        setMembers(decrypted);
        setSelectedMemberId(null);
        return;
      } catch {
        // Another custodian may have rotated the passphrase; fall back to passphrase gate
      }
    }

    setExistingBundle(bundle);
    setActiveBundle(null);
    setVaultKey(null);
    setMembers([]);
    setSelectedMemberId(null);
  };

  const handleVaultUnlocked = async (
    bundle: EncryptedVaultBundle,
    key: CryptoKey,
    decryptedMembers: DecryptedMember[],
    isNewlyCreated: boolean
  ) => {
    setGlobalError(null);
    setLockNotice(null);
    setVaultKey(key);
    setActiveBundle(bundle);
    setMembers(decryptedMembers);

    if (isNewlyCreated) {
      await persistBundle(
        bundle,
        `Initialized encrypted family scroll (${decryptedMembers.length} records)`
      );
    } else {
      await saveLocalEncryptedVault(bundle);
    }
  };

  const handleLockVault = useCallback(
    async (reasonNotice?: string) => {
      if (storageMode === 'hybrid_sync') {
        await api.logout().catch(() => undefined);
      }
      setInMemoryAuthToken(null);
      setVaultKey(null);
      setActiveBundle(null);
      setExistingBundle(null);
      setMembers([]);
      setCurrentUser(null);
      setSelectedMemberId(null);
      setIsCreateMode(false);
      setAuditOpen(false);
      setServerRevision(undefined);
      setConflictState(null);
      setAutoLockRemainingSec(null);
      setLockNotice(reasonNotice ?? null);
      setActiveTab('tree');
      await refreshBootState();
    },
    [storageMode]
  );

  const handleChangeAutoLockMinutes = (minutes: number) => {
    const normalized = VALID_AUTO_LOCK_MINUTES.includes(
      minutes as (typeof VALID_AUTO_LOCK_MINUTES)[number]
    )
      ? minutes
      : 15;
    setAutoLockMinutes(normalized);
    try {
      window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(normalized));
    } catch {
      // Storage may be restricted
    }
  };

  useEffect(() => {
    if (!activeBundle || !vaultKey || autoLockMinutes <= 0) {
      setAutoLockRemainingSec(null);
      return;
    }

    lastActivityAtRef.current = Date.now();
    setAutoLockRemainingSec(autoLockMinutes * 60);

    let lastRecordedTouch = 0;
    const bumpActivity = () => {
      const now = Date.now();
      if (now - lastRecordedTouch < 1000) return;
      lastRecordedTouch = now;
      lastActivityAtRef.current = now;
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];
    for (const evt of events) {
      window.addEventListener(evt, bumpActivity, { passive: true });
    }

    const timer = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - lastActivityAtRef.current) / 1000);
      const remaining = autoLockMinutes * 60 - elapsedSec;
      if (remaining <= 0) {
        window.clearInterval(timer);
        void handleLockVault(t.mfa.autoLockNotice);
      } else {
        setAutoLockRemainingSec(remaining);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      for (const evt of events) {
        window.removeEventListener(evt, bumpActivity);
      }
    };
  }, [activeBundle, vaultKey, autoLockMinutes, handleLockVault, t.mfa.autoLockNotice]);

  const handleSaveMember = async (saved: DecryptedMember, isNew: boolean) => {
    if (!vaultKey || !activeBundle) return;
    setGlobalError(null);

    let updatedMembers = isNew
      ? [...members, saved]
      : members.map((m) => (m.id === saved.id ? saved : m));

    updatedMembers = updatedMembers.map((m) => {
      if (m.id === saved.id) return m;
      const shouldBeSpouse = saved.spouseIds.includes(m.id);
      const currentlyListsSaved = m.spouseIds.includes(saved.id);
      if (shouldBeSpouse && !currentlyListsSaved) {
        return {
          ...m,
          spouseIds: [...m.spouseIds, saved.id],
          updatedAt: new Date().toISOString(),
        };
      }
      if (!shouldBeSpouse && currentlyListsSaved) {
        return {
          ...m,
          spouseIds: m.spouseIds.filter((sid) => sid !== saved.id),
          updatedAt: new Date().toISOString(),
        };
      }
      return m;
    });

    const encryptedRecords = await Promise.all(
      updatedMembers.map((m) => encryptMemberRecord(vaultKey, m))
    );
    const nextBundle: EncryptedVaultBundle = {
      metadata: {
        ...activeBundle.metadata,
        updatedAt: new Date().toISOString(),
        version: activeBundle.metadata.version + 1,
      },
      records: encryptedRecords,
    };

    setMembers(updatedMembers);
    setSelectedMemberId(saved.id);
    setIsCreateMode(false);
    setCreatePreset(null);

    await persistBundle(
      nextBundle,
      `${isNew ? 'Added' : 'Updated'} encrypted record for ${saved.romanizedName} (${saved.chineseName})`
    );
  };

  const handleUpdateClanMetadata = async (
    nextHeader: Pick<
      ClanMetadata,
      | 'clanName'
      | 'clanChineseName'
      | 'hallName'
      | 'ancestralOrigin'
      | 'generationPoem'
      | 'branches'
    >
  ) => {
    if (!activeBundle) return;
    setGlobalError(null);
    const nextBundle: EncryptedVaultBundle = {
      metadata: {
        ...activeBundle.metadata,
        ...nextHeader,
        updatedAt: new Date().toISOString(),
        version: activeBundle.metadata.version + 1,
      },
      records: activeBundle.records,
    };
    await persistBundle(
      nextBundle,
      `Updated Zupu scroll metadata for ${nextHeader.clanName} (${nextHeader.clanChineseName})`
    );
  };

  const handleBatchUpdateMembers = async (
    nextMembers: DecryptedMember[],
    auditSummary: string
  ) => {
    if (!vaultKey || !activeBundle) return;
    setGlobalError(null);
    const encryptedRecords = await Promise.all(
      nextMembers.map((m) => encryptMemberRecord(vaultKey, m))
    );
    const nextBundle: EncryptedVaultBundle = {
      metadata: {
        ...activeBundle.metadata,
        updatedAt: new Date().toISOString(),
        version: activeBundle.metadata.version + 1,
      },
      records: encryptedRecords,
    };
    setMembers(nextMembers);
    if (selectedMemberId && !nextMembers.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(null);
    }
    await persistBundle(nextBundle, auditSummary);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!vaultKey || !activeBundle) return;
    const target = members.find((m) => m.id === memberId);
    const updatedMembers = members
      .filter((m) => m.id !== memberId)
      .map((m) => ({
        ...m,
        parentIds: m.parentIds.filter((pid) => pid !== memberId),
        spouseIds: m.spouseIds.filter((sid) => sid !== memberId),
      }));

    const encryptedRecords = await Promise.all(
      updatedMembers.map((m) => encryptMemberRecord(vaultKey, m))
    );
    const nextBundle: EncryptedVaultBundle = {
      metadata: {
        ...activeBundle.metadata,
        updatedAt: new Date().toISOString(),
        version: activeBundle.metadata.version + 1,
      },
      records: encryptedRecords,
    };

    setMembers(updatedMembers);
    setSelectedMemberId(null);
    await persistBundle(
      nextBundle,
      `Removed lineage record ${target?.romanizedName ?? memberId}`
    );
  };

  const handleChangeStorageMode = async (mode: StorageMode) => {
    setStorageMode(mode);
    await setStorageModePreference(mode);
    if (mode === 'hybrid_sync' && activeBundle && currentUser?.permissions.canEditLineage) {
      await persistBundle(activeBundle, 'Resumed hybrid server synchronization');
    }
  };

  const handleSyncNow = async () => {
    if (!activeBundle) return;
    await persistBundle(activeBundle, 'Manual encrypted envelope sync');
  };

  const handleRestoreBundle = async (restored: EncryptedVaultBundle) => {
    if (!vaultKey) return;
    try {
      const decrypted = await Promise.all(
        restored.records.map((env) => decryptMemberRecord(vaultKey, env))
      );
      setMembers(decrypted);
      await persistBundle(
        restored,
        `Restored encrypted archive (${decrypted.length} records)`
      );
    } catch {
      await saveLocalEncryptedVault(restored);
      setExistingBundle(restored);
      setActiveBundle(null);
      setVaultKey(null);
      setMembers([]);
    }
  };

  const handleHistoryRolledBack = async (
    restored: EncryptedVaultBundle,
    nextServerRev: number
  ) => {
    setGlobalError(null);
    await saveLocalEncryptedVault(restored);
    setHasLocalVault(true);
    setServerRevision(nextServerRev);
    setConflictState(null);
    await setPendingSyncFlag(false);
    setPendingSync(false);

    if (vaultKey) {
      try {
        const decrypted = await Promise.all(
          restored.records.map((env) => decryptMemberRecord(vaultKey, env))
        );
        setActiveBundle(restored);
        setMembers(decrypted);
        setSelectedMemberId(null);
        return;
      } catch {
        // Revision uses an earlier passphrase; drop to passphrase gate
      }
    }

    setExistingBundle(restored);
    setActiveBundle(null);
    setVaultKey(null);
    setMembers([]);
    setSelectedMemberId(null);
  };

  const handleImportMembers = async (
    imported: DecryptedMember[],
    mode: 'merge' | 'replace',
    sourceLabel: string
  ) => {
    if (!vaultKey || !activeBundle) return;
    setGlobalError(null);

    await createOfflineSnapshot(
      activeBundle,
      `Auto-backup before ${sourceLabel} (${mode})`
    ).catch(() => undefined);

    let nextMembers: DecryptedMember[];
    if (mode === 'replace') {
      nextMembers = imported;
    } else {
      const mergedMap = new Map(members.map((m) => [m.id, m]));
      for (const imp of imported) {
        mergedMap.set(imp.id, imp);
      }
      nextMembers = Array.from(mergedMap.values());
    }

    const encryptedRecords = await Promise.all(
      nextMembers.map((m) => encryptMemberRecord(vaultKey, m))
    );
    const nextBundle: EncryptedVaultBundle = {
      metadata: {
        ...activeBundle.metadata,
        updatedAt: new Date().toISOString(),
        version: activeBundle.metadata.version + 1,
      },
      records: encryptedRecords,
    };

    setMembers(nextMembers);
    await persistBundle(
      nextBundle,
      `Imported ${imported.length} records (${mode}) from ${sourceLabel}`
    );
  };

  if (booting || !authStatus) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-2xl font-semibold text-stone-900">{t.common.brand}</p>
          <p className="text-xs text-stone-500">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthGate
        authStatus={authStatus}
        hasLocalOfflineVault={hasLocalVault}
        infoNotice={lockNotice}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  if (storageMode === 'hybrid_sync' && currentUser.mustChangePassword) {
    return (
      <ForcePasswordChangeModal
        user={currentUser}
        onPasswordUpdated={(updated) => setCurrentUser(updated)}
        onSignOut={() => void handleLockVault()}
      />
    );
  }

  if (!vaultKey || !activeBundle) {
    return (
      <VaultPassphraseGate
        user={currentUser}
        storageMode={storageMode}
        existingBundle={existingBundle}
        infoNotice={lockNotice}
        onUnlocked={handleVaultUnlocked}
        onSignOut={() => void handleLockVault()}
      />
    );
  }

  const activeBranches = getBranchesFromMetadata(activeBundle.metadata);
  const selectedMember =
    selectedMemberId ? members.find((m) => m.id === selectedMemberId) ?? null : null;

  const navItems: { id: WorkspaceTab; label: string }[] = [
    { id: 'tree', label: t.nav.tree },
    { id: 'ledger', label: t.nav.ledger },
    { id: 'chronology', label: t.nav.chronology },
    { id: 'roles', label: t.nav.roles },
    { id: 'mfa', label: t.nav.mfa },
    { id: 'offline', label: t.nav.offline },
  ];

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-stone-200 px-6 py-3.5 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('tree')}
            className="font-display text-2xl font-semibold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
          >
            ZupuVault
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeTab === item.id
                    ? 'text-[#9E2A2B] border-[#9E2A2B]'
                    : 'border-transparent hover:text-stone-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void handleLockVault()}
            className="px-4 py-2 text-xs font-medium bg-[#9E2A2B] hover:bg-[#822021] text-white rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{t.common.lockVault}</span>
            {autoLockRemainingSec !== null && (
              <span className="font-mono-tabular text-[11px] text-white/85 pl-1 border-l border-white/25">
                {formatCountdown(autoLockRemainingSec)}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Nav Row */}
        <nav className="flex md:hidden items-center gap-4 overflow-x-auto pt-3 mt-3 border-t border-stone-100 text-xs font-medium text-stone-600">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 whitespace-nowrap shrink-0 ${
                activeTab === item.id ? 'text-[#9E2A2B] font-semibold' : 'text-stone-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Quiet Operational Context Ribbon + Language Switcher */}
      <div className="border-b border-stone-200/80 bg-[#F5F1E8] px-6 py-2">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
          <p>
            {t.ribbon.custodian}: <strong className="text-stone-900">{currentUser.chineseName}</strong> ({currentUser.displayName})
            {' · '}
            {t.ribbon.role}: <strong className="text-stone-900">{getRoleLabel(currentUser.role, locale)}</strong>
            {' · '}
            {t.ribbon.storage}:{' '}
            <strong className="text-stone-900">
              {storageMode === 'offline_only' ? t.ribbon.offlineOnly : t.ribbon.hybridSync}
            </strong>
            {pendingSync ? ` · ${t.ribbon.pendingSync}` : ''}
          </p>
          <div className="flex items-center gap-4">
            <span className="font-mono-tabular text-stone-500 hidden sm:inline">
              AES-256-GCM · {currentUser.mfaEnabled ? t.ribbon.mfaVerified : t.ribbon.passwordSession}
            </span>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8">
        {globalError && (
          <div
            role="alert"
            className="mb-6 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-950 flex items-center justify-between gap-4"
          >
            <span>{globalError}</span>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-amber-900 underline shrink-0"
            >
              {t.common.dismiss}
            </button>
          </div>
        )}

        {activeTab === 'tree' && (
          <LineageTreeCanvas
            metadata={activeBundle.metadata}
            members={members}
            currentUser={currentUser}
            selectedMemberId={selectedMemberId}
            onSelectMember={(id) => {
              setIsCreateMode(false);
              setCreatePreset(null);
              setSelectedMemberId(id);
            }}
            onAddNewMember={(preset) => {
              setSelectedMemberId(null);
              setCreatePreset(preset ?? null);
              setIsCreateMode(true);
            }}
            onUpdateClanMetadata={handleUpdateClanMetadata}
          />
        )}

        {activeTab === 'ledger' && (
          <ClanRegistryTable
            members={members}
            branches={activeBranches}
            currentUser={currentUser}
            onSelectMember={(id) => {
              setIsCreateMode(false);
              setCreatePreset(null);
              setSelectedMemberId(id);
            }}
            onOpenAudit={() => setAuditOpen(true)}
          />
        )}

        {activeTab === 'chronology' && (
          <ClanChronologyPanel
            metadata={activeBundle.metadata}
            members={members}
            currentUser={currentUser}
            onSelectMember={(id) => {
              setIsCreateMode(false);
              setCreatePreset(null);
              setSelectedMemberId(id);
            }}
          />
        )}

        {activeTab === 'roles' && (
          <AccessRolesPanel
            currentUser={currentUser}
            storageMode={storageMode}
            branches={activeBranches}
            onUserUpdated={setCurrentUser}
          />
        )}

        {activeTab === 'mfa' && (
          <SecurityMfaPanel
            currentUser={currentUser}
            storageMode={storageMode}
            bundle={activeBundle}
            members={members}
            autoLockMinutes={autoLockMinutes}
            onChangeAutoLockMinutes={handleChangeAutoLockMinutes}
            onUserUpdated={setCurrentUser}
            onVaultKeyRotated={async (nextBundle, nextKey) => {
              setVaultKey(nextKey);
              await persistBundle(nextBundle, 'Rotated Family AES-256-GCM Encryption Key');
            }}
          />
        )}

        {activeTab === 'offline' && (
          <OfflineVaultPanel
            currentUser={currentUser}
            storageMode={storageMode}
            pendingSync={pendingSync}
            bundle={activeBundle}
            members={members}
            onChangeStorageMode={handleChangeStorageMode}
            onSyncNow={handleSyncNow}
            onRestoreBundle={handleRestoreBundle}
            onHistoryRolledBack={handleHistoryRolledBack}
            onImportMembers={handleImportMembers}
            onRequestExportPdf={() => {
              setExportPdfBranch(currentUser.permissions.branchScope);
              setExportPdfOpen(true);
            }}
          />
        )}
      </main>

      <MemberDetailDrawer
        member={selectedMember}
        isCreateMode={isCreateMode}
        createPreset={createPreset}
        allMembers={members}
        branches={activeBranches}
        currentUser={currentUser}
        onClose={() => {
          setSelectedMemberId(null);
          setIsCreateMode(false);
          setCreatePreset(null);
        }}
        onSelectMember={(id) => {
          setIsCreateMode(false);
          setCreatePreset(null);
          setSelectedMemberId(id);
        }}
        onSaveMember={handleSaveMember}
        onDeleteMember={handleDeleteMember}
        onTriggerAddRelative={(preset) => {
          setSelectedMemberId(null);
          setCreatePreset(preset);
          setIsCreateMode(true);
        }}
      />

      {currentUser.permissions.canExportVault && (
        <ExportPdfModal
          open={exportPdfOpen}
          onClose={() => setExportPdfOpen(false)}
          metadata={activeBundle.metadata}
          members={members}
          currentUser={currentUser}
          initialBranch={exportPdfBranch}
        />
      )}

      {currentUser.permissions.canEditLineage && (
        <LineageAuditModal
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
          members={members}
          branches={activeBranches}
          onApplyMemberBatch={handleBatchUpdateMembers}
        />
      )}

      <VaultConflictModal
        open={Boolean(conflictState)}
        serverRevision={conflictState?.serverRevision}
        onClose={() => setConflictState(null)}
        onReloadServer={handleReloadServerVaultOnConflict}
        onForceOverwrite={async () => {
          if (!conflictState) return;
          await persistBundle(conflictState.bundle, conflictState.auditSummary, true);
        }}
      />
    </div>
  );
}
