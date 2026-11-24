import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import type {
  ActiveSessionSummary,
  AuditEntry,
  ClanRole,
  EncryptedVaultBundle,
  GranularPermissions,
  InviteRecord,
  PasskeySummary,
  RecentSignInAlert,
  UserProfile,
  VaultRevisionSummary,
} from '../types/zupu';

let inMemoryAuthToken: string | null = null;

export function setInMemoryAuthToken(token: string | null): void {
  inMemoryAuthToken = token;
}

export function getInMemoryAuthToken(): string | null {
  return inMemoryAuthToken;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryAuthToken) {
    headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      mfaRequired?: boolean;
      conflict?: boolean;
      currentRevision?: number;
    };
    err.status = res.status;
    err.mfaRequired = Boolean(data?.mfaRequired);
    err.conflict = Boolean(data?.conflict);
    if (typeof data?.currentRevision === 'number') {
      err.currentRevision = data.currentRevision;
    }
    throw err;
  }
  return data as T;
}

export interface AuthStatusResponse {
  custodyClaimed: boolean;
  envPasscodeConfigured: boolean;
  hasVaultBundle: boolean;
  memberCount: number;
  hasAnyPasskey?: boolean;
}

export interface AuthSuccessResponse {
  token: string;
  mfaRequired: boolean;
  user: UserProfile;
  passkeyLabel?: string;
}

export const api = {
  getAuthStatus: () => apiFetch<AuthStatusResponse>('/api/auth/status'),

  claimCustody: (payload: {
    email: string;
    displayName: string;
    chineseName: string;
    password: string;
    adminPasscode?: string;
  }) =>
    apiFetch<AuthSuccessResponse>('/api/auth/claim-custody', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<AuthSuccessResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  registerWithInvite: (payload: {
    inviteCode: string;
    email: string;
    displayName: string;
    chineseName: string;
    password: string;
  }) =>
    apiFetch<AuthSuccessResponse>('/api/auth/register-invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => apiFetch<{ user: UserProfile; mfaVerified: boolean }>('/api/auth/me'),

  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  initMfaEnrollment: () =>
    apiFetch<{ secretBase32: string; otpauthUri: string }>('/api/auth/mfa/enroll-init', {
      method: 'POST',
    }),

  confirmMfaEnrollment: (code: string) =>
    apiFetch<{ token?: string; user: UserProfile; recoveryCodes: string[] }>('/api/auth/mfa/enroll-confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  verifyMfaChallenge: (payload: { code?: string; recoveryCode?: string }) =>
    apiFetch<AuthSuccessResponse>('/api/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  disableMfa: (payload: { currentPassword: string; code?: string }) =>
    apiFetch<{ user: UserProfile }>('/api/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  rotatePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ ok: boolean; token?: string; user?: UserProfile }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getPasskeyRegisterOptions: (label?: string) =>
    apiFetch<{ options: PublicKeyCredentialCreationOptionsJSON }>(
      '/api/auth/passkeys/register-options',
      {
        method: 'POST',
        body: JSON.stringify({ label }),
      }
    ),

  verifyPasskeyRegister: (response: RegistrationResponseJSON, label?: string) =>
    apiFetch<{ passkey: PasskeySummary; user: UserProfile }>(
      '/api/auth/passkeys/register-verify',
      {
        method: 'POST',
        body: JSON.stringify({ response, label }),
      }
    ),

  renamePasskey: (passkeyId: string, label: string) =>
    apiFetch<{ user: UserProfile }>(`/api/auth/passkeys/${encodeURIComponent(passkeyId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),

  deletePasskey: (passkeyId: string) =>
    apiFetch<{ user: UserProfile }>(`/api/auth/passkeys/${encodeURIComponent(passkeyId)}`, {
      method: 'DELETE',
    }),

  getPasskeyLoginOptions: (email?: string) =>
    apiFetch<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
      '/api/auth/passkeys/login-options',
      {
        method: 'POST',
        body: JSON.stringify({ email: email?.trim() || undefined }),
      }
    ),

  verifyPasskeyLogin: (challengeId: string, response: AuthenticationResponseJSON) =>
    apiFetch<AuthSuccessResponse>('/api/auth/passkeys/login-verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId, response }),
    }),

  getVault: () =>
    apiFetch<{
      bundle: EncryptedVaultBundle | null;
      totalServerRecords?: number;
      serverRevision?: number;
    }>('/api/vault'),

  syncVault: (
    bundle: EncryptedVaultBundle,
    auditSummary: string,
    options?: { expectedRevision?: number; forceOverwrite?: boolean }
  ) =>
    apiFetch<{ ok: boolean; recordCount: number; serverRevision: number }>('/api/vault', {
      method: 'PUT',
      body: JSON.stringify({
        bundle,
        auditSummary,
        expectedRevision: options?.expectedRevision,
        forceOverwrite: options?.forceOverwrite,
      }),
    }),

  getMembersAndInvites: () =>
    apiFetch<{ members: UserProfile[]; invites: InviteRecord[] }>('/api/members'),

  updateMemberAccess: (
    userId: string,
    payload: {
      displayName?: string;
      chineseName?: string;
      email?: string;
      role?: ClanRole;
      status?: 'active' | 'suspended';
      permissions?: GranularPermissions;
    }
  ) =>
    apiFetch<{ member: UserProfile }>(`/api/members/${encodeURIComponent(userId)}/access`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  resetMemberPassword: (userId: string, newPassword: string) =>
    apiFetch<{ ok: boolean; member: UserProfile; token?: string }>(
      `/api/members/${encodeURIComponent(userId)}/reset-password`,
      {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }
    ),

  resetMemberMfa: (userId: string) =>
    apiFetch<{ ok: boolean; member: UserProfile; token?: string }>(
      `/api/members/${encodeURIComponent(userId)}/reset-mfa`,
      {
        method: 'POST',
      }
    ),

  resetMemberPasskeys: (userId: string) =>
    apiFetch<{ ok: boolean; member: UserProfile; token?: string }>(
      `/api/members/${encodeURIComponent(userId)}/reset-passkeys`,
      {
        method: 'POST',
      }
    ),

  createInvite: (payload: {
    inviteeName: string;
    inviteeChineseName: string;
    inviteeEmail?: string;
    role: ClanRole;
    permissions: GranularPermissions;
  }) =>
    apiFetch<{ rawCode: string; invite: InviteRecord }>('/api/invites', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revokeInvite: (inviteId: string) =>
    apiFetch<{ ok: boolean }>(`/api/invites/${encodeURIComponent(inviteId)}`, {
      method: 'DELETE',
    }),

  getAuditLogs: () => apiFetch<{ logs: AuditEntry[] }>('/api/audit'),

  getSessions: () =>
    apiFetch<{ sessions: ActiveSessionSummary[]; signInAlerts: RecentSignInAlert[] }>(
      '/api/auth/sessions'
    ),

  revokeOtherSessions: () =>
    apiFetch<{
      ok: boolean;
      token: string;
      user: UserProfile;
      sessions: ActiveSessionSummary[];
      revokedCount: number;
    }>('/api/auth/sessions/revoke-others', {
      method: 'POST',
    }),

  revokeSession: (sid: string) =>
    apiFetch<{ ok: boolean; sessions: ActiveSessionSummary[] }>(
      `/api/auth/sessions/${encodeURIComponent(sid)}`,
      {
        method: 'DELETE',
      }
    ),

  getVaultHistory: () =>
    apiFetch<{ history: VaultRevisionSummary[] }>('/api/vault/history'),

  restoreVaultRevision: (revision: number) =>
    apiFetch<{ ok: boolean; bundle: EncryptedVaultBundle; serverRevision: number }>(
      `/api/vault/history/${encodeURIComponent(String(revision))}/restore`,
      {
        method: 'POST',
      }
    ),

  transferPatriarchCustody: (payload: {
    targetUserId: string;
    currentPassword: string;
    totpCode?: string;
  }) =>
    apiFetch<{ ok: boolean; currentUser: UserProfile; targetUser: UserProfile }>(
      '/api/custody/transfer',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
};
