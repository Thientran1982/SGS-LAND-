import express from 'express';
import type { NextFunction, Request, Response as ExpressResponse } from 'express';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { publicProjectContentRepository } = vi.hoisted(() => ({
  publicProjectContentRepository: {
    findPublished: vi.fn(),
    findForTenant: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../repositories/publicProjectContentRepository', () => ({
  publicProjectContentRepository,
}));

import { createPublicProjectContentRoutes } from '../routes/publicProjectContentRoutes';

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: 'user-1',
      tenantId: req.header('x-test-tenant') || 'tenant-a',
      role: req.header('x-test-role') || 'ADMIN',
    };
    next();
  });
  app.use('/api/project-content', createPublicProjectContentRoutes(
    (_req: Request, _res: ExpressResponse, next: NextFunction) => next(),
  ));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    server,
    request: (path: string, init: RequestInit = {}) =>
      fetch(`http://127.0.0.1:${port}${path}`, init),
  };
}

async function json(response: Response) {
  return response.json();
}

describe('public project content CMS authorization and visibility', () => {
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

  it('blocks roles without CMS permissions for every write and management endpoint', async () => {
    const headers = {
      'x-test-role': 'AGENT',
      'x-test-tenant': 'tenant-a',
      'content-type': 'application/json',
    };

    const create = await testServer.request('/api/project-content', {
      method: 'POST',
      headers,
      body: JSON.stringify({ slug: 'new-project', name: 'New project' }),
    });
    const list = await testServer.request('/api/project-content', { headers });
    const detail = await testServer.request('/api/project-content/project-a', { headers });
    const update = await testServer.request('/api/project-content/project-a', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Changed' }),
    });
    const remove = await testServer.request('/api/project-content/project-a', {
      method: 'DELETE',
      headers,
    });

    expect(create.status).toBe(403);
    expect(list.status).toBe(403);
    expect(detail.status).toBe(403);
    expect(update.status).toBe(403);
    expect(remove.status).toBe(403);
    expect(publicProjectContentRepository.create).not.toHaveBeenCalled();
    expect(publicProjectContentRepository.findForTenant).not.toHaveBeenCalled();
    expect(publicProjectContentRepository.update).not.toHaveBeenCalled();
    expect(publicProjectContentRepository.remove).not.toHaveBeenCalled();
  });

  it('allows only approved management roles to list and edit tenant content', async () => {
    publicProjectContentRepository.findForTenant.mockResolvedValueOnce([]);
    publicProjectContentRepository.update.mockResolvedValueOnce({
      id: 'project-a',
      tenantId: 'tenant-a',
      name: 'Updated',
    });
    publicProjectContentRepository.remove.mockResolvedValueOnce(true);

    const headers = {
      'x-test-role': 'TEAM_LEAD',
      'x-test-tenant': 'tenant-a',
      'content-type': 'application/json',
    };
    const list = await testServer.request('/api/project-content', { headers });
    const update = await testServer.request('/api/project-content/project-a', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Updated' }),
    });
    const remove = await testServer.request('/api/project-content/project-a', {
      method: 'DELETE',
      headers,
    });

    expect(list.status).toBe(200);
    expect(update.status).toBe(200);
    expect(remove.status).toBe(200);
    expect(publicProjectContentRepository.findForTenant).toHaveBeenCalledWith('tenant-a');
    expect(publicProjectContentRepository.update).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      'project-a',
      { name: 'Updated' },
    );
    expect(publicProjectContentRepository.remove).toHaveBeenCalledWith('tenant-a', 'project-a');
  });

  it('passes the authenticated tenant to every CMS operation and does not leak another tenant', async () => {
    publicProjectContentRepository.findForTenant
      .mockResolvedValueOnce([{ id: 'project-a', tenantId: 'tenant-a' }])
      .mockResolvedValueOnce(null);
    publicProjectContentRepository.update.mockResolvedValueOnce(null);
    publicProjectContentRepository.remove.mockResolvedValueOnce(false);

    const tenantAHeaders = {
      'x-test-role': 'ADMIN',
      'x-test-tenant': 'tenant-a',
      'content-type': 'application/json',
    };
    const tenantBHeaders = {
      'x-test-role': 'ADMIN',
      'x-test-tenant': 'tenant-b',
      'content-type': 'application/json',
    };

    const tenantA = await testServer.request('/api/project-content/project-a', {
      headers: tenantAHeaders,
    });
    const tenantB = await testServer.request('/api/project-content/project-a', {
      headers: tenantBHeaders,
    });
    const update = await testServer.request('/api/project-content/project-a', {
      method: 'PUT',
      headers: tenantBHeaders,
      body: JSON.stringify({ name: 'Should not update tenant A' }),
    });
    const remove = await testServer.request('/api/project-content/project-a', {
      method: 'DELETE',
      headers: tenantBHeaders,
    });

    expect(tenantA.status).toBe(200);
    expect(tenantB.status).toBe(404);
    expect(update.status).toBe(404);
    expect(remove.status).toBe(200);
    expect(await json(remove)).toEqual({ deleted: false });
    expect(publicProjectContentRepository.findForTenant).toHaveBeenNthCalledWith(
      1, 'tenant-a', 'project-a',
    );
    expect(publicProjectContentRepository.findForTenant).toHaveBeenNthCalledWith(
      2, 'tenant-b', 'project-a',
    );
    expect(publicProjectContentRepository.update).toHaveBeenCalledWith(
      'tenant-b',
      'user-1',
      'project-a',
      { name: 'Should not update tenant A' },
    );
    expect(publicProjectContentRepository.remove).toHaveBeenCalledWith('tenant-b', 'project-a');
  });

  it('normalizes valid create input and returns a conflict for a duplicate slug', async () => {
    publicProjectContentRepository.create.mockResolvedValueOnce({
      id: 'project-a',
      slug: 'my-project',
      name: 'My project',
      status: 'DRAFT',
    });

    const create = await testServer.request('/api/project-content', {
      method: 'POST',
      headers: {
        'x-test-role': 'MARKETING',
        'x-test-tenant': 'tenant-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        slug: ' My-Project ',
        name: ' My project ',
        content: { summary: 'Draft content' },
      }),
    });

    expect(create.status).toBe(201);
    expect(await json(create)).toMatchObject({ slug: 'my-project', name: 'My project' });
    expect(publicProjectContentRepository.create).toHaveBeenCalledWith(
      'tenant-a',
      'user-1',
      {
        slug: 'my-project',
        name: 'My project',
        content: { summary: 'Draft content' },
      },
    );

    const duplicateError = Object.assign(new Error('duplicate'), { code: '23505' });
    publicProjectContentRepository.create.mockRejectedValueOnce(duplicateError);
    const duplicate = await testServer.request('/api/project-content', {
      method: 'POST',
      headers: {
        'x-test-role': 'SALES',
        'x-test-tenant': 'tenant-a',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ slug: 'my-project', name: 'Another project' }),
    });

    expect(duplicate.status).toBe(409);
    expect(await json(duplicate)).toEqual({ error: 'Slug đã tồn tại trong workspace' });
  });

  it('keeps drafts out of public list/detail and exposes published content in both', async () => {
    publicProjectContentRepository.findPublished.mockResolvedValue([
      {
        id: 'published-project',
        slug: 'published-project',
        name: 'Published project',
        status: 'PUBLISHED',
      },
    ]);

    const list = await testServer.request('/api/project-content/published');
    const published = await testServer.request('/api/project-content/published/published-project');
    const draft = await testServer.request('/api/project-content/published/draft-project');

    expect(list.status).toBe(200);
    expect(await json(list)).toEqual({
      data: [{
        id: 'published-project',
        slug: 'published-project',
        name: 'Published project',
        status: 'PUBLISHED',
      }],
    });
    expect(published.status).toBe(200);
    expect(await json(published)).toMatchObject({
      slug: 'published-project',
      status: 'PUBLISHED',
    });
    expect(draft.status).toBe(404);
    expect(publicProjectContentRepository.findPublished).toHaveBeenCalledTimes(3);
  });

  it('supports the full managed CRUD lifecycle, including publish and unpublish', async () => {
    publicProjectContentRepository.create.mockResolvedValueOnce({
      id: 'project-a',
      tenantId: 'tenant-a',
      slug: 'project-a',
      name: 'Project A',
      status: 'DRAFT',
    });
    publicProjectContentRepository.findForTenant
      .mockResolvedValueOnce([{ id: 'project-a', status: 'DRAFT' }])
      .mockResolvedValueOnce({ id: 'project-a', status: 'DRAFT' })
      .mockResolvedValueOnce({ id: 'project-a', status: 'PUBLISHED' })
      .mockResolvedValueOnce({ id: 'project-a', status: 'DRAFT' });
    publicProjectContentRepository.update
      .mockResolvedValueOnce({ id: 'project-a', status: 'PUBLISHED' })
      .mockResolvedValueOnce({ id: 'project-a', status: 'DRAFT' });
    publicProjectContentRepository.remove.mockResolvedValueOnce(true);

    const headers = {
      'x-test-role': 'ADMIN',
      'x-test-tenant': 'tenant-a',
      'content-type': 'application/json',
    };
    const create = await testServer.request('/api/project-content', {
      method: 'POST',
      headers,
      body: JSON.stringify({ slug: 'project-a', name: 'Project A' }),
    });
    const list = await testServer.request('/api/project-content', { headers });
    const detail = await testServer.request('/api/project-content/project-a', { headers });
    const publish = await testServer.request('/api/project-content/project-a', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const publishedDetail = await testServer.request('/api/project-content/project-a', {
      headers,
    });
    const unpublish = await testServer.request('/api/project-content/project-a', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: 'DRAFT' }),
    });
    const remove = await testServer.request('/api/project-content/project-a', {
      method: 'DELETE',
      headers,
    });

    expect(create.status).toBe(201);
    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(publish.status).toBe(200);
    expect(publishedDetail.status).toBe(200);
    expect(unpublish.status).toBe(200);
    expect(remove.status).toBe(200);
    expect(await json(publish)).toEqual({ id: 'project-a', status: 'PUBLISHED' });
    expect(await json(unpublish)).toEqual({ id: 'project-a', status: 'DRAFT' });
    expect(await json(remove)).toEqual({ deleted: true });
  });
});