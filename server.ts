import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {
  buildOtpAuthUri,
  constantTimeCompareStrings,
  generateRecoveryCodes,
  generateTotpSecret,
  hashPassword,
  sealServerSecret,
  sha256Hex,
  signSessionToken,
  unsealServerSecret,
  verifyPassword,
  verifySessionToken,
  verifyTotpCode,
} from './server/crypto.ts';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  defaultPermissionsForRole,
  readStore,
  sanitizePasskeys,
  sanitizeUser,
  writeStore,
  type PersistentStoreSchema,
  type StoredInvite,
  type StoredPasskey,
  type StoredUser,
} from './server/store.ts';
import type {
  AuditEntry,
  BranchScope,
  ClanRole,
  EncryptedVaultBundle,
  GranularPermissions,
} from './src/types/zupu.ts';

function parseCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  const prefixed = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : undefined;
}

const DEFAULT_PORT = 3000;
const cliPort = Number(parseCliArg('--port'));
const envPort = Number(process.env.PORT);
const PORT =
  Number.isInteger(cliPort) && cliPort > 0 && cliPort <= 65535
    ? cliPort
    : Number.isInteger(envPort) && envPort > 0 && envPort <= 65535
      ? envPort
      : DEFAULT_PORT;
const HOST = parseCliArg('--host')?.trim() || process.env.HOST?.trim() || '0.0.0.0';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const VALID_ROLES: ClanRole[] = [
  'patriarch',
  'archivist',
  'branch_elder',
  'verified_relative',
  'guest_scholar',
];

function isValidBranchId(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    val !== 'all' &&
    /^[a-z0-9_]{2,40}$/.test(val)
  );
}

function isValidBranchScope(val: unknown): val is BranchScope {
  return val === 'all' || isValidBranchId(val);
}

interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
  authSessionId?: string;
  authSessionExp?: number;
  authMfaVerified?: boolean;
}

// Application-level auth brute-force rate limiter (defense-in-depth alongside Nginx limit_req)
function createAuthRateLimiter(windowMs: number, maxAttempts: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    // Periodically prune expired buckets
    if (buckets.size > 1000) {
      for (const [k, v] of buckets.entries()) {
        if (now > v.resetAt) buckets.delete(k);
      }
    }
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${clientIp}`;
    const existing = buckets.get(key);
    if (!existing || now > existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (existing.count >= maxAttempts) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Too many authentication attempts. Please wait ${retryAfterSec} seconds and try again.`,
      });
      return;
    }
    existing.count += 1;
    next();
  };
}

function getEnvAdminPasscode(): string {
  return (process.env.FAMILY_ADMIN_PASSCODE || '').trim();
}

function isValidEmail(val: unknown): val is string {
  return (
    typeof val === 'string' &&
    val.length >= 3 &&
    val.length <= 120 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
  );
}

function isValidText(val: unknown, min = 1, max = 120): val is string {
  return typeof val === 'string' && val.trim().length >= min && val.trim().length <= max;
}

function isValidRole(val: unknown): val is ClanRole {
  return typeof val === 'string' && (VALID_ROLES as string[]).includes(val);
}

function sanitizePermissionsInput(
  raw: unknown,
  fallbackRole: ClanRole
): GranularPermissions {
  const base = defaultPermissionsForRole(fallbackRole);
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const branchScope = isValidBranchScope(obj.branchScope)
    ? obj.branchScope
    : base.branchScope;
  const maxGen =
    typeof obj.maxGenerationDepth === 'number' &&
    Number.isInteger(obj.maxGenerationDepth) &&
    obj.maxGenerationDepth >= 0 &&
    obj.maxGenerationDepth <= 30
      ? obj.maxGenerationDepth
      : base.maxGenerationDepth;

  return {
    canViewLivingPII:
      typeof obj.canViewLivingPII === 'boolean' ? obj.canViewLivingPII : base.canViewLivingPII,
    canViewElderSealed:
      typeof obj.canViewElderSealed === 'boolean'
        ? obj.canViewElderSealed
        : base.canViewElderSealed,
    canEditLineage:
      typeof obj.canEditLineage === 'boolean' ? obj.canEditLineage : base.canEditLineage,
    canExportVault:
      typeof obj.canExportVault === 'boolean' ? obj.canExportVault : base.canExportVault,
    canInviteRelatives:
      typeof obj.canInviteRelatives === 'boolean'
        ? obj.canInviteRelatives
        : base.canInviteRelatives,
    canManageRoles:
      typeof obj.canManageRoles === 'boolean' ? obj.canManageRoles : base.canManageRoles,
    branchScope,
    maxGenerationDepth: maxGen,
  };
}

function appendAudit(
  store: PersistentStoreSchema,
  actor: Pick<StoredUser, 'id' | 'displayName' | 'role'>,
  action: string,
  target: string,
  detail: string
): void {
  const entry: AuditEntry = {
    id: `aud_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.displayName,
    actorRole: actor.role,
    action,
    target,
    detail,
  };
  store.auditLogs.unshift(entry);
  if (store.auditLogs.length > 250) {
    store.auditLogs = store.auditLogs.slice(0, 250);
  }
}

function isValidVaultBundle(raw: unknown): raw is EncryptedVaultBundle {
  if (!raw || typeof raw !== 'object') return false;
  const b = raw as EncryptedVaultBundle;
  if (!b.metadata || typeof b.metadata !== 'object') return false;
  if (!isValidText(b.metadata.clanName, 1, 120)) return false;
  if (!isValidText(b.metadata.clanChineseName, 1, 80)) return false;
  if (!isValidText(b.metadata.keySaltB64, 8, 128)) return false;
  if (!b.metadata.verifierBlob || typeof b.metadata.verifierBlob.ciphertextB64 !== 'string') {
    return false;
  }
  if (b.metadata.branches !== undefined) {
    if (!Array.isArray(b.metadata.branches) || b.metadata.branches.length > 24) return false;
    for (const br of b.metadata.branches) {
      if (!br || typeof br !== 'object') return false;
      if (!isValidBranchId(br.id)) return false;
      if (!isValidText(br.label, 1, 80) || !isValidText(br.chinese, 1, 40)) return false;
    }
  }
  if (!Array.isArray(b.records) || b.records.length > 1000) return false;
  for (const r of b.records) {
    if (!r || typeof r !== 'object') return false;
    if (!isValidText(r.id, 1, 64)) return false;
    if (typeof r.generation !== 'number' || r.generation < 1 || r.generation > 50) return false;
    if (!isValidBranchId(r.branch)) return false;
    if (!['public_clan', 'branch_restricted', 'elder_sealed'].includes(r.sensitivity)) return false;
    if (!r.encryptedPayload || typeof r.encryptedPayload.ivB64 !== 'string') return false;
    if (typeof r.encryptedPayload.ciphertextB64 !== 'string') return false;
  }
  return true;
}

function createSessionForUser(
  user: StoredUser,
  mfaVerified: boolean
): { token: string; sid: string; exp: number } {
  const sid = crypto.randomUUID();
  const exp = Date.now() + SESSION_TTL_MS;
  const sv = user.sessionVersion ?? 1;
  const token = signSessionToken({
    sid,
    uid: user.id,
    mfa: mfaVerified,
    sv,
    exp,
  });
  return { token, sid, exp };
}

function requireAuth(
  options: { allowPendingMfa?: boolean; allowPasswordChangePending?: boolean } = {}
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const token = authHeader.slice(7).trim();
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }

    const store = readStore();
    if (store.revokedSessions.some((r) => r.sid === payload.sid)) {
      res.status(401).json({ error: 'Session expired or revoked' });
      return;
    }

    const user = store.users.find((u) => u.id === payload.uid);
    if (!user || user.status !== 'active') {
      res.status(403).json({ error: 'Account is suspended or missing' });
      return;
    }

    const currentSv = user.sessionVersion ?? 1;
    if (payload.sv !== currentSv) {
      res.status(401).json({ error: 'Session expired or revoked' });
      return;
    }

    if (!options.allowPendingMfa && user.mfaEnabled && !payload.mfa) {
      res.status(403).json({
        error: 'Multi-factor authentication verification required',
        mfaRequired: true,
      });
      return;
    }

    if (!options.allowPasswordChangePending && user.mustChangePassword) {
      res.status(403).json({
        error: 'Temporary password update required before accessing family records',
        passwordChangeRequired: true,
      });
      return;
    }

    req.authUser = user;
    req.authSessionId = payload.sid;
    req.authSessionExp = payload.exp;
    req.authMfaVerified = payload.mfa;
    next();
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '6mb' }));

  const strictAuthLimiter = createAuthRateLimiter(15 * 60 * 1000, 20);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    next();
  });

  // --- Search Engine Blocking & Uptime Health Check ---
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  app.get('/api/health', (_req, res) => {
    const store = readStore();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      service: 'zupuvault',
      timestamp: new Date().toISOString(),
      custodyClaimed: store.custodyClaimed && store.users.length > 0,
      hasVaultBundle: Boolean(store.vaultBundle),
      vaultRevision: store.vaultRevision ?? 0,
    });
  });

  // --- WebAuthn Passkey Context & Single-Use Challenge Stores ---
  const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
  const pendingRegChallenges = new Map<
    string,
    { challenge: string; rpID: string; expectedOrigin: string; label: string; expiresAt: number }
  >();
  const pendingAuthChallenges = new Map<
    string,
    { challenge: string; rpID: string; expectedOrigin: string; expiresAt: number }
  >();

  function pruneExpiredWebAuthnChallenges() {
    const now = Date.now();
    if (pendingRegChallenges.size > 200) {
      for (const [k, v] of pendingRegChallenges.entries()) {
        if (now > v.expiresAt) pendingRegChallenges.delete(k);
      }
    }
    if (pendingAuthChallenges.size > 200) {
      for (const [k, v] of pendingAuthChallenges.entries()) {
        if (now > v.expiresAt) pendingAuthChallenges.delete(k);
      }
    }
  }

  function resolveWebAuthnContext(
    req: Request
  ): { rpID: string; expectedOrigin: string } | null {
    const rawOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    const forwardedHost = (req.get('x-forwarded-host') || req.get('host') || '')
      .split(',')[0]
      .trim();
    const requestHostname = forwardedHost.split(':')[0].toLowerCase();

    let expectedOrigin = '';
    let originHostname = '';

    if (rawOrigin) {
      try {
        const parsed = new URL(rawOrigin);
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (parsed.protocol !== 'https:' && !(isLocal && parsed.protocol === 'http:')) {
          return null;
        }
        originHostname = parsed.hostname.toLowerCase();
        if (requestHostname && originHostname !== requestHostname) {
          return null;
        }
        expectedOrigin = parsed.origin;
      } catch {
        return null;
      }
    } else if (forwardedHost) {
      const proto =
        req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      const isLocal = requestHostname === 'localhost' || requestHostname === '127.0.0.1';
      if (proto !== 'https' && !isLocal) return null;
      expectedOrigin = `${proto}://${forwardedHost}`;
      originHostname = requestHostname;
    } else {
      return null;
    }

    const envRpId = (process.env.WEBAUTHN_RP_ID || '').trim().toLowerCase();
    const rpID = envRpId || originHostname;
    if (envRpId && originHostname !== envRpId && !originHostname.endsWith(`.${envRpId}`)) {
      return null;
    }

    const envOrigins = (process.env.WEBAUTHN_ORIGIN || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (envOrigins.length > 0 && !envOrigins.includes(expectedOrigin)) {
      return null;
    }

    return { rpID, expectedOrigin };
  }

  // --- Auth Status & First-Run Custody Bootstrap ---
  app.get('/api/auth/status', (_req, res) => {
    const store = readStore();
    const envPasscodeConfigured = getEnvAdminPasscode().length > 0;
    const passkeyCount = store.users.reduce((sum, u) => sum + (u.passkeys?.length ?? 0), 0);
    res.json({
      custodyClaimed: store.custodyClaimed && store.users.length > 0,
      envPasscodeConfigured,
      hasVaultBundle: Boolean(store.vaultBundle),
      memberCount: store.users.length,
      hasAnyPasskey: passkeyCount > 0,
    });
  });

  app.post('/api/auth/claim-custody', strictAuthLimiter, (req, res) => {
    const store = readStore();
    if (store.custodyClaimed && store.users.length > 0) {
      res.status(403).json({ error: 'Family custody has already been claimed' });
      return;
    }

    const { email, displayName, chineseName, password, adminPasscode } = req.body ?? {};
    const envPasscode = getEnvAdminPasscode();
    if (envPasscode.length > 0) {
      if (typeof adminPasscode !== 'string' || !constantTimeCompareStrings(adminPasscode, envPasscode)) {
        res.status(403).json({ error: 'Invalid configured FAMILY_ADMIN_PASSCODE' });
        return;
      }
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address' });
      return;
    }
    if (!isValidText(displayName, 2, 80)) {
      res.status(400).json({ error: 'Display name must be between 2 and 80 characters' });
      return;
    }
    if (!isValidText(chineseName, 1, 40)) {
      res.status(400).json({ error: 'Chinese lineage name is required' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Custodian password must be at least 8 characters' });
      return;
    }

    const { saltHex, hashHex } = hashPassword(password);
    const now = new Date().toISOString();
    const patriarch: StoredUser = {
      id: `usr_${crypto.randomUUID()}`,
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      chineseName: chineseName.trim(),
      role: 'patriarch',
      status: 'active',
      mfaEnabled: false,
      mustChangePassword: false,
      sessionVersion: 1,
      permissions: defaultPermissionsForRole('patriarch'),
      createdAt: now,
      lastActiveAt: now,
      passwordSaltHex: saltHex,
      passwordHashHex: hashHex,
      recoveryCodeHashes: [],
    };

    store.custodyClaimed = true;
    store.users = [patriarch];
    appendAudit(
      store,
      patriarch,
      'CUSTODY_CLAIMED',
      patriarch.email,
      'Initial Clan Custodian claimed sovereign family archive custody'
    );
    writeStore(store);

    const { token } = createSessionForUser(patriarch, true);
    res.status(201).json({
      token,
      mfaRequired: false,
      user: sanitizeUser(patriarch),
    });
  });

  app.post('/api/auth/login', strictAuthLimiter, (req, res) => {
    const { email, password } = req.body ?? {};
    if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const store = readStore();
    const normalizedEmail = email.trim().toLowerCase();
    const user = store.users.find((u) => u.email === normalizedEmail);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    if (user.status !== 'active') {
      res.status(403).json({ error: 'Your family access has been suspended by a Custodian' });
      return;
    }

    const envPasscode = getEnvAdminPasscode();
    const matchesEnvOverride =
      user.role === 'patriarch' &&
      envPasscode.length > 0 &&
      constantTimeCompareStrings(password, envPasscode);

    const validPassword =
      matchesEnvOverride || verifyPassword(password, user.passwordSaltHex, user.passwordHashHex);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    user.lastActiveAt = new Date().toISOString();
    appendAudit(
      store,
      user,
      'MEMBER_SIGN_IN',
      user.email,
      user.mfaEnabled ? 'Password verified; awaiting TOTP MFA challenge' : 'Authenticated into family node'
    );
    writeStore(store);

    const { token } = createSessionForUser(user, !user.mfaEnabled);
    res.json({
      token,
      mfaRequired: user.mfaEnabled,
      user: sanitizeUser(user),
    });
  });

  app.post('/api/auth/register-invite', strictAuthLimiter, (req, res) => {
    const { inviteCode, email, displayName, chineseName, password } = req.body ?? {};
    if (!isValidText(inviteCode, 6, 40)) {
      res.status(400).json({ error: 'Valid family invite code is required' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Valid email address is required' });
      return;
    }
    if (!isValidText(displayName, 2, 80) || !isValidText(chineseName, 1, 40)) {
      res.status(400).json({ error: 'English and Chinese names are required' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const store = readStore();
    const normalizedEmail = email.trim().toLowerCase();
    if (store.users.some((u) => u.email === normalizedEmail)) {
      res.status(409).json({ error: 'A family member with this email is already registered' });
      return;
    }

    const codeHash = sha256Hex(inviteCode.trim().toUpperCase());
    const invite = store.invites.find((inv) => inv.codeHash === codeHash);
    if (!invite || invite.usedAt) {
      res.status(403).json({ error: 'Invite code is invalid or has already been redeemed' });
      return;
    }
    if (Date.now() > new Date(invite.expiresAt).getTime()) {
      res.status(403).json({ error: 'Invite code has expired' });
      return;
    }
    if (invite.inviteeEmail && invite.inviteeEmail !== normalizedEmail) {
      res.status(403).json({ error: 'Invite code is bound to a different relative email' });
      return;
    }

    const { saltHex, hashHex } = hashPassword(password);
    const now = new Date().toISOString();
    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID()}`,
      email: normalizedEmail,
      displayName: displayName.trim(),
      chineseName: chineseName.trim(),
      role: invite.role,
      status: 'active',
      mfaEnabled: false,
      mustChangePassword: false,
      sessionVersion: 1,
      permissions: invite.permissions,
      createdAt: now,
      lastActiveAt: now,
      passwordSaltHex: saltHex,
      passwordHashHex: hashHex,
      recoveryCodeHashes: [],
    };

    invite.usedAt = now;
    store.users.push(newUser);
    appendAudit(
      store,
      newUser,
      'RELATIVE_VERIFIED',
      newUser.email,
      `Verified relative joined with role ${newUser.role} via invite ${invite.codeHint}`
    );
    writeStore(store);

    const { token } = createSessionForUser(newUser, true);
    res.status(201).json({
      token,
      mfaRequired: false,
      user: sanitizeUser(newUser),
    });
  });

  app.get(
    '/api/auth/me',
    requireAuth({ allowPendingMfa: true, allowPasswordChangePending: true }),
    (req: AuthenticatedRequest, res) => {
      res.json({
        user: sanitizeUser(req.authUser!),
        mfaVerified: Boolean(req.authMfaVerified),
      });
    }
  );

  app.post(
    '/api/auth/logout',
    requireAuth({ allowPendingMfa: true, allowPasswordChangePending: true }),
    (req: AuthenticatedRequest, res) => {
      if (req.authSessionId && req.authSessionExp) {
        const store = readStore();
        store.revokedSessions.push({
          sid: req.authSessionId,
          exp: req.authSessionExp,
        });
        writeStore(store);
      }
      res.json({ ok: true });
    }
  );

  // --- MFA (TOTP RFC 6238 + Recovery Codes) ---
  app.post('/api/auth/mfa/enroll-init', requireAuth(), (req: AuthenticatedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const secretBase32 = generateTotpSecret();
    user.pendingMfaSecretSealed = sealServerSecret(secretBase32);
    writeStore(store);

    res.json({
      secretBase32,
      otpauthUri: buildOtpAuthUri(user.email, secretBase32),
    });
  });

  app.post('/api/auth/mfa/enroll-confirm', requireAuth(), (req: AuthenticatedRequest, res) => {
    const { code } = req.body ?? {};
    if (typeof code !== 'string') {
      res.status(400).json({ error: '6-digit verification code is required' });
      return;
    }

    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user || !user.pendingMfaSecretSealed) {
      res.status(400).json({ error: 'No pending MFA enrollment found' });
      return;
    }

    const secret = unsealServerSecret(user.pendingMfaSecretSealed);
    if (!secret || !verifyTotpCode(secret, code)) {
      res.status(400).json({ error: 'Invalid 6-digit authenticator code' });
      return;
    }

    const recoveryCodes = generateRecoveryCodes();
    user.mfaSecretSealed = user.pendingMfaSecretSealed;
    delete user.pendingMfaSecretSealed;
    user.mfaEnabled = true;
    user.recoveryCodeHashes = recoveryCodes.map((c) => sha256Hex(`${user.id}:${c}`));

    if (req.authSessionId && req.authSessionExp) {
      store.revokedSessions.push({ sid: req.authSessionId, exp: req.authSessionExp });
    }
    const { token } = createSessionForUser(user, true);

    appendAudit(
      store,
      user,
      'MFA_ENROLLED',
      user.email,
      'Enabled RFC 6238 TOTP Multi-Factor Authentication'
    );
    writeStore(store);

    res.json({
      token,
      user: sanitizeUser(user),
      recoveryCodes,
    });
  });

  app.post(
    '/api/auth/mfa/verify',
    strictAuthLimiter,
    requireAuth({ allowPendingMfa: true, allowPasswordChangePending: true }),
    (req: AuthenticatedRequest, res) => {
      const { code, recoveryCode } = req.body ?? {};
      const store = readStore();
      const user = store.users.find((u) => u.id === req.authUser!.id);
      if (!user || !user.mfaEnabled) {
        res.status(400).json({ error: 'MFA is not enabled on this account' });
        return;
      }

      let verified = false;
      if (typeof code === 'string' && user.mfaSecretSealed) {
        const secret = unsealServerSecret(user.mfaSecretSealed);
        if (secret && verifyTotpCode(secret, code)) {
          verified = true;
        }
      } else if (typeof recoveryCode === 'string') {
        const normalized = recoveryCode.trim().toUpperCase();
        const candidateHash = sha256Hex(`${user.id}:${normalized}`);
        const idx = user.recoveryCodeHashes.indexOf(candidateHash);
        if (idx !== -1) {
          user.recoveryCodeHashes.splice(idx, 1);
          verified = true;
        }
      }

      if (!verified) {
        res.status(401).json({ error: 'Invalid authenticator or recovery code' });
        return;
      }

      if (req.authSessionId && req.authSessionExp) {
        store.revokedSessions.push({ sid: req.authSessionId, exp: req.authSessionExp });
      }
      const { token } = createSessionForUser(user, true);
      appendAudit(store, user, 'MFA_VERIFIED', user.email, 'Completed TOTP MFA challenge');
      writeStore(store);

      res.json({
        token,
        mfaRequired: false,
        user: sanitizeUser(user),
      });
    }
  );

  app.post('/api/auth/mfa/disable', requireAuth(), (req: AuthenticatedRequest, res) => {
    const { currentPassword, code } = req.body ?? {};
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (
      typeof currentPassword !== 'string' ||
      !verifyPassword(currentPassword, user.passwordSaltHex, user.passwordHashHex)
    ) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    if (user.mfaSecretSealed && typeof code === 'string') {
      const secret = unsealServerSecret(user.mfaSecretSealed);
      if (secret && !verifyTotpCode(secret, code)) {
        res.status(401).json({ error: 'Invalid 6-digit TOTP verification code' });
        return;
      }
    }

    user.mfaEnabled = false;
    delete user.mfaSecretSealed;
    delete user.pendingMfaSecretSealed;
    user.recoveryCodeHashes = [];
    appendAudit(store, user, 'MFA_DISABLED', user.email, 'Disabled TOTP MFA protection');
    writeStore(store);

    res.json({ user: sanitizeUser(user) });
  });

  // --- WebAuthn Passkeys (Multiple Passkeys per Member) ---
  app.post('/api/auth/passkeys/register-options', requireAuth(), async (req: AuthenticatedRequest, res) => {
    const ctx = resolveWebAuthnContext(req);
    if (!ctx) {
      res.status(400).json({ error: 'Passkeys require HTTPS (or localhost) with matching Origin' });
      return;
    }

    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existingPasskeys = user.passkeys ?? [];
    if (existingPasskeys.length >= 10) {
      res.status(400).json({ error: 'Maximum of 10 passkeys reached for this account' });
      return;
    }

    const rawLabel = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    const label = rawLabel
      ? rawLabel.slice(0, 60)
      : `Passkey #${existingPasskeys.length + 1}`;

    const options = await generateRegistrationOptions({
      rpName: 'ZupuVault',
      rpID: ctx.rpID,
      userID: new Uint8Array(Buffer.from(user.id, 'utf8')).slice(),
      userName: user.email,
      userDisplayName: `${user.displayName} (${user.chineseName})`,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.id,
        transports: pk.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    pruneExpiredWebAuthnChallenges();
    pendingRegChallenges.set(user.id, {
      challenge: options.challenge,
      rpID: ctx.rpID,
      expectedOrigin: ctx.expectedOrigin,
      label,
      expiresAt: Date.now() + WEBAUTHN_CHALLENGE_TTL_MS,
    });

    res.json({ options });
  });

  app.post('/api/auth/passkeys/register-verify', requireAuth(), async (req: AuthenticatedRequest, res) => {
    const pending = pendingRegChallenges.get(req.authUser!.id);
    pendingRegChallenges.delete(req.authUser!.id);

    if (!pending || Date.now() > pending.expiresAt) {
      res.status(400).json({ error: 'Passkey registration challenge expired; please try again' });
      return;
    }

    const { response, label } = (req.body ?? {}) as {
      response?: RegistrationResponseJSON;
      label?: string;
    };
    if (!response || typeof response.id !== 'string' || !response.response) {
      res.status(400).json({ error: 'Malformed passkey registration payload' });
      return;
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: pending.expectedOrigin,
        expectedRPID: pending.rpID,
        requireUserVerification: false,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Passkey registration verification failed',
      });
      return;
    }

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Could not verify passkey attestation' });
      return;
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const duplicate = store.users.some((u) =>
      (u.passkeys ?? []).some((pk) => pk.id === credential.id)
    );
    if (duplicate) {
      res.status(409).json({ error: 'This passkey is already registered' });
      return;
    }

    const existingPasskeys = user.passkeys ?? [];
    if (existingPasskeys.length >= 10) {
      res.status(400).json({ error: 'Maximum of 10 passkeys reached for this account' });
      return;
    }

    const finalLabel =
      typeof label === 'string' && label.trim().length > 0
        ? label.trim().slice(0, 60)
        : pending.label;

    const now = new Date().toISOString();
    const storedPasskey: StoredPasskey = {
      id: credential.id,
      publicKeyB64u: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: response.response?.transports ?? credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      label: finalLabel,
      createdAt: now,
    };

    user.passkeys = [...existingPasskeys, storedPasskey];
    appendAudit(
      store,
      user,
      'PASSKEY_REGISTERED',
      user.email,
      `Registered passkey "${finalLabel}" (${credentialDeviceType}${credentialBackedUp ? ', backed up' : ''})`
    );
    writeStore(store);

    res.status(201).json({
      passkey: sanitizePasskeys([storedPasskey])[0],
      user: sanitizeUser(user),
    });
  });

  app.patch('/api/auth/passkeys/:id', requireAuth(), (req: AuthenticatedRequest, res) => {
    const { label } = req.body ?? {};
    if (!isValidText(label, 1, 60)) {
      res.status(400).json({ error: 'Passkey name must be between 1 and 60 characters' });
      return;
    }

    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const target = (user.passkeys ?? []).find((pk) => pk.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Passkey not found' });
      return;
    }

    const prevLabel = target.label;
    target.label = label.trim();
    appendAudit(
      store,
      user,
      'PASSKEY_RENAMED',
      user.email,
      `Renamed passkey "${prevLabel}" to "${target.label}"`
    );
    writeStore(store);

    res.json({ user: sanitizeUser(user) });
  });

  app.delete('/api/auth/passkeys/:id', requireAuth(), (req: AuthenticatedRequest, res) => {
    const store = readStore();
    const user = store.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passkeys = user.passkeys ?? [];
    const idx = passkeys.findIndex((pk) => pk.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Passkey not found' });
      return;
    }

    const [removed] = passkeys.splice(idx, 1);
    user.passkeys = passkeys;
    appendAudit(
      store,
      user,
      'PASSKEY_REMOVED',
      user.email,
      `Removed passkey "${removed.label}"`
    );
    writeStore(store);

    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/auth/passkeys/login-options', strictAuthLimiter, async (req, res) => {
    const ctx = resolveWebAuthnContext(req);
    if (!ctx) {
      res.status(400).json({ error: 'Passkeys require HTTPS (or localhost) with matching Origin' });
      return;
    }

    const { email } = (req.body ?? {}) as { email?: string };
    const store = readStore();
    let allowCredentials: { id: string; transports?: string[] }[] | undefined;

    if (typeof email === 'string' && email.trim().length > 0) {
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Please enter a valid email address or leave email blank' });
        return;
      }
      const normalized = email.trim().toLowerCase();
      const matchedUser = store.users.find(
        (u) => u.email === normalized && u.status === 'active'
      );
      if (!matchedUser || (matchedUser.passkeys?.length ?? 0) === 0) {
        res.status(400).json({
          error:
            'No passkeys are registered for that email yet. Sign in with password or clear the email field to choose a saved passkey.',
        });
        return;
      }
      allowCredentials = matchedUser.passkeys!.map((pk) => ({
        id: pk.id,
        transports: pk.transports,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: ctx.rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    pruneExpiredWebAuthnChallenges();
    const challengeId = crypto.randomUUID();
    pendingAuthChallenges.set(challengeId, {
      challenge: options.challenge,
      rpID: ctx.rpID,
      expectedOrigin: ctx.expectedOrigin,
      expiresAt: Date.now() + WEBAUTHN_CHALLENGE_TTL_MS,
    });

    res.json({ challengeId, options });
  });

  app.post('/api/auth/passkeys/login-verify', strictAuthLimiter, async (req, res) => {
    const { challengeId, response } = (req.body ?? {}) as {
      challengeId?: string;
      response?: AuthenticationResponseJSON;
    };

    if (typeof challengeId !== 'string' || !challengeId) {
      res.status(400).json({ error: 'Missing passkey challenge identifier' });
      return;
    }

    const pending = pendingAuthChallenges.get(challengeId);
    pendingAuthChallenges.delete(challengeId);

    if (!pending || Date.now() > pending.expiresAt) {
      res.status(400).json({ error: 'Passkey sign-in challenge expired; please try again' });
      return;
    }

    if (!response || typeof response.id !== 'string' || !response.response) {
      res.status(400).json({ error: 'Malformed passkey assertion response' });
      return;
    }

    const store = readStore();
    let matchedUser: StoredUser | undefined;
    let matchedPasskey: StoredPasskey | undefined;

    for (const u of store.users) {
      const found = (u.passkeys ?? []).find((pk) => pk.id === response.id);
      if (found) {
        matchedUser = u;
        matchedPasskey = found;
        break;
      }
    }

    if (!matchedUser || !matchedPasskey) {
      res.status(401).json({ error: 'Unrecognized passkey credential' });
      return;
    }

    if (matchedUser.status !== 'active') {
      res.status(403).json({ error: 'Your family access has been suspended by a Custodian' });
      return;
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: pending.expectedOrigin,
        expectedRPID: pending.rpID,
        credential: {
          id: matchedPasskey.id,
          publicKey: new Uint8Array(Buffer.from(matchedPasskey.publicKeyB64u, 'base64url')).slice(),
          counter: matchedPasskey.counter,
          transports: matchedPasskey.transports,
        },
        requireUserVerification: false,
      });
    } catch (err) {
      res.status(401).json({
        error: err instanceof Error ? err.message : 'Passkey signature verification failed',
      });
      return;
    }

    if (!verification.verified) {
      res.status(401).json({ error: 'Passkey assertion could not be verified' });
      return;
    }

    const now = new Date().toISOString();
    matchedPasskey.counter = verification.authenticationInfo.newCounter;
    matchedPasskey.deviceType = verification.authenticationInfo.credentialDeviceType;
    matchedPasskey.backedUp = verification.authenticationInfo.credentialBackedUp;
    matchedPasskey.lastUsedAt = now;
    matchedUser.lastActiveAt = now;

    const mfaSatisfied = !matchedUser.mfaEnabled || Boolean(verification.authenticationInfo.userVerified);
    appendAudit(
      store,
      matchedUser,
      'PASSKEY_SIGN_IN',
      matchedUser.email,
      `Signed in with passkey "${matchedPasskey.label}"${mfaSatisfied ? '' : ' (awaiting TOTP MFA)'}`
    );
    writeStore(store);

    const { token } = createSessionForUser(matchedUser, mfaSatisfied);
    res.json({
      token,
      mfaRequired: !mfaSatisfied,
      user: sanitizeUser(matchedUser),
      passkeyLabel: matchedPasskey.label,
    });
  });

  app.post(
    '/api/auth/password',
    requireAuth({ allowPasswordChangePending: true }),
    (req: AuthenticatedRequest, res) => {
      const { currentPassword, newPassword } = req.body ?? {};
      if (
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string' ||
        newPassword.length < 8 ||
        newPassword.length > 128
      ) {
        res.status(400).json({ error: 'New password must be 8 to 128 characters' });
        return;
      }

      const store = readStore();
      const user = store.users.find((u) => u.id === req.authUser!.id);
      if (!user || !verifyPassword(currentPassword, user.passwordSaltHex, user.passwordHashHex)) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
      if (user.mustChangePassword && newPassword === currentPassword) {
        res.status(400).json({
          error: 'Please choose a new personal password different from your temporary password',
        });
        return;
      }

      const { saltHex, hashHex } = hashPassword(newPassword);
      user.passwordSaltHex = saltHex;
      user.passwordHashHex = hashHex;
      user.mustChangePassword = false;
      user.sessionVersion = (user.sessionVersion ?? 1) + 1;
      appendAudit(store, user, 'PASSWORD_ROTATED', user.email, 'Updated account login password');
      writeStore(store);

      const { token } = createSessionForUser(user, Boolean(req.authMfaVerified));
      res.json({ ok: true, token, user: sanitizeUser(user) });
    }
  );

  // --- Encrypted Family Vault Sync (Zero-Knowledge Ciphertext + Server RBAC Filtering) ---
  app.get('/api/vault', requireAuth(), (req: AuthenticatedRequest, res) => {
    const store = readStore();
    if (!store.vaultBundle) {
      res.json({ bundle: null });
      return;
    }

    const perms = req.authUser!.permissions;
    const role = req.authUser!.role;
    const filteredRecords = store.vaultBundle.records.filter((rec) => {
      if (perms.maxGenerationDepth > 0 && rec.generation > perms.maxGenerationDepth) {
        return false;
      }
      if (!perms.canViewElderSealed && rec.sensitivity === 'elder_sealed') {
        return false;
      }
      if (role === 'guest_scholar' && rec.sensitivity !== 'public_clan') {
        return false;
      }
      if (perms.branchScope !== 'all' && rec.generation > 1 && rec.branch !== perms.branchScope) {
        return false;
      }
      return true;
    });

    res.json({
      bundle: {
        metadata: store.vaultBundle.metadata,
        records: filteredRecords,
      },
      totalServerRecords: store.vaultBundle.records.length,
      serverRevision: store.vaultRevision ?? 1,
    });
  });

  app.put('/api/vault', requireAuth(), (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    if (!user.permissions.canEditLineage && user.role !== 'patriarch') {
      res.status(403).json({ error: 'Your role does not permit editing lineage records' });
      return;
    }

    const { bundle, auditSummary, expectedRevision, forceOverwrite } = req.body ?? {};
    if (!isValidVaultBundle(bundle)) {
      res.status(400).json({ error: 'Malformed encrypted vault envelope' });
      return;
    }

    const store = readStore();
    const currentRevision = store.vaultRevision ?? (store.vaultBundle ? 1 : 0);

    if (
      store.vaultBundle &&
      typeof expectedRevision === 'number' &&
      expectedRevision !== currentRevision &&
      forceOverwrite !== true
    ) {
      res.status(409).json({
        error:
          'Vault revision conflict: another custodian updated the family vault since you unlocked it.',
        conflict: true,
        currentRevision,
        expectedRevision,
      });
      return;
    }

    if (user.permissions.branchScope !== 'all' && store.vaultBundle) {
      // Preserve encrypted records from branches outside the editor's scope
      const scope = user.permissions.branchScope;
      const preservedOtherBranches = store.vaultBundle.records.filter(
        (existing) => existing.generation > 1 && existing.branch !== scope
      );
      const scopedIncoming = bundle.records.filter(
        (incoming) => incoming.generation === 1 || incoming.branch === scope
      );
      const mergedMap = new Map(preservedOtherBranches.map((r) => [r.id, r]));
      for (const r of scopedIncoming) {
        mergedMap.set(r.id, r);
      }
      store.vaultBundle = {
        metadata: {
          ...store.vaultBundle.metadata,
          updatedAt: new Date().toISOString(),
          version: store.vaultBundle.metadata.version + 1,
        },
        records: Array.from(mergedMap.values()),
      };
    } else {
      store.vaultBundle = bundle;
    }

    store.vaultRevision = currentRevision + 1;

    const summary = isValidText(auditSummary, 1, 180)
      ? auditSummary.trim()
      : `Synchronized ${bundle.records.length} AES-256-GCM encrypted lineage envelopes`;
    appendAudit(store, user, 'VAULT_SYNCED', bundle.metadata.clanName, summary);
    writeStore(store);

    res.json({
      ok: true,
      recordCount: store.vaultBundle.records.length,
      serverRevision: store.vaultRevision,
    });
  });

  // --- Granular Role & Permission Management ---
  app.get('/api/members', requireAuth(), (req: AuthenticatedRequest, res) => {
    const store = readStore();
    const user = req.authUser!;
    const canSeeAll = user.role === 'patriarch' || user.permissions.canManageRoles || user.permissions.canInviteRelatives;
    const members = canSeeAll ? store.users.map(sanitizeUser) : [sanitizeUser(user)];
    const invites = canSeeAll
      ? store.invites.map((inv) => ({
          id: inv.id,
          codeHint: inv.codeHint,
          inviteeName: inv.inviteeName,
          inviteeChineseName: inv.inviteeChineseName,
          inviteeEmail: inv.inviteeEmail,
          role: inv.role,
          permissions: inv.permissions,
          createdByName: inv.createdByName,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          usedAt: inv.usedAt,
        }))
      : [];

    res.json({ members, invites });
  });

  app.patch('/api/members/:id/access', requireAuth(), (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    const {
      displayName,
      chineseName,
      email,
      role,
      status,
      permissions,
    } = req.body ?? {};

    const store = readStore();
    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Family member account not found' });
      return;
    }

    const isSelf = actor.id === target.id;
    const isRoleManager = actor.role === 'patriarch' || actor.permissions.canManageRoles;

    if (!isSelf && !isRoleManager) {
      res.status(403).json({
        error: 'Only Clan Custodians or Role Managers can update another member account',
      });
      return;
    }

    if (actor.role !== 'patriarch' && target.role === 'patriarch' && !isSelf) {
      res.status(403).json({
        error: 'Only a Patriarch can modify a Patriarch account',
      });
      return;
    }

    const hasAccessChanges =
      role !== undefined || status !== undefined || permissions !== undefined;
    if (hasAccessChanges && !isRoleManager) {
      res.status(403).json({
        error: 'Your role does not permit modifying roles or permissions',
      });
      return;
    }

    const changedParts: string[] = [];

    // Identity & contact edits (names & login email)
    if (displayName !== undefined) {
      if (!isValidText(displayName, 2, 80)) {
        res.status(400).json({ error: 'Display name must be between 2 and 80 characters' });
        return;
      }
      const nextDisplay = displayName.trim();
      if (nextDisplay !== target.displayName) {
        target.displayName = nextDisplay;
        changedParts.push(`Name=${nextDisplay}`);
      }
    }

    if (chineseName !== undefined) {
      if (!isValidText(chineseName, 1, 40)) {
        res.status(400).json({ error: 'Chinese lineage name must be between 1 and 40 characters' });
        return;
      }
      const nextZh = chineseName.trim();
      if (nextZh !== target.chineseName) {
        target.chineseName = nextZh;
        changedParts.push(`ChineseName=${nextZh}`);
      }
    }

    if (email !== undefined) {
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Please provide a valid email address' });
        return;
      }
      const nextEmail = email.trim().toLowerCase();
      if (nextEmail !== target.email) {
        const duplicate = store.users.some(
          (u) => u.id !== target.id && u.email === nextEmail
        );
        if (duplicate) {
          res.status(409).json({
            error: 'Another family member account already uses this email address',
          });
          return;
        }
        target.email = nextEmail;
        changedParts.push(`Email=${nextEmail}`);
      }
    }

    // Role, status, and granular permissions edits
    if (isRoleManager && hasAccessChanges) {
      if (target.id === actor.id && (status === 'suspended' || (role && role !== 'patriarch'))) {
        res.status(400).json({
          error: 'You cannot suspend or demote your own active Custodian account',
        });
        return;
      }

      const nextRole = isValidRole(role) ? role : target.role;
      if (actor.role !== 'patriarch' && (target.role === 'patriarch' || nextRole === 'patriarch')) {
        res.status(403).json({
          error: 'Only a Patriarch can assign or modify Patriarch privileges',
        });
        return;
      }

      target.role = nextRole;
      if (status === 'active' || status === 'suspended') {
        target.status = status;
      }
      if (permissions) {
        target.permissions = sanitizePermissionsInput(permissions, nextRole);
      }
      changedParts.push(
        `Role=${target.role}, Status=${target.status}, Branch=${target.permissions.branchScope}`
      );
    }

    if (target.status === 'suspended') {
      target.sessionVersion = (target.sessionVersion ?? 1) + 1;
    }

    appendAudit(
      store,
      actor,
      hasAccessChanges ? 'ACCOUNT_AND_PERMISSIONS_UPDATED' : 'ACCOUNT_PROFILE_UPDATED',
      target.email,
      changedParts.join(' · ') || 'Saved account details'
    );
    writeStore(store);

    res.json({ member: sanitizeUser(target) });
  });

  app.post('/api/members/:id/reset-password', requireAuth(), (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'patriarch') {
      res.status(403).json({
        error: 'Only Patriarch / Custodian accounts can reset family member passwords',
      });
      return;
    }

    const { newPassword } = req.body ?? {};
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ error: 'New temporary password must be 8 to 128 characters' });
      return;
    }

    const store = readStore();
    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Family member account not found' });
      return;
    }

    const { saltHex, hashHex } = hashPassword(newPassword);
    target.passwordSaltHex = saltHex;
    target.passwordHashHex = hashHex;
    target.mustChangePassword = actor.id !== target.id;
    target.sessionVersion = (target.sessionVersion ?? 1) + 1;

    appendAudit(
      store,
      actor,
      'CUSTODIAN_PASSWORD_RESET',
      target.email,
      `Patriarch reset account password for ${target.displayName} (forced update on next sign-in)`
    );
    writeStore(store);

    const selfToken =
      actor.id === target.id
        ? createSessionForUser(target, Boolean(req.authMfaVerified)).token
        : undefined;

    res.json({ ok: true, member: sanitizeUser(target), token: selfToken });
  });

  app.post('/api/members/:id/reset-mfa', requireAuth(), (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'patriarch') {
      res.status(403).json({
        error: 'Only Patriarch / Custodian accounts can reset family member MFA',
      });
      return;
    }

    const store = readStore();
    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Family member account not found' });
      return;
    }

    target.mfaEnabled = false;
    delete target.mfaSecretSealed;
    delete target.pendingMfaSecretSealed;
    target.recoveryCodeHashes = [];
    target.sessionVersion = (target.sessionVersion ?? 1) + 1;

    appendAudit(
      store,
      actor,
      'CUSTODIAN_MFA_RESET',
      target.email,
      `Patriarch cleared TOTP MFA enrollment and recovery codes for ${target.displayName}`
    );
    writeStore(store);

    const selfToken =
      actor.id === target.id
        ? createSessionForUser(target, false).token
        : undefined;

    res.json({ ok: true, member: sanitizeUser(target), token: selfToken });
  });

  app.post('/api/members/:id/reset-passkeys', requireAuth(), (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'patriarch') {
      res.status(403).json({
        error: 'Only Patriarch / Custodian accounts can reset family member passkeys',
      });
      return;
    }

    const store = readStore();
    const target = store.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Family member account not found' });
      return;
    }

    const count = target.passkeys?.length ?? 0;
    target.passkeys = [];
    target.sessionVersion = (target.sessionVersion ?? 1) + 1;

    appendAudit(
      store,
      actor,
      'CUSTODIAN_PASSKEYS_RESET',
      target.email,
      `Patriarch cleared ${count} registered passkey(s) for ${target.displayName}`
    );
    writeStore(store);

    const selfToken =
      actor.id === target.id
        ? createSessionForUser(target, Boolean(req.authMfaVerified)).token
        : undefined;

    res.json({ ok: true, member: sanitizeUser(target), token: selfToken });
  });

  app.post('/api/invites', requireAuth(), (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    if (!actor.permissions.canInviteRelatives && actor.role !== 'patriarch') {
      res.status(403).json({ error: 'Your role is not authorized to invite relatives' });
      return;
    }

    const { inviteeName, inviteeChineseName, inviteeEmail, role, permissions } = req.body ?? {};
    if (!isValidText(inviteeName, 2, 80) || !isValidText(inviteeChineseName, 1, 40)) {
      res.status(400).json({ error: 'Relative English and Chinese names are required' });
      return;
    }
    if (inviteeEmail && !isValidEmail(inviteeEmail)) {
      res.status(400).json({ error: 'Invalid invitee email format' });
      return;
    }
    const assignedRole: ClanRole = isValidRole(role) ? role : 'verified_relative';
    if (assignedRole === 'patriarch' && actor.role !== 'patriarch') {
      res.status(403).json({ error: 'Only an existing Patriarch can invite another Patriarch' });
      return;
    }

    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const rawCode = `ZUPU-${part1}-${part2}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const store = readStore();
    const invite: StoredInvite = {
      id: `inv_${crypto.randomUUID()}`,
      codeHash: sha256Hex(rawCode),
      codeHint: `ZUPU-${part1}-••••`,
      inviteeName: inviteeName.trim(),
      inviteeChineseName: inviteeChineseName.trim(),
      inviteeEmail: inviteeEmail ? inviteeEmail.trim().toLowerCase() : '',
      role: assignedRole,
      permissions: sanitizePermissionsInput(permissions, assignedRole),
      createdById: actor.id,
      createdByName: actor.displayName,
      createdAt: now.toISOString(),
      expiresAt,
    };

    store.invites.unshift(invite);
    appendAudit(
      store,
      actor,
      'INVITE_ISSUED',
      invite.inviteeEmail || invite.inviteeName,
      `Issued single-use verification invite (${invite.role}) expiring ${expiresAt.slice(0, 10)}`
    );
    writeStore(store);

    res.status(201).json({
      rawCode,
      invite: {
        id: invite.id,
        codeHint: invite.codeHint,
        inviteeName: invite.inviteeName,
        inviteeChineseName: invite.inviteeChineseName,
        inviteeEmail: invite.inviteeEmail,
        role: invite.role,
        permissions: invite.permissions,
        createdByName: invite.createdByName,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      },
    });
  });

  app.delete('/api/invites/:id', requireAuth(), (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    if (!actor.permissions.canInviteRelatives && actor.role !== 'patriarch') {
      res.status(403).json({ error: 'Not authorized to revoke invites' });
      return;
    }

    const store = readStore();
    const idx = store.invites.findIndex((i) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    const [removed] = store.invites.splice(idx, 1);
    appendAudit(store, actor, 'INVITE_REVOKED', removed.codeHint, 'Revoked unused relative invite');
    writeStore(store);
    res.json({ ok: true });
  });

  app.get('/api/audit', requireAuth(), (req: AuthenticatedRequest, res) => {
    const actor = req.authUser!;
    if (actor.role !== 'patriarch' && actor.role !== 'archivist' && !actor.permissions.canManageRoles) {
      res.status(403).json({ error: 'Audit log access restricted to Custodians and Archivists' });
      return;
    }
    const store = readStore();
    res.json({ logs: store.auditLogs });
  });

  const httpServer = http.createServer(app);
  const disableHmr = process.env.DISABLE_HMR === 'true';

  // --- Vite / Static Frontend Serving ---
  if (process.env.NODE_ENV !== 'production') {
    if (disableHmr) {
      app.get('/@vite/client', (_req, res) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.resolve(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`ZupuVault sovereign server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ZupuVault server:', err);
  process.exit(1);
});
