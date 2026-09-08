import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VISITOR_KEY = 'visitor-gallery-test';
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const {
  query,
  withTenantContext,
  storeFile,
  deleteFile,
  recordAudit,
} = vi.hoisted(() => ({
  query: vi.fn(),
  withTenantContext: vi.fn(),
  storeFile: vi.fn(),
  deleteFile: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('../db', () => ({ withTenantContext }));
vi.mock('../services/storageService', () => ({ storeFile, deleteFile }));
vi.mock('../repositories/agentAuditRepository', () => ({
  agentAuditRepository: { record: recordAudit },
}));

import { createLandingPagesRoutes } from '../routes/landingPagesRoutes';

type GalleryPage = {
  id: string;
  tenant_id: string;
  visitor_key: string;
  slug: string;
  sections: Array<Record<string, unknown>>;
};

function makePage(images: string[] = []): GalleryPage {
  return {
    id: 'landing-page-1',
    tenant_id: DEFAULT_TENANT_ID,
    visitor_key: VISITOR_KEY,
    slug: 'gallery-test',
    sections: [{
      stage: 'gallery',
      title: 'Project gallery',
      items: [],
      images,
      tokens: 0,
    }],
  };
}

function appendFile(form: FormData, name: string, type = 'image/png', contents = VALID_PNG) {
  form.append('files', new Blob([new Uint8Array(contents)], { type }), name);
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/landing-pages', createLandingPagesRoutes());

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    server,
    request: (path: string, init: RequestInit = {}) =>
      fetch(`http://127.0.0.1:${port}${path}`, init),
  };
}

async function responseJson(response: Response): Promise<Record<string, any>> {
  return response.json() as Promise<Record<string, any>>;
}

describe('landing gallery image API validation and cleanup', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;
  let page: GalleryPage;
  let updatedSections: GalleryPage['sections'];

  beforeEach(async () => {
    vi.clearAllMocks();
    page = makePage();
    updatedSections = page.sections;

    withTenantContext.mockImplementation(async (
      _tenantId: string,
      callback: (client: { query: typeof query }) => Promise<unknown>,
    ) => callback({ query }));
    query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT')) return { rows: [page] };
      if (sql.startsWith('UPDATE')) {
        updatedSections = JSON.parse(String(params[0]));
        return { rows: [{ ...page, sections: updatedSections }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    storeFile.mockImplementation(async (_tenantId: string, filename: string) =>
      `/uploads/${DEFAULT_TENANT_ID}/${filename}`);
    deleteFile.mockResolvedValue(undefined);
    recordAudit.mockResolvedValue(undefined);
    testServer = await startTestServer();
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      testServer.server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('rejects an unsupported MIME before loading the owned page', async () => {
    const form = new FormData();
    form.append('visitorKey', VISITOR_KEY);
    appendFile(form, 'document.txt', 'text/plain');

    const response = await testServer.request('/api/landing-pages/gallery-test/images', {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(415);
    expect(await responseJson(response)).toEqual({
      error: 'Chi chap nhan anh JPEG, PNG, WebP hoac GIF',
    });
    expect(query).not.toHaveBeenCalled();
    expect(storeFile).not.toHaveBeenCalled();
  });

  it('rejects image MIME values whose bytes are not a real image', async () => {
    const form = new FormData();
    form.append('visitorKey', VISITOR_KEY);
    appendFile(form, 'spoofed.png', 'image/png', Buffer.from('not an image'));

    const response = await testServer.request('/api/landing-pages/gallery-test/images', {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(415);
    expect(await responseJson(response)).toEqual({
      error: 'Khong co anh hop le nao duoc tai len',
      rejected: ['spoofed.png'],
    });
    expect(storeFile).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('enforces the configured 10MB per-file limit', async () => {
    const form = new FormData();
    form.append('visitorKey', VISITOR_KEY);
    appendFile(form, 'too-large.png', 'image/png', Buffer.alloc(10 * 1024 * 1024 + 1));

    const response = await testServer.request('/api/landing-pages/gallery-test/images', {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(413);
    expect(await responseJson(response)).toEqual({
      error: 'Anh qua lon (toi da 10MB moi anh)',
    });
    expect(query).not.toHaveBeenCalled();
    expect(storeFile).not.toHaveBeenCalled();
  });

  it('enforces the configured 10-file per-request limit', async () => {
    const form = new FormData();
    form.append('visitorKey', VISITOR_KEY);
    for (let index = 0; index < 11; index += 1) {
      appendFile(form, `image-${index}.png`);
    }

    const response = await testServer.request('/api/landing-pages/gallery-test/images', {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(400);
    expect(await responseJson(response)).toEqual({
      error: 'Chi duoc tai toi da 10 anh moi lan',
    });
    expect(query).not.toHaveBeenCalled();
    expect(storeFile).not.toHaveBeenCalled();
  });

  it('uploads valid files, returns updated sections, and names files rejected by gallery capacity', async () => {
    const existingImages = Array.from(
      { length: 19 },
      (_, index) => `/uploads/${DEFAULT_TENANT_ID}/existing-${index}.webp`,
    );
    page = makePage(existingImages);
    const form = new FormData();
    form.append('visitorKey', VISITOR_KEY);
    appendFile(form, 'accepted.png');
    appendFile(form, 'gallery-capacity.png');

    const response = await testServer.request('/api/landing-pages/gallery-test/images', {
      method: 'POST',
      body: form,
    });
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect(body.uploaded).toBe(1);
    expect(body.rejected).toEqual(['gallery-capacity.png (da dat toi da 20 anh)']);
    expect(body.page.sections).toEqual(updatedSections);
    expect(body.page.sections[0].images).toHaveLength(20);
    expect(body.page.sections[0].images).toEqual([
      ...existingImages,
      expect.stringMatching(new RegExp(`^/uploads/${DEFAULT_TENANT_ID}/.+\\.webp$`)),
    ]);
    expect(storeFile).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('removes an owned upload from sections and requests cleanup without touching unrelated URLs', async () => {
    const ownedUrl = `/uploads/${DEFAULT_TENANT_ID}/owned.webp`;
    const otherOwnedUrl = `/uploads/${DEFAULT_TENANT_ID}/keep.webp`;
    const externalUrl = 'https://cdn.example.test/unrelated.webp';
    page = makePage([ownedUrl, otherOwnedUrl, externalUrl]);

    const response = await testServer.request('/api/landing-pages/gallery-test/images', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorKey: VISITOR_KEY, url: ownedUrl }),
    });
    const body = await responseJson(response);
    await Promise.resolve();

    expect(response.status).toBe(200);
    expect(body.page.sections[0].images).toEqual([otherOwnedUrl, externalUrl]);
    expect(deleteFile).toHaveBeenCalledTimes(1);
    expect(deleteFile).toHaveBeenCalledWith(DEFAULT_TENANT_ID, 'owned.webp');
    expect(deleteFile).not.toHaveBeenCalledWith(DEFAULT_TENANT_ID, 'keep.webp');
    expect(deleteFile).not.toHaveBeenCalledWith(
      DEFAULT_TENANT_ID,
      'https://cdn.example.test/unrelated.webp',
    );
  });
});