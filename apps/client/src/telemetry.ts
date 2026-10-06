import { platform } from './native.ts';

/*
 * Analytics (PostHog) și raportarea erorilor (Sentry) — Faza 8, D-075.
 * Clienți mici peste API-urile HTTP publice ale celor două servicii, în loc de SDK-uri (~100 KB împreună).
 * Fără chei în `.env` (VITE_POSTHOG_KEY, VITE_SENTRY_DSN) nu se trimite nimic. Date trimise: un id anonim
 * al instalării (aleator, local), platforma, versiunea și evenimentele de mai jos; fără nume, cont sau IP
 * păstrat (PostHog: „Discard client IP data” activat în proiect, vezi docs/store-checklist.md).
 */

const env = import.meta.env;
const PH_KEY = env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST = ((env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com').replace(
  /\/$/,
  '',
);
const SENTRY_DSN = env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = `fuse-arena@${__APP_VERSION__}`;

/** Evenimentele urmărite (funnel tutorial, retenție, durata sesiunii, meciuri, viralitate). */
export type TrackEvent =
  | 'app_open'
  | 'session_end'
  | 'tutorial_step'
  | 'tutorial_done'
  | 'tutorial_fail'
  | 'match_start'
  | 'match_end'
  | 'clip_saved'
  | 'invite_shared'
  | 'invite_opened';

const ID_KEY = 'fitil-install';
const FIRST_KEY = 'fitil-first-open';

function store(key: string, make: () => string): string {
  try {
    const v = localStorage.getItem(key);
    if (v) return v;
    const n = make();
    localStorage.setItem(key, n);
    return n;
  } catch {
    return make();
  }
}

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/** Id-ul anonim al instalării (nu e legat de cont). */
export const installId = (): string => store(ID_KEY, uuid);

/** Zilele de la prima deschidere (0 = azi): PostHog calculează retenția, asta ajută la filtre. */
function daysSinceFirst(): number {
  const first = Number(store(FIRST_KEY, () => String(Date.now())));
  return Math.max(0, Math.floor((Date.now() - first) / 86_400_000));
}

interface Queued {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

/**
 * Telemetria aplicației. `enabled` vine din Setări („Anonymous stats”); cu el oprit nu pleacă nimic,
 * nici erorile.
 */
export class Telemetry {
  enabled = true;
  private queue: Queued[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sessionStart = Date.now();
  private hiddenAt: number | null = null;
  private errors = 0;
  private seenErrors = new Set<string>();

  get analytics(): boolean {
    return this.enabled && !!PH_KEY;
  }

  get crashes(): boolean {
    return this.enabled && !!SENTRY_DSN;
  }

  /** Pornește sesiunea și ascultă erorile neprinse. */
  init(): void {
    this.track('app_open', { days_since_first: daysSinceFirst() });
    window.addEventListener('error', (e) => this.error(e.error ?? e.message));
    window.addEventListener('unhandledrejection', (e) => this.error(e.reason));
  }

  /** Aplicația trece în fundal: după 30s în fundal sesiunea se încheie. */
  background(): void {
    this.hiddenAt = Date.now();
    this.flush(true);
  }

  foreground(): void {
    if (this.hiddenAt !== null && Date.now() - this.hiddenAt > 30_000) {
      this.track(
        'session_end',
        { duration_s: Math.round((this.hiddenAt - this.sessionStart) / 1000) },
        this.hiddenAt,
      );
      this.flush(true);
      this.sessionStart = Date.now();
      this.track('app_open', { days_since_first: daysSinceFirst() });
    }
    this.hiddenAt = null;
  }

  track(event: TrackEvent, props: Record<string, unknown> = {}, at = Date.now()): void {
    if (!this.analytics) return;
    this.queue.push({
      event,
      timestamp: new Date(at).toISOString(),
      properties: {
        distinct_id: installId(),
        $process_person_profile: false,
        platform,
        app_version: __APP_VERSION__,
        ...props,
      },
    });
    if (this.queue.length >= 20) this.flush();
    else this.timer ??= setTimeout(() => this.flush(), 10_000);
  }

  /** Trimite coada (la ieșire cu `sendBeacon`, ca să plece și când pagina se închide). */
  flush(leaving = false): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.queue.length || !PH_KEY) return;
    const body = JSON.stringify({ api_key: PH_KEY, batch: this.queue.splice(0) });
    const url = `${PH_HOST}/batch/`;
    if (leaving && navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  /** O eroare neprinsă → Sentry (cel mult 10 pe sesiune, fără duplicate). */
  error(err: unknown): void {
    if (!this.crashes || this.errors >= 10) return;
    const e = err instanceof Error ? err : new Error(String(err));
    const sig = `${e.name}:${e.message}`;
    if (this.seenErrors.has(sig)) return;
    this.seenErrors.add(sig);
    this.errors++;
    const req = sentryRequest(SENTRY_DSN!, e);
    if (req) void fetch(req.url, { method: 'POST', body: req.body, keepalive: true }).catch(() => {});
  }
}

/** Cadrele unei stive JS (Chrome / Safari / Firefox), de la cel mai vechi la cel mai nou (cum vrea Sentry). */
export function parseStack(
  stack: string | undefined,
): { function: string; filename: string; lineno: number; colno: number }[] {
  const out: { function: string; filename: string; lineno: number; colno: number }[] = [];
  for (const line of (stack ?? '').split('\n')) {
    const m =
      /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line) ?? /^(.*?)@(.+?):(\d+):(\d+)$/.exec(line);
    if (m) out.push({ function: m[1] || '?', filename: m[2]!, lineno: Number(m[3]), colno: Number(m[4]) });
  }
  return out.reverse();
}

/** Cererea „envelope” pentru Sentry, din DSN (`https://cheie@host/proiect`). */
export function sentryRequest(dsn: string, e: Error): { url: string; body: string } | null {
  let u: URL;
  try {
    u = new URL(dsn);
  } catch {
    return null;
  }
  const project = u.pathname.replace(/^\//, '');
  if (!u.username || !project) return null;
  const id = uuid().replace(/-/g, '');
  const now = new Date().toISOString();
  const event = {
    event_id: id,
    timestamp: now,
    platform: 'javascript',
    level: 'error',
    release: RELEASE,
    environment: import.meta.env.PROD ? 'production' : 'development',
    tags: { platform },
    user: { id: installId() },
    exception: {
      values: [{ type: e.name, value: e.message, stacktrace: { frames: parseStack(e.stack) } }],
    },
  };
  const body = [
    JSON.stringify({ event_id: id, sent_at: now, dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
  return {
    url: `${u.protocol}//${u.host}/api/${project}/envelope/?sentry_key=${u.username}&sentry_version=7`,
    body,
  };
}

export const telemetry = new Telemetry();
