import { describe, it, expect, vi } from 'vitest';
import { preventParamPollution, csrfProtection, generateCsrfToken } from '../../../server/middleware/security';

function makeReq(o: any = {}) {
  return { method: 'POST', path: '/api/leads', headers: {}, cookies: {}, body: {}, query: {}, ...o } as any;
}
function makeRes() {
  const r: any = { statusCode: 200, _json: undefined,
    status(c: number) { r.statusCode = c; return r; },
    json(p: any) { r._json = p; return r; } };
  return r;
}

describe('SECURITY: HTTP Parameter Pollution', () => {
  it('collapses duplicated array query params to the last value', () => {
    const req = makeReq({ query: { role: ['user', 'admin'] } });
    preventParamPollution(req, makeRes(), vi.fn());
    expect(req.query.role).toBe('admin');
  });

  it('ignores prototype-pollution keys (__proto__/constructor)', () => {
    const req = makeReq({ query: { __proto__: ['x'], constructor: ['y'], safe: ['a', 'b'] } });
    preventParamPollution(req, makeRes(), vi.fn());
    expect(({} as any).polluted).toBeUndefined();
    expect(req.query.safe).toBe('b');
  });
});

describe('SECURITY: CSRF attack scenarios (double-submit)', () => {
  it('blocks a forged cross-site POST (cookie present, no header)', () => {
    // Simulates a victim whose auth+csrf cookies ride along, but the attacker
    // page cannot read the cookie to set the matching header.
    const res = makeRes();
    const next = vi.fn();
    csrfProtection(
      makeReq({ method: 'POST', path: '/api/users', cookies: { csrf_token: 'victim-secret' }, headers: {} }),
      res, next,
    );
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks a stolen-header replay against a different cookie', () => {
    const res = makeRes();
    csrfProtection(
      makeReq({ method: 'DELETE', path: '/api/users/1', cookies: { csrf_token: 'A' }, headers: { 'x-csrf-token': 'B' } }),
      res, vi.fn(),
    );
    expect(res.statusCode).toBe(403);
  });

  it('permits a legitimate same-origin request', () => {
    const tok = generateCsrfToken();
    const res = makeRes();
    const next = vi.fn();
    csrfProtection(
      makeReq({ method: 'POST', path: '/api/users', cookies: { csrf_token: tok }, headers: { 'x-csrf-token': tok } }),
      res, next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('is not bypassable via method casing (still enforced)', () => {
    const res = makeRes();
    csrfProtection(makeReq({ method: 'POST' }), res, vi.fn());
    expect(res.statusCode).toBe(403);
  });
});
