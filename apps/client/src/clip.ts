import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './native.ts';

/** O înregistrare pornește din nou la fiecare `CYCLE` ms; două decalate cu jumătate de ciclu. */
const CYCLE = 20_000;
const FPS = 30;
const BITRATE = 2_000_000;
/** Clipul e o copie micșorată a arenei (lățime maximă): codarea la rezoluția ecranului ar costa FPS pe telefon. */
const MAX_W = 960;

/** Formatul video suportat: mp4 (Safari, Chrome nou), altfel webm. */
export function clipType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'])
    if (MediaRecorder.isTypeSupported(t)) return t;
  return null;
}

interface Rec {
  r: MediaRecorder;
  chunks: Blob[];
  t0: number;
}

/**
 * „Salvează clipul” (Faza 8): arena (canvasul vizibil, 2D sau 3D) se înregistrează continuu cât ești în meci.
 * Fișierele video nu se pot tăia fără re-codare, deci rulează două înregistrări decalate cu 10s, fiecare
 * repornită la 20s: la cerere se folosește cea care are între 10 și 20s (după primele 10s de meci).
 */
export class ClipRecorder {
  private recs: (Rec | null)[] = [null, null];
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** Canvasul arenei (2D sau 3D) și copia lui micșorată, din care se înregistrează. */
  private src: HTMLCanvasElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private lastCopy = 0;
  private readonly type = clipType();

  get supported(): boolean {
    return this.type !== null && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  }

  get recording(): boolean {
    return this.recs.some((r) => r !== null);
  }

  /** Pornește (sau mută pe alt canvas, ex. la schimbarea vederii). */
  start(canvas: HTMLCanvasElement): void {
    if (!this.supported) return;
    if (this.src === canvas && this.recording) return;
    this.stop();
    this.src = canvas;
    this.canvas = document.createElement('canvas');
    this.stream = this.canvas.captureStream(FPS);
    this.copy(0);
    this.cycle(0);
    this.timers.push(setTimeout(() => this.cycle(1), CYCLE / 2));
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    cancelAnimationFrame(this.raf);
    for (const r of this.recs) if (r && r.r.state !== 'inactive') r.r.stop();
    this.recs = [null, null];
    for (const tr of this.stream?.getTracks() ?? []) tr.stop();
    this.stream = null;
    this.src = null;
    this.canvas = null;
  }

  /** Copiază arena în canvasul micșorat, de cel mult `FPS` ori pe secundă. */
  private copy(t: number): void {
    const src = this.src;
    const dst = this.canvas;
    if (!src || !dst) return;
    this.raf = requestAnimationFrame((n) => this.copy(n));
    if (t - this.lastCopy < 1000 / FPS - 2 || !src.width || !src.height) return;
    this.lastCopy = t;
    const k = Math.min(1, MAX_W / src.width);
    // dimensiuni pare (cerute de unele codecuri)
    const w = Math.max(2, Math.round((src.width * k) / 2) * 2);
    const h = Math.max(2, Math.round((src.height * k) / 2) * 2);
    if (dst.width !== w || dst.height !== h) {
      dst.width = w;
      dst.height = h;
    }
    const c = dst.getContext('2d');
    if (!c) return;
    c.fillStyle = '#141726';
    c.fillRect(0, 0, w, h);
    c.drawImage(src, 0, 0, w, h);
  }

  private cycle(i: number): void {
    const old = this.recs[i];
    if (old && old.r.state !== 'inactive') old.r.stop();
    this.recs[i] = this.begin();
    this.timers.push(setTimeout(() => this.cycle(i), CYCLE));
  }

  private begin(): Rec | null {
    if (!this.stream || !this.type) return null;
    try {
      const r = new MediaRecorder(this.stream, {
        mimeType: this.type,
        videoBitsPerSecond: BITRATE,
      });
      const rec: Rec = { r, chunks: [], t0: performance.now() };
      r.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
      r.start(1000);
      return rec;
    } catch {
      return null;
    }
  }

  /** Clipul cu ultimele 10–20s (sau cât a trecut de la start). Înregistrarea folosită o ia de la capăt. */
  async take(): Promise<Blob | null> {
    const now = performance.now();
    const live = this.recs.map((r, i) => ({ r, i })).filter((x): x is { r: Rec; i: number } => x.r !== null);
    if (!live.length || !this.type) return null;
    // cea mai lungă sub un ciclu (cele două sunt decalate: una are mereu 10–20s după primele 10s)
    const pick =
      live.sort((a, b) => b.r.t0 - a.r.t0).find((x) => now - x.r.t0 >= CYCLE / 2) ?? live[live.length - 1]!;
    const done = new Promise<void>((res) => (pick.r.r.onstop = () => res()));
    pick.r.r.stop();
    await done;
    const blob = new Blob(pick.r.chunks, { type: this.type.split(';')[0] });
    this.recs[pick.i] = this.begin();
    return blob.size ? blob : null;
  }
}

/** Partajează / salvează clipul: în aplicație prin foaia de partajare a sistemului, pe web Share sau descărcare. */
export async function shareClip(blob: Blob): Promise<'shared' | 'saved'> {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const name = `fuse-arena-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${ext}`;
  if (isNative) {
    const data = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title: 'Fuse Arena clip', files: [uri] });
    return 'shared';
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Fuse Arena clip' });
    return 'shared';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'saved';
}
