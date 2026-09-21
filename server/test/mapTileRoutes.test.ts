import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapTileRouter, type FetchLike } from '../routes/mapTileRoutes';

const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function startTestServer(fetchMock: FetchLike & ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(createMapTileRouter(fetchMock));
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    server,
    request: (path: string) => fetch(`http://127.0.0.1:${port}${path}`),
  };
}

describe('map tile proxy', () => {
  let testServer: Awaited<ReturnType<typeof startTestServer>>;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => testServer?.server.close(() => resolve()));
  });

  it('does not relay a 200 PNG API-key placeholder', async () => {
    const placeholder = Buffer.concat([VALID_PNG, Buffer.from('API KEY REQUIRED')]);
    const fetchMock = vi.fn<FetchLike>()
      .mockResolvedValueOnce(new Response(placeholder, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }))
      .mockResolvedValueOnce(new Response('fallback unavailable', { status: 503 }));
    testServer = await startTestServer(fetchMock);

    const response = await testServer.request('/api/map-tiles/10/1/2.png');

    expect(response.status).toBe(502);
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('relays a valid OSM PNG tile with an image/png content type', async () => {
    const fetchMock = vi.fn<FetchLike>().mockResolvedValueOnce(new Response(VALID_PNG, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }));
    testServer = await startTestServer(fetchMock);

    const response = await testServer.request('/api/map-tiles/10/1/2.png');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^image\/png/);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VALID_PNG);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['the primary provider fails', () => Promise.reject(new Error('primary unavailable'))],
    ['the primary provider is blocked', () => Promise.resolve(new Response(
      Buffer.concat([VALID_PNG, Buffer.from('ACCESS BLOCKED')]),
      { status: 200, headers: { 'content-type': 'image/png', 'x-blocked': 'true' } },
    ))],
  ])('uses the fallback provider when %s', async (_reason, primaryResponse) => {
    const fetchMock = vi.fn<FetchLike>()
      .mockImplementationOnce(primaryResponse)
      .mockResolvedValueOnce(new Response(VALID_PNG, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }));
    testServer = await startTestServer(fetchMock);

    const response = await testServer.request('/api/map-tiles/10/1/2.png');

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VALID_PNG);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://tile.openstreetmap.de/10/1/2.png');
  });
});