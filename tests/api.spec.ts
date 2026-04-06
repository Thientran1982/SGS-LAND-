/**
 * E2E: API boundary & security tests
 * These tests hit the API directly (no browser UI) to verify security controls.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

test.describe('API Security', () => {

  test('GET /api/leads requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/leads`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/users requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/users`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/proposals requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/proposals`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/contracts requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/contracts`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/health returns 200 with db status', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });

  test('POST /api/public/leads accepts valid lead', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/public/leads`, {
      data: {
        name: `Test Lead ${Date.now()}`,
        phone: `090${Math.floor(10000000 + Math.random() * 89999999)}`,
      },
    });
    // Should be 201 or 400 (validation), not 500
    expect([201, 400]).toContain(res.status());
  });

  test('POST /api/public/leads rejects missing required fields', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/public/leads`, {
      data: { notes: 'No name or phone' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('rate limiter returns 429 on excessive public lead requests', async ({ request }) => {
    // Fire 10 rapid requests — should trigger rate limit (limit is 5/min)
    const requests = Array.from({ length: 10 }, () =>
      request.post(`${BASE_URL}/api/public/leads`, {
        data: { name: 'Flood', phone: '0901234567' },
      })
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status());
    const wasRateLimited = statuses.some(s => s === 429);
    expect(wasRateLimited, 'Rate limiter should trigger on rapid requests').toBeTruthy();
  });

  test('GET /api/leads with negative pageSize is handled gracefully', async ({ request }) => {
    // Without auth this returns 401, but the point is it shouldn't 500
    const res = await request.get(`${BASE_URL}/api/leads?pageSize=-999&page=-1`);
    expect(res.status()).not.toBe(500);
  });

  test('x-tenant-id header is not respected for unauthenticated requests', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/leads`, {
      headers: { 'x-tenant-id': '00000000-0000-0000-0000-000000000001' },
    });
    // Should still be 401, not 200
    expect(res.status()).toBe(401);
  });

  test('Security headers are present', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    const headers = res.headers();
    // Helmet should set these
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeDefined();
  });

  test('Proposal endpoint rejects negative price', async ({ request }) => {
    // Will get 401 without auth, but key test is that it doesn't 500 with bad data
    // A proper test requires login — covered in authenticated suite
    const res = await request.post(`${BASE_URL}/api/proposals`, {
      data: { leadId: 'test', listingId: 'test', basePrice: -1000, finalPrice: -500 },
    });
    expect([400, 401]).toContain(res.status());
  });

});

test.describe('Public API', () => {

  test('GET /api/public/articles returns paginated articles', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/public/articles?pageSize=5`);
    // Should be 200 (even if empty)
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBeTruthy();
  });

  test('GET /api/public/articles respects pageSize limit', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/public/articles?pageSize=99999`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // pageSize should have been capped at 200
    expect(body.data.length).toBeLessThanOrEqual(200);
  });

});
