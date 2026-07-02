import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  csrfProtection,
  csrfTokenIssuer,
  generateCsrfToken,
  csrfTokenHandler,
  CSRF_COOKIE_NAME,
} from '../../../server/middleware/security';

// ---- Minimal Express req/res doubles ---------------------------------------
function makeReq(overrides: any = {}) {
  return {
    method: 'POST',
    path: '/api/leads',
    headers: {},
    cookies: {},
    body: {},
    query: {},
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    _json: undefined,
    _cookies: {} as Record<string, any>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this._json = payload;
      return this;
    },
    cookie(name: string, value: string, opts: any) {
      this._cookies[name] = { value, opts };
      return this;
    },
  };
  return res;
}

describe('CSRF: generateCsrfToken', () => {
  it('produces a 64-char hex token', () => {
    const t = generateCsrfToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique tokens', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
});

describe('CSRF: csrfTokenIssuer', () => {
  it('sets a non-HttpOnly csrf_token cookie when none exists', () => {
    const req = makeReq({ cookies: {} });
    const res = makeRes();
    const next = vi.fn();
    csrfTokenIssuer(req, res, next);
    expect(res._cookies[CSRF_COOKIE_NAME]).toBeDefined();
    expect(res._cookies[CSRF_COOKIE_NAME].opts.httpOnly).toBe(false);
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not overwrite an existing token', () => {
    const req = makeReq({ cookies: { [CSRF_COOKIE_NAME]: 'existing' } });
    const res = makeRes();
    csrfTokenIssuer(req, res, vi.fn());
    expect(res._cookies[CSRF_COOKIE_NAME]).toBeUndefined();
    expect(req.csrfToken).toBe('existing');
  });
});

describe('CSRF: csrfProtection enforcing', () => {
  let next: any;
  beforeEach(() => {
    next = vi.fn();
  });

  it('allows safe GET without token', () => {
    csrfProtection(makeReq({ method: 'GET' }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects POST with no token (403 EBADCSRFTOKEN)', () => {
    const res = makeRes();
    csrfProtection(makeReq({ method: 'POST' }), res, next);
    expect(res.statusCode).toBe(403);
    expect(res._json.code).toBe('EBADCSRFTOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects DELETE when header != cookie', () => {
    const res = makeRes();
    csrfProtection(
      makeReq({ method: 'DELETE', cookies: { csrf_token: 'aaa' }, headers: { 'x-csrf-token': 'bbb' } }),
      res,
      next,
    );
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts POST when header matches cookie', () => {
    const tok = generateCsrfToken();
    const res = makeRes();
    csrfProtection(
      makeReq({ method: 'POST', cookies: { csrf_token: tok }, headers: { 'x-csrf-token': tok } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('accepts token supplied via _csrf body field', () => {
    const tok = generateCsrfToken();
    const res = makeRes();
    csrfProtection(
      makeReq({ method: 'PUT', cookies: { csrf_token: tok }, body: { _csrf: tok } }),
      res,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('exempts webhook endpoints', () => {
    const res = makeRes();
    csrfProtection(makeReq({ method: 'POST', path: '/api/webhooks/zalo' }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('exempts login (pre-session bootstrap)', () => {
    const res = makeRes();
    csrfProtection(makeReq({ method: 'POST', path: '/api/auth/login' }), res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('CSRF: csrfTokenHandler', () => {
  it('returns the current token as JSON', () => {
    const req = makeReq({ cookies: { csrf_token: 'seed' } });
    const res = makeRes();
    csrfTokenHandler(req, res);
    expect(res._json.csrfToken).toBe('seed');
  });
});
