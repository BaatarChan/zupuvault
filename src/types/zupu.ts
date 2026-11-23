export type ClanRole =
  | 'patriarch'
  | 'archivist'
  | 'branch_elder'
  | 'verified_relative'
  | 'guest_scholar';

export type BranchScope = string;

export interface BranchDefinition {
  id: string;
  label: string;
  chinese: string;
}

export type RecordSensitivity = 'public_clan' | 'branch_restricted' | 'elder_sealed';

export type StorageMode = 'hybrid_sync' | 'offline_only';

export interface GranularPermissions {
  canViewLivingPII: boolean;
  canViewElderSealed: boolean;
  canEditLineage: boolean;
  canExportVault: boolean;
  canInviteRelatives: boolean;
  canManageRoles: boolean;
  branchScope: BranchScope;
  maxGenerationDepth: number; // 0 means unlimited
}

export interface PasskeySummary {
  id: string;
  label: string;
  deviceType: 'singleDevice' | 'multiDevice';
  backedUp: boolean;
  transports?: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  chineseName: string;
  role: ClanRole;
  status: 'active' | 'suspended';
  mfaEnabled: boolean;
  mustChangePassword?: boolean;
  passkeys?: PasskeySummary[];
  permissions: GranularPermissions;
  createdAt: string;
  lastActiveAt: string;
}

export interface InviteRecord {
  id: string;
  codeHint: string; // e.g. ZUPU-8F2A-••••
  inviteeName: string;
  inviteeChineseName: string;
  inviteeEmail: string;
  role: ClanRole;
  permissions: GranularPermissions;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: ClanRole;
  action: string;
  target: string;
  detail: string;
}

export interface EncryptedBlob {
  ivB64: string;
  ciphertextB64: string;
}

export interface ClanMetadata {
  clanName: string; // e.g. "Yingchuan Chen Clan"
  clanChineseName: string; // e.g. "潁川陳氏宗譜"
  hallName: string; // 堂號 e.g. "德星堂 · Hall of Virtuous Stars"
  ancestralOrigin: string; // 郡望/祖籍
  generationPoem: string[]; // 字輩詩 e.g. ['德','星','啟','瑞','禮','義','傳','家']
  branches?: BranchDefinition[]; // Custom & standard clan branches (房別)
  keySaltB64: string;
  kdfIterations: number;
  keyFingerprint: string;
  verifierBlob: EncryptedBlob; // Encrypts "ZUPU_VAULT_VERIFIED_V1" to validate passphrase locally
  updatedAt: string;
  version: number;
}

export interface SensitiveMemberPayload {
  chineseName: string;
  romanizedName: string;
  courtesyName?: string; // 字
  artName?: string; // 號
  gender: 'male' | 'female';
  birthOrder?: string; // 排行 e.g. 長子, 次女
  isLiving: boolean;
  birthYear?: string;
  birthLunar?: string;
  deathYear?: string;
  deathLunar?: string;
  birthplace?: string;
  currentResidence?: string; // Living PII
  occupationOrTitle?: string;
  biography: string;
  sealedTestament?: string; // Visible only if canViewElderSealed
  portraitDataUrl?: string; // Compressed JPEG Data URL encrypted inside AES-256-GCM payload
}

export interface EncryptedMemberEnvelope {
  id: string;
  generation: number;
  branch: string;
  sensitivity: RecordSensitivity;
  parentIds: string[];
  spouseIds: string[];
  encryptedPayload: EncryptedBlob;
  updatedAt: string;
}

export interface DecryptedMember extends SensitiveMemberPayload {
  id: string;
  generation: number;
  branch: string;
  sensitivity: RecordSensitivity;
  parentIds: string[];
  spouseIds: string[];
  updatedAt: string;
}

export interface EncryptedVaultBundle {
  metadata: ClanMetadata;
  records: EncryptedMemberEnvelope[];
}

export interface PortableZupuArchive {
  format: 'ZUPU_VAULT_ARCHIVE_V1';
  exportedAt: string;
  exportedBy: string;
  sha256Checksum: string;
  bundle: EncryptedVaultBundle;
}

export interface OfflineSnapshot {
  id: string;
  createdAt: string;
  label: string;
  recordCount: number;
  keyFingerprint: string;
  sha256Checksum: string;
  bundle: EncryptedVaultBundle;
}
