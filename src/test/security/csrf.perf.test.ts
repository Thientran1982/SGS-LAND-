import { describe, it, expect, vi } from 'vitest';
import { csrfProtection, generateCsrfToken } from '../../../server/middleware/security';

function makeReq(o: any = {}) {
  return { method: 'POST', path: '/api/leads', headers: {}, cookies: {}, body: {}, query: {}, ...o } as any;
}
function makeRes() {
  const r: any = { statusCode: 200, status(c: number){ r.statusCode=c; return r; }, json(){ return r; } };
  return r;
}

describe('PERFORMANCE: CSRF middleware overhead', () => {
  it('validates 50k requests in well under 1s (low per-call overhead)', () => {
    const tok = generateCsrfToken();
    const N = 50_000;
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      const res = makeRes();
      csrfProtection(
        makeReq({ cookies: { csrf_token: tok }, headers: { 'x-csrf-token': tok } }),
        res,
        () => {},
      );
    }
    const ms = performance.now() - start;
    const perCall = ms / N;
    // Guardrail: middleware must stay cheap (<0.05ms/call avg on CI hardware).
    expect(perCall).toBeLessThan(0.05);
    expect(ms).toBeLessThan(1000);
  });

  it('token generation stays fast (10k tokens < 500ms)', () => {
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) generateCsrfToken();
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('rejection path short-circuits without extra work', () => {
    const N = 50_000;
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      csrfProtection(makeReq({ method: 'POST' }), makeRes(), () => {});
    }
    expect((performance.now() - start) / N).toBeLessThan(0.05);
  });
});
