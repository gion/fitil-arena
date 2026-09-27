import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';

describe('api', () => {
  it('/health răspunde', async () => {
    const res = await buildApp().inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, tickHz: 20 });
  });
});
