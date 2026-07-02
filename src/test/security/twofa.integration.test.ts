// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateSecret, generateToken, verifyToken, encryptSecret, decryptSecret,
  generateBackupCodes, hashBackupCode, matchBackupCode, ADMIN_2FA_ROLES,
} from '../../../server/utils/totp';

beforeAll(() => {
  process.env.TOTP_ENC_KEY = process.env.TOTP_ENC_KEY || 'test-totp-key-please-change';
});

// Reproduces the exact login-gate decision from server.ts, wired to the real
// TOTP utilities, so we test the gate behavior end-to-end without a live DB.
function simulateLoginGate(dbUser: any, body: any): { status: number; code?: string; consumed?: string } {
  if (ADMIN_2FA_ROLES.includes(dbUser.role) && dbUser.totpEnabled) {
    const totpToken = body?.totpToken || body?.totp || body?.code;
    if (!totpToken) return { status: 401, code: 'TWO_FACTOR_REQUIRED' };
    let ok = false; let consumed: string | undefined;
    const secret = decryptSecret(dbUser.totpSecret);
    ok = verifyToken(String(totpToken), secret);
    if (!ok) {
      const hashes: string[] = dbUser.totpBackupCodes || [];
      const matched = matchBackupCode(String(totpToken), hashes);
      if (matched) { ok = true; consumed = matched; }
    }
    if (!ok) return { status: 401, code: 'TWO_FACTOR_INVALID' };
    return { status: 200, consumed };
  }
  return { status: 200 };
}

describe('Admin 2FA login gate', () => {
  it('lets non-admin users through without a code', () => {
    const r = simulateLoginGate({ role: 'VIEWER', totpEnabled: false }, {});
    expect(r.status).toBe(200);
  });
  it('lets admins without 2FA enabled through', () => {
    const r = simulateLoginGate({ role: 'SUPER_ADMIN', totpEnabled: false }, {});
    expect(r.status).toBe(200);
  });
  it('challenges an admin with 2FA enabled but no code', () => {
    const secret = generateSecret();
    const user = { role: 'SUPER_ADMIN', totpEnabled: true, totpSecret: encryptSecret(secret), totpBackupCodes: [] };
    const r = simulateLoginGate(user, {});
    expect(r.status).toBe(401);
    expect(r.code).toBe('TWO_FACTOR_REQUIRED');
  });
  it('rejects an invalid code', () => {
    const secret = generateSecret();
    const user = { role: 'ADMIN', totpEnabled: true, totpSecret: encryptSecret(secret), totpBackupCodes: [] };
    const r = simulateLoginGate(user, { totpToken: '000000' });
    // 000000 could theoretically be valid; guard against the 1-in-a-million case.
    if (verifyToken('000000', secret)) { expect(r.status).toBe(200); }
    else { expect(r.status).toBe(401); expect(r.code).toBe('TWO_FACTOR_INVALID'); }
  });
  it('accepts a valid current TOTP code', () => {
    const secret = generateSecret();
    const user = { role: 'SUPER_ADMIN', totpEnabled: true, totpSecret: encryptSecret(secret), totpBackupCodes: [] };
    const r = simulateLoginGate(user, { totpToken: generateToken(secret) });
    expect(r.status).toBe(200);
  });
  it('accepts a backup code and marks it consumed', () => {
    const secret = generateSecret();
    const codes = generateBackupCodes(3);
    const hashes = codes.map(hashBackupCode);
    const user = { role: 'ADMIN', totpEnabled: true, totpSecret: encryptSecret(secret), totpBackupCodes: hashes };
    const r = simulateLoginGate(user, { totpToken: codes[1] });
    expect(r.status).toBe(200);
    expect(r.consumed).toBe(hashes[1]);
  });
  it('supports the enrollment verify-then-enable flow', () => {
    // setup: generate + encrypt secret (stored), user not yet enabled.
    const secret = generateSecret();
    const stored = encryptSecret(secret);
    // enable: user submits current code; server decrypts and verifies.
    const code = generateToken(decryptSecret(stored));
    expect(verifyToken(code, decryptSecret(stored))).toBe(true);
  });
});
