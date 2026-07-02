// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  base32Encode, base32Decode, generateSecret, generateToken, verifyToken,
  encryptSecret, decryptSecret, generateBackupCodes, hashBackupCode, matchBackupCode,
  otpauthUrl,
} from '../../../server/utils/totp';

// Ensure encryption has a key available in the test environment.
process.env.TOTP_ENC_KEY = process.env.TOTP_ENC_KEY || 'test-totp-key-please-change';

describe('TOTP base32', () => {
  it('round-trips arbitrary bytes', () => {
    const buf = Buffer.from([0, 1, 2, 250, 255, 128, 64, 32]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });
  it('encodes known RFC 4648 vector', () => {
    // 'foobar' -> MZXW6YTBOI
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });
});

describe('TOTP generateToken / verifyToken', () => {
  it('generates a 6-digit code that verifies', () => {
    const secret = generateSecret();
    const token = generateToken(secret);
    expect(token).toMatch(/^[0-9]{6}$/);
    expect(verifyToken(token, secret)).toBe(true);
  });
  it('rejects a wrong code', () => {
    const secret = generateSecret();
    const token = generateToken(secret);
    const wrong = token === '000000' ? '111111' : '000000';
    expect(verifyToken(wrong, secret)).toBe(false);
  });
  it('accepts codes within +/-1 time-step drift', () => {
    const secret = generateSecret();
    const now = 1700000000000;
    const prev = generateToken(secret, now - 30000);
    const next = generateToken(secret, now + 30000);
    expect(verifyToken(prev, secret, { forTime: now })).toBe(true);
    expect(verifyToken(next, secret, { forTime: now })).toBe(true);
  });
  it('rejects codes outside the drift window', () => {
    const secret = generateSecret();
    const now = 1700000000000;
    const farFuture = generateToken(secret, now + 120000);
    expect(verifyToken(farFuture, secret, { forTime: now, window: 1 })).toBe(false);
  });
  it('rejects malformed input', () => {
    const secret = generateSecret();
    expect(verifyToken('', secret)).toBe(false);
    expect(verifyToken('abcdef', secret)).toBe(false);
    expect(verifyToken('12345', secret)).toBe(false);
  });
});

describe('TOTP secret encryption (AES-256-GCM)', () => {
  it('round-trips a secret', () => {
    const secret = generateSecret();
    const enc = encryptSecret(secret);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
  });
  it('fails on a tampered ciphertext', () => {
    const enc = encryptSecret(generateSecret());
    const parts = enc.split('.');
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
    expect(() => decryptSecret(parts.join('.'))).toThrow();
  });
});

describe('TOTP backup codes', () => {
  it('generates unique codes and matches only the right one', () => {
    const codes = generateBackupCodes(8);
    expect(new Set(codes).size).toBe(8);
    const hashes = codes.map(hashBackupCode);
    expect(matchBackupCode(codes[3], hashes)).toBe(hashes[3]);
    expect(matchBackupCode('zzzzz-zzzzz', hashes)).toBeNull();
  });
  it('is insensitive to separators/casing', () => {
    const codes = generateBackupCodes(1);
    const hashes = codes.map(hashBackupCode);
    const noisy = codes[0].toUpperCase().replace('-', ' ');
    expect(matchBackupCode(noisy, hashes)).toBe(hashes[0]);
  });
});

describe('otpauthUrl', () => {
  it('builds a valid provisioning URL', () => {
    const url = otpauthUrl('ABCDEF', 'admin@sgs.vn', 'SGS Land');
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain('secret=ABCDEF');
    expect(url).toContain('issuer=SGS');
  });
});
