import { Hono } from 'hono';

import {
  makeRequestId,
  requestIdAndStructuredReadLog,
  type ReadPathLogLine,
} from './request-logging';

describe('worker request id + structured read-path logging', () => {
  const originalConsoleInfo = console.info;

  afterEach(() => {
    console.info = originalConsoleInfo;
  });

  it('echoes a valid incoming x-request-id and writes exactly one PII-free structured JSON log', async () => {
    const logs: string[] = [];
    console.info = jest.fn((line: string) => logs.push(line));
    const app = new Hono();
    app.use('/books/*', requestIdAndStructuredReadLog());
    app.get('/books/:id', (c) => c.json({ id: c.req.param('id') }));

    const response = await app.request('/books/book-1?token=secret&email=a@example.com', {
      headers: { 'x-request-id': 'req_1234567890abcdef' },
    });

    expect(response.headers.get('x-request-id')).toBe('req_1234567890abcdef');
    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!) as ReadPathLogLine;
    expect(parsed).toMatchObject({
      event: 'worker.read_request',
      requestId: 'req_1234567890abcdef',
      method: 'GET',
      path: '/books/book-1',
      status: 200,
    });
    expect(typeof parsed.durationMs).toBe('number');
    expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(parsed).sort()).toEqual([
      'durationMs',
      'event',
      'method',
      'path',
      'requestId',
      'status',
    ]);
    expect(logs[0]).not.toContain('secret');
    expect(logs[0]).not.toContain('a@example.com');
  });

  it('writes the same structured field names and non-negative duration for read-path error responses', async () => {
    const logs: string[] = [];
    console.info = jest.fn((line: string) => logs.push(line));
    const app = new Hono();
    app.use('/chapters/*', requestIdAndStructuredReadLog());
    app.onError((error, c) => c.json({ error: error.message }, 503));
    app.get('/chapters/:id', () => {
      throw new Error('R2 unavailable');
    });

    const response = await app.request('/chapters/chapter-1?token=secret', {
      headers: { 'x-request-id': 'req_error_12345678' },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('x-request-id')).toBe('req_error_12345678');
    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]!) as ReadPathLogLine;
    expect(parsed).toMatchObject({
      event: 'worker.read_request',
      requestId: 'req_error_12345678',
      method: 'GET',
      path: '/chapters/chapter-1',
      status: 503,
    });
    expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
    expect(Object.keys(parsed).sort()).toEqual([
      'durationMs',
      'event',
      'method',
      'path',
      'requestId',
      'status',
    ]);
    expect(logs[0]).not.toContain('secret');
  });

  it('replaces missing or invalid request ids', async () => {
    expect(makeRequestId(undefined)).toMatch(/^req_[a-z0-9]{24}$/);
    expect(makeRequestId('bad id with spaces')).toMatch(/^req_[a-z0-9]{24}$/);
    expect(makeRequestId('req_valid-123')).toBe('req_valid-123');
  });
});
