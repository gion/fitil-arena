import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('location', { origin: 'https://play.example', pathname: '/', href: 'https://play.example/' });
vi.stubGlobal('__APP_VERSION__', '1.2.3');
const { deviceOf, installLinks, inviteUrl, joinCodeFrom } = await import('../src/native.ts');
const { parseStack, sentryRequest } = await import('../src/telemetry.ts');

describe('linkuri de invitație', () => {
  it('codul camerei din schema proprie, din calea web și din ?join=', () => {
    expect(joinCodeFrom('fusearena://join/abcd')).toBe('ABCD');
    expect(joinCodeFrom('https://fuse.example/join/QWER')).toBe('QWER');
    expect(joinCodeFrom('https://fuse.example/?join=zxcv&x=1')).toBe('ZXCV');
    expect(joinCodeFrom('https://fuse.example/?join=ab1d')).toBeNull();
    expect(joinCodeFrom('fusearena://join/ABCDE')).toBeNull();
    expect(joinCodeFrom('not a url')).toBeNull();
  });

  it('pe web, invitația e pagina curentă cu ?join= (și se citește înapoi)', () => {
    const url = inviteUrl('KLMN');
    expect(url).toBe('https://play.example/?join=KLMN');
    expect(joinCodeFrom(url)).toBe('KLMN');
  });
});

describe('îndemnul la instalare', () => {
  it('recunoaște telefonul', () => {
    expect(deviceOf('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe('android');
    expect(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
    expect(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });

  it('fără pagini de store nu apare', () => {
    expect(installLinks('Android')).toEqual([]);
  });
});

describe('rapoarte de erori (Sentry)', () => {
  it('stivele Chrome și Safari devin cadre, de la cel mai vechi', () => {
    const chrome =
      'Error: x\n    at boom (https://a.example/assets/index.js:10:5)\n    at https://a.example/assets/index.js:20:7';
    expect(parseStack(chrome)).toEqual([
      { function: '?', filename: 'https://a.example/assets/index.js', lineno: 20, colno: 7 },
      { function: 'boom', filename: 'https://a.example/assets/index.js', lineno: 10, colno: 5 },
    ]);
    expect(parseStack('boom@capacitor://localhost/assets/index.js:3:9')).toEqual([
      { function: 'boom', filename: 'capacitor://localhost/assets/index.js', lineno: 3, colno: 9 },
    ]);
  });

  it('cererea envelope din DSN', () => {
    const r = sentryRequest('https://abc123@o1.ingest.sentry.io/4567', new TypeError('bad'))!;
    expect(r.url).toBe('https://o1.ingest.sentry.io/api/4567/envelope/?sentry_key=abc123&sentry_version=7');
    const [head, item, ev] = r.body.split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(item).toEqual({ type: 'event' });
    expect(head!.event_id).toBe(ev!.event_id);
    expect(ev).toMatchObject({ level: 'error', release: 'fuse-arena@1.2.3' });
    expect(JSON.stringify(ev)).toContain('"type":"TypeError"');
    expect(sentryRequest('nu e un dsn', new Error('x'))).toBeNull();
  });
});
