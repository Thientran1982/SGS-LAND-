import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { articleRepository } = vi.hoisted(() => ({
  articleRepository: {
    findArticles: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
  },
}));

vi.mock('../repositories/articleRepository', () => ({ articleRepository }));
vi.mock('../repositories/documentRepository', () => ({ documentRepository: {} }));
vi.mock('../services/textExtractor', () => ({
  extractTextFromBuffer: vi.fn(),
  extractTextFromFile: vi.fn(),
}));
vi.mock('../services/storageService', () => ({
  getFile: vi.fn(),
  deleteFile: vi.fn(),
}));
vi.mock('../services/ragService', () => ({
  indexDocument: vi.fn(),
  semanticSearch: vi.fn(),
  getIndexStats: vi.fn(),
  deleteSource: vi.fn(),
  buildRagContext: vi.fn(),
}));
vi.mock('../services/cacheInvalidationService', () => ({
  invalidateKnowledgeCache: vi.fn(),
}));

import { createKnowledgeRoutes } from '../routes/knowledgeRoutes';

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.header('x-test-role') || 'ADMIN';
    const tenantId = req.header('x-test-tenant') || 'tenant-a';
    (req as any).user = { id: 'user-1', name: 'Test user', role, tenantId };
    next();
  });
  app.use('/api/knowledge', createKnowledgeRoutes((_req: any, _res: any, next: any) => next()));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    request: (path: string, init: RequestInit = {}) =>
      fetch(`http://127.0.0.1:${port}${path}`, init),
  };
}

describe('knowledge article edit/delete authorization boundaries', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    testServer = await startTestServer();
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      testServer.server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('blocks edit and delete for contributors without changing repository state', async () => {
    const headers = { 'x-test-role': 'SALES', 'x-test-tenant': 'tenant-a' };

    const update = await testServer.request('/api/knowledge/articles/article-1', {
      method: 'PUT',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Tampered title' }),
    });
    const deletion = await testServer.request('/api/knowledge/articles/article-1', {
      method: 'DELETE',
      headers,
    });

    expect(update.status).toBe(403);
    expect(deletion.status).toBe(403);
    expect(articleRepository.update).not.toHaveBeenCalled();
    expect(articleRepository.deleteById).not.toHaveBeenCalled();
  });

  it('passes the authenticated tenant to update and never updates a cross-tenant article', async () => {
    articleRepository.update.mockResolvedValueOnce({
      id: 'article-a',
      tenantId: 'tenant-a',
      title: 'Updated safely',
    });

    const response = await testServer.request('/api/knowledge/articles/article-a', {
      method: 'PUT',
      headers: {
        'x-test-role': 'ADMIN',
        'x-test-tenant': 'tenant-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Updated safely' }),
    });

    expect(response.status).toBe(200);
    expect(articleRepository.update).toHaveBeenCalledWith(
      'tenant-a',
      'article-a',
      { title: 'Updated safely' },
    );

    articleRepository.update.mockResolvedValueOnce(null);
    const crossTenantResponse = await testServer.request('/api/knowledge/articles/article-b', {
      method: 'PUT',
      headers: {
        'x-test-role': 'TEAM_LEAD',
        'x-test-tenant': 'tenant-b',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'Should not leak across tenants' }),
    });

    expect(crossTenantResponse.status).toBe(404);
    expect(articleRepository.update).toHaveBeenLastCalledWith(
      'tenant-b',
      'article-b',
      { title: 'Should not leak across tenants' },
    );
  });

  it('deletes only the authorized tenant article and returns 404 for a missing scoped article', async () => {
    articleRepository.deleteById.mockResolvedValueOnce(true);

    const response = await testServer.request('/api/knowledge/articles/article-a', {
      method: 'DELETE',
      headers: {
        'x-test-role': 'TEAM_LEAD',
        'x-test-tenant': 'tenant-a',
      },
    });

    expect(response.status).toBe(200);
    expect(articleRepository.deleteById).toHaveBeenCalledWith('tenant-a', 'article-a');

    articleRepository.deleteById.mockResolvedValueOnce(false);
    const missing = await testServer.request('/api/knowledge/articles/article-a', {
      method: 'DELETE',
      headers: {
        'x-test-role': 'ADMIN',
        'x-test-tenant': 'tenant-b',
      },
    });

    expect(missing.status).toBe(404);
    expect(articleRepository.deleteById).toHaveBeenLastCalledWith('tenant-b', 'article-a');
  });
});