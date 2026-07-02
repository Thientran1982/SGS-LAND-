// server/utils/totp.ts
// Dependency-free RFC 6238 TOTP (HMAC-SHA1) + RFC 4648 base32 + AES-256-GCM
// secret-at-rest encryption. Used to add authenticator-app 2FA for admins.
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// --- Base32 (RFC 4648) ---
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// --- TOTP core (RFC 6238) ---
export function generateSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter (safe for the JS timeframe).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

export function generateToken(base32Secret: string, forTime = Date.now(), step = 30, digits = 6): string {
  const counter = Math.floor(forTime / 1000 / step);
  return hotp(base32Decode(base32Secret), counter, digits);
}

// Verifies a token allowing +/- `window` time-steps of clock drift.
// Uses timing-safe comparison to avoid leaking timing information.
export function verifyToken(token: string, base32Secret: string, opts: { window?: number; step?: number; digits?: number; forTime?: number } = {}): boolean {
  const window = opts.window ?? 1;
  const step = opts.step ?? 30;
  const digits = opts.digits ?? 6;
  const forTime = opts.forTime ?? Date.now();
  const cleaned = (token || '').replace(/\s/g, '');
  if (!/^[0-9]{6,8}$/.test(cleaned)) return false;
  const secret = base32Decode(base32Secret);
  const counter = Math.floor(forTime / 1000 / step);
  for (let w = -window; w <= window; w++) {
    const expected = hotp(secret, counter + w, digits);
    if (expected.length === cleaned.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleaned))) {
      return true;
    }
  }
  return false;
}

// --- otpauth URL for QR provisioning ---
export function otpauthUrl(secret: string, accountName: string, issuer = 'SGS Land'): string {
  const label = encodeURIComponent(issuer + ':' + accountName);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return 'otpauth://totp/' + label + '?' + params.toString();
}
// --- Secret-at-rest encryption (AES-256-GCM) ---
// Key derives from TOTP_ENC_KEY, falling back to JWT_SECRET so 2FA works
// out-of-the-box; set a dedicated TOTP_ENC_KEY in production for rotation.
function getEncKey(): Buffer {
  const raw = process.env.TOTP_ENC_KEY || process.env.JWT_SECRET || '';
  if (!raw) throw new Error('TOTP_ENC_KEY or JWT_SECRET must be set for 2FA encryption');
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: v1.<iv>.<tag>.<ciphertext> (all base64url)
  return 'v1.' + iv.toString('base64url') + '.' + tag.toString('base64url') + '.' + enc.toString('base64url');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Invalid encrypted secret format');
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const enc = Buffer.from(parts[3], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// --- Backup / recovery codes ---
// Codes are shown once to the user; only their SHA-256 hashes are stored.
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    codes.push(raw.slice(0, 5) + '-' + raw.slice(5));
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).digest('hex');
}

// Returns the matching hash if `code` is valid, else null (timing-safe per entry).
export function matchBackupCode(code: string, hashes: string[]): string | null {
  const candidate = hashBackupCode(code);
  for (const h of hashes) {
    if (h.length === candidate.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(candidate))) {
      return h;
    }
  }
  return null;
}

export const ADMIN_2FA_ROLES = ['SUPER_ADMIN', 'ADMIN'];
