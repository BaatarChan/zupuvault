import fs from 'fs';
import path from 'path';
import type {
  AuditEntry,
  ClanRole,
  EncryptedVaultBundle,
  GranularPermissions,
  PasskeySummary,
  UserProfile,
} from '../src/types/zupu.ts';

export interface StoredPasskey {
  id: string;
  publicKeyB64u: string;
  counter: number;
  transports?: string[];
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface StoredUser extends UserProfile {
  passwordSaltHex: string;
  passwordHashHex: string;
  mfaSecretSealed?: { ivHex: string; tagHex: string; dataHex: string };
  pendingMfaSecretSealed?: { ivHex: string; tagHex: string; dataHex: string };
  recoveryCodeHashes: string[]; // SHA-256 hex of normalized recovery codes
  passkeys?: StoredPasskey[];
  sessionVersion?: number;
}

export interface StoredInvite {
  id: string;
  codeHash: string;
  codeHint: string;
  inviteeName: string;
  inviteeChineseName: string;
  inviteeEmail: string;
  role: ClanRole;
  permissions: GranularPermissions;
  createdById: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface RevokedSessionEntry {
  sid: string;
  exp: number;
}

export interface PersistentStoreSchema {
  custodyClaimed: boolean;
  users: StoredUser[];
  invites: StoredInvite[];
  vaultBundle: EncryptedVaultBundle | null;
  vaultRevision?: number;
  auditLogs: AuditEntry[];
  revokedSessions: RevokedSessionEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'zupu-vault-store.json');

// Verify strict path confinement inside DATA_DIR
if (!STORE_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid store path boundary');
}

const DEFAULT_STORE: PersistentStoreSchema = {
  custodyClaimed: false,
  users: [],
  invites: [],
  vaultBundle: null,
  vaultRevision: 0,
  auditLogs: [],
  revokedSessions: [],
};

export function readStore(): PersistentStoreSchema {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return structuredClone(DEFAULT_STORE);
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistentStoreSchema>;
    const now = Date.now();
    const rawRevoked = Array.isArray(parsed.revokedSessions) ? parsed.revokedSessions : [];
    const vaultBundle = parsed.vaultBundle ?? null;
    const inferredRevision =
      typeof parsed.vaultRevision === 'number' && Number.isInteger(parsed.vaultRevision)
        ? parsed.vaultRevision
        : vaultBundle
          ? Math.max(1, vaultBundle.metadata?.version || 1)
          : 0;
    return {
      custodyClaimed: Boolean(parsed.custodyClaimed),
      users: Array.isArray(parsed.users) ? parsed.users : [],
      invites: Array.isArray(parsed.invites) ? parsed.invites : [],
      vaultBundle,
      vaultRevision: inferredRevision,
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      revokedSessions: rawRevoked.filter(
        (r) => r && typeof r.sid === 'string' && typeof r.exp === 'number' && r.exp > now
      ),
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

export function writeStore(nextStore: PersistentStoreSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const now = Date.now();
  const pruned: PersistentStoreSchema = {
    ...nextStore,
    revokedSessions: (nextStore.revokedSessions ?? [])
      .filter((r) => r && typeof r.sid === 'string' && typeof r.exp === 'number' && r.exp > now)
      .slice(-500),
  };
  const tmpPath = path.resolve(DATA_DIR, `zupu-vault-store.${process.pid}.tmp`);
  if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temporary store path');
  }
  fs.writeFileSync(tmpPath, JSON.stringify(pruned, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, STORE_PATH);
}

export function sanitizePasskeys(passkeys?: StoredPasskey[]): PasskeySummary[] {
  if (!Array.isArray(passkeys)) return [];
  return passkeys.map((pk) => ({
    id: pk.id,
    label: pk.label,
    deviceType: pk.deviceType,
    backedUp: Boolean(pk.backedUp),
    transports: pk.transports,
    createdAt: pk.createdAt,
    lastUsedAt: pk.lastUsedAt,
  }));
}

export function sanitizeUser(user: StoredUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    chineseName: user.chineseName,
    role: user.role,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    mustChangePassword: Boolean(user.mustChangePassword),
    passkeys: sanitizePasskeys(user.passkeys),
    permissions: user.permissions,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
  };
}

export function defaultPermissionsForRole(role: ClanRole): GranularPermissions {
  switch (role) {
    case 'patriarch':
      return {
        canViewLivingPII: true,
        canViewElderSealed: true,
        canEditLineage: true,
        canExportVault: true,
        canInviteRelatives: true,
        canManageRoles: true,
        branchScope: 'all',
        maxGenerationDepth: 0,
      };
    case 'archivist':
      return {
        canViewLivingPII: true,
        canViewElderSealed: true,
        canEditLineage: true,
        canExportVault: true,
        canInviteRelatives: true,
        canManageRoles: false,
        branchScope: 'all',
        maxGenerationDepth: 0,
      };
    case 'branch_elder':
      return {
        canViewLivingPII: true,
        canViewElderSealed: false,
        canEditLineage: true,
        canExportVault: false,
        canInviteRelatives: true,
        canManageRoles: false,
        branchScope: 'elder_branch',
        maxGenerationDepth: 0,
      };
    case 'verified_relative':
      return {
        canViewLivingPII: false,
        canViewElderSealed: false,
        canEditLineage: false,
        canExportVault: false,
        canInviteRelatives: false,
        canManageRoles: false,
        branchScope: 'all',
        maxGenerationDepth: 0,
      };
    case 'guest_scholar':
    default:
      return {
        canViewLivingPII: false,
        canViewElderSealed: false,
        canEditLineage: false,
        canExportVault: false,
        canInviteRelatives: false,
        canManageRoles: false,
        branchScope: 'all',
        maxGenerationDepth: 3,
      };
  }
}
