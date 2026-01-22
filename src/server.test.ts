import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { app } from './server.js';

async function requestApp(method: string, url: string, body?: Record<string, unknown>) {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = {
    'content-type': 'application/json'
  };

  if (body) {
    const json = JSON.stringify(body);
    req.headers['content-length'] = Buffer.byteLength(json).toString();
    req.push(json);
  }
  req.push(null);

  const res = new ServerResponse(req);

  const chunks: Buffer[] = [];
  // Capture output without needing a real socket.
  res.write = ((chunk: unknown) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    return true;
  }) as ServerResponse['write'];
  res.end = ((chunk?: unknown) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }
    res.emit('finish');
    return res;
  }) as ServerResponse['end'];

  const done = new Promise<{ statusCode: number; body: unknown }>((resolve) => {
    res.on('finish', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed: unknown = raw;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = raw;
      }
      resolve({ statusCode: res.statusCode, body: parsed });
    });
  });

  app.handle(req, res);
  return done;
}

describe('server API', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts UTC to local time (toLocal requires Z)', async () => {
    const res = await requestApp('POST', '/api/convert', {
      time: '2026-01-21T21:07:00Z',
      timezone: 'America/Denver',
      direction: 'toLocal'
    });

    expect(res.statusCode).toBe(200);
    const data = res.body as { utcISO: string; timezone: string };
    expect(data.utcISO).toBe('2026-01-21T21:07:00.000Z');
    expect(data.timezone).toBe('America/Denver');
  });

  it('converts local time to UTC (toUTC forbids Z)', async () => {
    const res = await requestApp('POST', '/api/convert', {
      time: '2026-01-21T21:07',
      timezone: 'America/Denver',
      direction: 'toUTC'
    });

    expect(res.statusCode).toBe(200);
    const data = res.body as { utcISO: string };
    expect(data.utcISO).toBe('2026-01-22T04:07:00.000Z');
  });

  it('rejects invalid input formats', async () => {
    const toLocal = await requestApp('POST', '/api/convert', {
      time: '2026-01-21T21:07',
      timezone: 'America/Denver',
      direction: 'toLocal'
    });

    expect(toLocal.statusCode).toBe(400);
    expect((toLocal.body as { error: string }).error).toMatch(/offset|Z/i);

    const toUtc = await requestApp('POST', '/api/convert', {
      time: '2026-01-21T21:07:00Z',
      timezone: 'America/Denver',
      direction: 'toUTC'
    });

    expect(toUtc.statusCode).toBe(400);
    expect((toUtc.body as { error: string }).error).toMatch(/offset|Z/i);
  });

  it('resolves single-timezone states without external lookup', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const res = await requestApp('GET', '/api/location?q=Montana');
    expect(res.statusCode).toBe(200);
    expect((res.body as { timezone: string }).timezone).toBe('America/Denver');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses fallback timezones when Intl.supportedValuesOf is unavailable', async () => {
    const original = Intl.supportedValuesOf;
    // @ts-expect-error: testing fallback behavior
    Intl.supportedValuesOf = undefined;

    const res = await requestApp('GET', '/api/timezones');
    expect(res.statusCode).toBe(200);
    expect(res.body as string[]).toContain('UTC');

    Intl.supportedValuesOf = original;
  });

  it('geocodes locations via Nominatim when needed', async () => {
    const mockResponse = new Response(
      JSON.stringify([
        {
          lat: '39.7392',
          lon: '-104.9903',
          display_name: 'Denver, Colorado, USA'
        }
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const res = await requestApp('GET', '/api/location?q=Denver');
    expect(res.statusCode).toBe(200);
    expect((res.body as { displayName: string }).displayName).toMatch(/Denver/);
    expect((res.body as { timezone: string }).timezone).toBe('America/Denver');
  });
});
