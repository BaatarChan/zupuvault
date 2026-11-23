import crypto from 'crypto';

// Ephemeral fallback if SESSION_SECRET is not provided in environment
const SESSION_SECRET_MATERIAL =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? Buffer.from(process.env.SESSION_SECRET, 'utf8')
    : crypto.randomBytes(32);

const SEAL_KEY = Buffer.from(
  crypto.hkdfSync(
    'sha256',
    SESSION_SECRET_MATERIAL,
    Buffer.from('zupuvault-server-seal-salt', 'utf8'),
    Buffer.from('totp-secret-encryption-v1', 'utf8'),
    32
  )
);

const SIGNING_KEY = Buffer.from(
  crypto.hkdfSync(
    'sha256',
    SESSION_SECRET_MATERIAL,
    Buffer.from('zupuvault-session-salt', 'utf8'),
    Buffer.from('bearer-token-hmac-v1', 'utf8'),
    32
  )
);

export function hashPassword(password: string): { saltHex: string; hashHex: string } {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return {
    saltHex: salt.toString('hex'),
    hashHex: derived.toString('hex'),
  };
}

export function verifyPassword(password: string, saltHex: string, hashHex: string): boolean {
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function constantTimeCompareStrings(a: string, b: string): boolean {
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function sealServerSecret(plaintext: string): { ivHex: string; tagHex: string; dataHex: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SEAL_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ivHex: iv.toString('hex'),
    tagHex: tag.toString('hex'),
    dataHex: encrypted.toString('hex'),
  };
}

export function unsealServerSecret(sealed: { ivHex: string; tagHex: string; dataHex: string }): string | null {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', SEAL_KEY, Buffer.from(sealed.ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(sealed.tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(sealed.dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export interface SignedSessionPayload {
  sid: string;
  uid: string;
  mfa: boolean;
  sv: number;
  exp: number;
}

export function signSessionToken(payload: SignedSessionPayload): string {
  const bodyB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SIGNING_KEY).update(bodyB64).digest('base64url');
  return `${bodyB64}.${sig}`;
}

export function verifySessionToken(token: string): SignedSessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [bodyB64, sigB64] = parts;
    const expectedSig = crypto.createHmac('sha256', SIGNING_KEY).update(bodyB64).digest('base64url');
    const a = Buffer.from(sigB64, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(bodyB64, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!parsed.sid || !parsed.uid || typeof parsed.exp !== 'number') return null;
    if (typeof parsed.sv !== 'number' || !Number.isInteger(parsed.sv) || parsed.sv < 1) return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

// --- RFC 6238 TOTP (SHA-1, 6 digits, 30s period) ---
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildOtpAuthUri(email: string, secretBase32: string): string {
  const label = encodeURIComponent(`ZupuVault:${email}`);
  const issuer = encodeURIComponent('ZupuVault');
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function computeTotpAtCounter(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const counterBuf = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBuf.writeUInt32BE(high, 0);
  counterBuf.writeUInt32BE(low, 4);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

export function verifyTotpCode(secretBase32: string, code: string, window = 1): boolean {
  const trimmed = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(trimmed)) return false;
  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  for (let delta = -window; delta <= window; delta++) {
    const candidate = computeTotpAtCounter(secretBase32, currentCounter + delta);
    const a = Buffer.from(trimmed, 'utf8');
    const b = Buffer.from(candidate, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }
  return false;
}

export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}
