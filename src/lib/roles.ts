import type { Locale } from './i18n';
import type {
  BranchDefinition,
  BranchScope,
  ClanMetadata,
  ClanRole,
  GranularPermissions,
  RecordSensitivity,
} from '../types/zupu';

export const ROLE_META: Record<
  ClanRole,
  { label: string; chinese: string; summary: string }
> = {
  patriarch: {
    label: 'Patriarch / Custodian',
    chinese: '族長',
    summary: 'Full authority over lineage records, member roles, invites, MFA policy, and clan audit logs.',
  },
  archivist: {
    label: 'Clan Archivist',
    chinese: '修譜史官',
    summary: 'Can edit all branches, view elder-sealed records, issue invites, and export encrypted archives.',
  },
  branch_elder: {
    label: 'Branch Elder',
    chinese: '房長',
    summary: 'Manages and edits records within their assigned clan branch and verifies branch relatives.',
  },
  verified_relative: {
    label: 'Verified Relative',
    chinese: '宗親成員',
    summary: 'Read-only access to approved lineage records; living PII and sealed notes controlled per-member.',
  },
  guest_scholar: {
    label: 'Guest Historian',
    chinese: '客座宗親',
    summary: 'Restricted view of public ancestral generations only; living relatives and sealed notes redacted.',
  },
};

const ROLE_LABELS_I18N: Record<Locale, Record<ClanRole, string>> = {
  'en-HK': {
    patriarch: 'Patriarch / Custodian',
    archivist: 'Clan Archivist',
    branch_elder: 'Branch Elder',
    verified_relative: 'Verified Relative',
    guest_scholar: 'Guest Historian',
  },
  'zh-HK': {
    patriarch: '族長（掌譜人）',
    archivist: '修譜史官',
    branch_elder: '房長',
    verified_relative: '已驗證宗親',
    guest_scholar: '客座宗親學者',
  },
  'zh-CN': {
    patriarch: '族长（掌谱人）',
    archivist: '修谱史官',
    branch_elder: '房长',
    verified_relative: '已验证宗亲',
    guest_scholar: '客座宗亲学者',
  },
};

export function getRoleLabel(role: ClanRole, locale: Locale): string {
  return ROLE_LABELS_I18N[locale][role];
}

export const DEFAULT_BRANCHES: BranchDefinition[] = [
  { id: 'elder_branch', label: 'Elder Branch', chinese: '長房' },
  { id: 'second_branch', label: 'Second Branch', chinese: '二房' },
  { id: 'third_branch', label: 'Third Branch', chinese: '三房' },
];

export const BRANCH_META: Record<string, { label: string; chinese: string }> = {
  all: { label: 'All Branches', chinese: '全族各房' },
  elder_branch: { label: 'Elder Branch', chinese: '長房' },
  second_branch: { label: 'Second Branch', chinese: '二房' },
  third_branch: { label: 'Third Branch', chinese: '三房' },
};

const BRANCH_LABELS_I18N: Record<Locale, Record<string, string>> = {
  'en-HK': {
    all: 'All Branches',
    elder_branch: 'Elder Branch · 長房',
    second_branch: 'Second Branch · 二房',
    third_branch: 'Third Branch · 三房',
  },
  'zh-HK': {
    all: '全族各房',
    elder_branch: '長房',
    second_branch: '二房',
    third_branch: '三房',
  },
  'zh-CN': {
    all: '全族各房',
    elder_branch: '长房',
    second_branch: '二房',
    third_branch: '三房',
  },
};

export function getBranchesFromMetadata(metadata?: ClanMetadata | null): BranchDefinition[] {
  if (metadata?.branches && metadata.branches.length > 0) {
    return metadata.branches;
  }
  return DEFAULT_BRANCHES;
}

export function slugifyBranchId(label: string, existingIds: string[]): string {
  const baseSlug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  let candidate = baseSlug.length >= 2 && baseSlug !== 'all' ? baseSlug : `branch_${existingIds.length + 1}`;
  if (!/^[a-z0-9_]{2,40}$/.test(candidate)) {
    candidate = `branch_${existingIds.length + 1}`;
  }
  let suffix = 2;
  let unique = candidate;
  const taken = new Set(['all', ...existingIds]);
  while (taken.has(unique)) {
    unique = `${candidate.slice(0, 32)}_${suffix++}`;
  }
  return unique;
}

export function getBranchLabel(
  branch: BranchScope,
  locale: Locale,
  branches?: BranchDefinition[]
): string {
  if (branch === 'all') {
    return BRANCH_LABELS_I18N[locale].all;
  }
  const custom = branches?.find((b) => b.id === branch);
  if (custom) {
    if (locale === 'en-HK') {
      return custom.chinese && custom.chinese !== custom.label
        ? `${custom.label} · ${custom.chinese}`
        : custom.label;
    }
    return custom.chinese || custom.label;
  }
  return BRANCH_LABELS_I18N[locale][branch] ?? branch;
}

export const SENSITIVITY_META: Record<
  RecordSensitivity,
  { label: string; chinese: string; toneClass: string }
> = {
  public_clan: {
    label: 'Clan Standard',
    chinese: '宗族公開',
    toneClass: 'text-stone-600',
  },
  branch_restricted: {
    label: 'Branch Restricted',
    chinese: '房內限閱',
    toneClass: 'text-[#9A3412]',
  },
  elder_sealed: {
    label: 'Elder Sealed',
    chinese: '長老密錄',
    toneClass: 'text-[#9E2A2B] font-semibold',
  },
};

const SENSITIVITY_LABELS_I18N: Record<Locale, Record<RecordSensitivity, string>> = {
  'en-HK': {
    public_clan: 'Clan Standard',
    branch_restricted: 'Branch Restricted',
    elder_sealed: 'Elder Sealed',
  },
  'zh-HK': {
    public_clan: '宗族公開',
    branch_restricted: '房內限閱',
    elder_sealed: '長老密錄',
  },
  'zh-CN': {
    public_clan: '宗族公开',
    branch_restricted: '房内限阅',
    elder_sealed: '长老密录',
  },
};

export function getSensitivityLabel(sens: RecordSensitivity, locale: Locale): string {
  return SENSITIVITY_LABELS_I18N[locale][sens];
}

export function presetPermissionsForRole(role: ClanRole): GranularPermissions {
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
