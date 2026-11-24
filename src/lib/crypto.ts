import type {
  BranchDefinition,
  ClanMetadata,
  DecryptedMember,
  EncryptedBlob,
  EncryptedMemberEnvelope,
  EncryptedVaultBundle,
  PortableZupuArchive,
  SensitiveMemberPayload,
} from '../types/zupu';

const KDF_ITERATIONS = 310_000;
const VERIFIER_PLAINTEXT = 'ZUPU_VAULT_VERIFIED_V1';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function generateSaltB64(): string {
  return toBase64(window.crypto.getRandomValues(new Uint8Array(16)));
}

export async function sha256HexClient(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveVaultKey(
  passphrase: string,
  saltB64: string,
  iterations = KDF_ITERATIONS
): Promise<{ key: CryptoKey; fingerprint: string }> {
  const rawMaterial = new TextEncoder().encode(passphrase);
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    rawMaterial,
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );

  const saltBuf = toArrayBuffer(fromBase64(saltB64));
  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const fpBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: Math.min(iterations, 50_000),
      hash: 'SHA-256',
    },
    baseKey,
    128
  );
  const fpHash = await window.crypto.subtle.digest('SHA-256', fpBits);
  const fingerprint = Array.from(new Uint8Array(fpHash))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();

  return { key: aesKey, fingerprint };
}

export async function encryptStringAesGcm(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const cipherBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    data
  );
  return {
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptStringAesGcm(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  const iv = toArrayBuffer(fromBase64(blob.ivB64));
  const cipherBytes = toArrayBuffer(fromBase64(blob.ciphertextB64));
  const plainBuf = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );
  return new TextDecoder().decode(plainBuf);
}

export async function encryptMemberRecord(
  key: CryptoKey,
  member: DecryptedMember
): Promise<EncryptedMemberEnvelope> {
  const sensitive: SensitiveMemberPayload = {
    chineseName: member.chineseName,
    romanizedName: member.romanizedName,
    courtesyName: member.courtesyName,
    artName: member.artName,
    gender: member.gender,
    birthOrder: member.birthOrder,
    isLiving: member.isLiving,
    birthYear: member.birthYear,
    birthLunar: member.birthLunar,
    deathYear: member.deathYear,
    deathLunar: member.deathLunar,
    birthplace: member.birthplace,
    currentResidence: member.currentResidence,
    occupationOrTitle: member.occupationOrTitle,
    biography: member.biography,
    sealedTestament: member.sealedTestament,
    portraitDataUrl: member.portraitDataUrl,
  };
  const encryptedPayload = await encryptStringAesGcm(key, JSON.stringify(sensitive));
  return {
    id: member.id,
    generation: member.generation,
    branch: member.branch,
    sensitivity: member.sensitivity,
    parentIds: member.parentIds,
    spouseIds: member.spouseIds,
    encryptedPayload,
    updatedAt: member.updatedAt,
  };
}

export async function decryptMemberRecord(
  key: CryptoKey,
  envelope: EncryptedMemberEnvelope
): Promise<DecryptedMember> {
  const jsonText = await decryptStringAesGcm(key, envelope.encryptedPayload);
  const payload = JSON.parse(jsonText) as SensitiveMemberPayload;
  return {
    id: envelope.id,
    generation: envelope.generation,
    branch: envelope.branch,
    sensitivity: envelope.sensitivity,
    parentIds: envelope.parentIds,
    spouseIds: envelope.spouseIds,
    updatedAt: envelope.updatedAt,
    ...payload,
  };
}

export async function createEncryptedVaultBundle(
  passphrase: string,
  clanInfo: {
    clanName: string;
    clanChineseName: string;
    hallName: string;
    ancestralOrigin: string;
    generationPoem: string[];
    branches?: BranchDefinition[];
    version?: number;
  },
  members: DecryptedMember[]
): Promise<{ bundle: EncryptedVaultBundle; key: CryptoKey }> {
  const keySaltB64 = generateSaltB64();
  const { key, fingerprint } = await deriveVaultKey(passphrase, keySaltB64, KDF_ITERATIONS);
  const verifierBlob = await encryptStringAesGcm(key, VERIFIER_PLAINTEXT);
  const records = await Promise.all(members.map((m) => encryptMemberRecord(key, m)));

  const metadata: ClanMetadata = {
    clanName: clanInfo.clanName,
    clanChineseName: clanInfo.clanChineseName,
    hallName: clanInfo.hallName,
    ancestralOrigin: clanInfo.ancestralOrigin,
    generationPoem: clanInfo.generationPoem,
    ...(clanInfo.branches && clanInfo.branches.length > 0 ? { branches: clanInfo.branches } : {}),
    keySaltB64,
    kdfIterations: KDF_ITERATIONS,
    keyFingerprint: fingerprint,
    verifierBlob,
    updatedAt: new Date().toISOString(),
    version: clanInfo.version ?? 1,
  };

  return {
    bundle: { metadata, records },
    key,
  };
}

export async function verifyVaultPassphrase(
  passphrase: string,
  metadata: Pick<ClanMetadata, 'keySaltB64' | 'kdfIterations' | 'verifierBlob'>
): Promise<boolean> {
  try {
    const { key } = await deriveVaultKey(
      passphrase,
      metadata.keySaltB64,
      metadata.kdfIterations
    );
    const check = await decryptStringAesGcm(key, metadata.verifierBlob);
    return check === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

export async function unlockEncryptedVaultBundle(
  passphrase: string,
  bundle: EncryptedVaultBundle
): Promise<{ key: CryptoKey; members: DecryptedMember[] }> {
  const { key } = await deriveVaultKey(
    passphrase,
    bundle.metadata.keySaltB64,
    bundle.metadata.kdfIterations
  );

  try {
    const check = await decryptStringAesGcm(key, bundle.metadata.verifierBlob);
    if (check !== VERIFIER_PLAINTEXT) {
      throw new Error('Verification marker mismatch');
    }
  } catch {
    throw new Error('Incorrect Family Encryption Passphrase or corrupted vault integrity tag.');
  }

  const members = await Promise.all(bundle.records.map((r) => decryptMemberRecord(key, r)));
  return { key, members };
}

export async function computeBundleChecksum(bundle: EncryptedVaultBundle): Promise<string> {
  return sha256HexClient(JSON.stringify(bundle));
}

export async function createPortableArchive(
  bundle: EncryptedVaultBundle,
  exportedBy: string
): Promise<PortableZupuArchive> {
  const sha256Checksum = await computeBundleChecksum(bundle);
  return {
    format: 'ZUPU_VAULT_ARCHIVE_V1',
    exportedAt: new Date().toISOString(),
    exportedBy,
    sha256Checksum,
    bundle,
  };
}
