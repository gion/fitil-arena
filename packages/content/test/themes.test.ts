import { describe, expect, it } from 'vitest';
import { THEMES, ThemeSchema } from '../src/index.ts';

describe('content/themes', () => {
  it('toate temele trec validarea și au id-uri unice', () => {
    for (const t of THEMES) expect(() => ThemeSchema.parse(t)).not.toThrow();
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
  });
});
