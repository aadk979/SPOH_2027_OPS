import { vi } from 'vitest';

export type Handler = (body: unknown, url: URL) => { status?: number; body: unknown };

/**
 * Stubs global fetch with a table of "METHOD /path" → handler (path without /api and
 * without the query string). Unmatched requests return 404 so tests fail loudly.
 */
export function mockApi(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; url: URL; body: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/api/, '');
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, path, url, body });
    const handler = routes[`${method} ${path}`];
    const result = handler
      ? handler(body, url)
      : {
          status: 404,
          body: { error: { code: 'NOT_FOUND', message: `No mock for ${method} ${path}` } },
        };
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls };
}
