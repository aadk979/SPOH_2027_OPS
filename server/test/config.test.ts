import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = { DATABASE_URL: 'postgres://x' };

describe('loadConfig', () => {
  it('uses the URL Render injects for CORS and email links', () => {
    const config = loadConfig({ ...base, RENDER_EXTERNAL_URL: 'https://ops.onrender.com' });
    expect(config.APP_ORIGIN).toBe('https://ops.onrender.com');
    expect(config.PUBLIC_APP_URL).toBe('https://ops.onrender.com');
  });

  it('lets explicit values win over the Render URL (e.g. a custom domain)', () => {
    const config = loadConfig({
      ...base,
      RENDER_EXTERNAL_URL: 'https://ops.onrender.com',
      PUBLIC_APP_URL: 'https://ops.example.org',
      APP_ORIGIN: '',
    });
    expect(config.PUBLIC_APP_URL).toBe('https://ops.example.org');
    expect(config.APP_ORIGIN).toBe('https://ops.onrender.com');
  });

  it('fails fast without a database URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
