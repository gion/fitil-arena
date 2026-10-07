import type { Dir } from '@fitil/sim';
import type { View } from '../settings.ts';

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 0,
  KeyW: 0,
  ArrowDown: 1,
  KeyS: 1,
  ArrowLeft: 2,
  KeyA: 2,
  ArrowRight: 3,
  KeyD: 3,
};
const JOY_MAX = 42;
const DEAD = 10;

export interface ControlEls {
  left: HTMLElement;
  right: HTMLElement;
  base: HTMLElement;
  knob: HTMLElement;
  bomb3: HTMLElement;
  det: HTMLElement;
  /** Butonul Super (cu inelul de încărcare) și butonul bombei speciale următoare. */
  sup: HTMLElement;
  spec: HTMLElement;
}

/** Glisarea în sus pe butonul BOMB (3D) schimbă bomba specială. */
const SWIPE = 36;
/** Swipe puternic pe joystick (alunecarea lui Slick): cel puțin atâția px într-o fereastră de atâtea ms. */
const FLICK_PX = 56;
const FLICK_MS = 110;
const FLICK_PAUSE_MS = 350;

/**
 * Controalele de pe ecran (după GAME_DESIGN „Interfață & controale”):
 * stânga = joystick care apare sub deget și îl urmează; dreapta = tap oriunde pune bomba (2D)
 * sau glisare pentru rotirea camerei (3D, cu buton BOMBĂ separat). Plus tastatură:
 * Space bombă, E detonator, Q Super, R schimbă bomba specială.
 */
export class Controls {
  view: View = '2d';
  enabled = false;
  /** Vectorul joystick-ului (pixeli CSS, max 42). */
  vx = 0;
  vy = 0;
  mag = 0;
  private joyId: number | null = null;
  private ox = 0;
  private oy = 0;
  private keyStack: Dir[] = [];
  readonly keys = new Set<string>();
  private lookId: number | null = null;
  private lookX = 0;
  /** Glisare orizontală acumulată (3D), consumată de cameră. */
  lookDX = 0;
  onTap: (x: number, y: number) => boolean = () => false;
  onDetonate: () => void = () => {};
  onSuper: () => void = () => {};
  onSwap: () => void = () => {};
  /** Mișcare puternică a joystick-ului (sau Shift + săgeată): alunecare. */
  onSlide: () => void = () => {};
  private trail: { t: number; x: number; y: number }[] = [];
  private lastFlick = 0;
  onFirstTouch: () => void = () => {};
  onKey: (code: string) => void = () => {};

  constructor(private el: ControlEls) {
    const { left, right, bomb3, det, sup, spec } = el;
    left.addEventListener('pointerdown', (e) => {
      // orice atingere nouă preia joystick-ul (evită blocarea când se pierde un pointerup)
      this.joyId = e.pointerId;
      try {
        left.setPointerCapture(e.pointerId);
      } catch {
        /* ignorat */
      }
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.trail = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
      this.place();
      el.base.classList.remove('hidden');
      el.knob.style.transform = 'translate(-50%,-50%)';
      this.onFirstTouch();
      this.move(e);
    });
    left.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyId) return;
      this.move(e);
      this.checkFlick(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.vx = this.vy = this.mag = 0;
      el.base.classList.add('hidden');
    };
    left.addEventListener('pointerup', end);
    left.addEventListener('pointercancel', end);
    left.addEventListener('lostpointercapture', end);

    right.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onFirstTouch();
      if (!this.enabled) return;
      if (this.view !== '2d') {
        this.lookId = e.pointerId;
        this.lookX = e.clientX;
        try {
          right.setPointerCapture(e.pointerId);
        } catch {
          /* ignorat */
        }
        return;
      }
      const ok = this.onTap(e.clientX, e.clientY);
      const r = right.getBoundingClientRect();
      const d = document.createElement('div');
      d.className = 'ripple' + (ok ? '' : ' miss');
      d.style.left = `${e.clientX - r.left}px`;
      d.style.top = `${e.clientY - r.top}px`;
      right.appendChild(d);
      setTimeout(() => d.remove(), 480);
    });
    right.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      this.lookDX += e.clientX - this.lookX;
      this.lookX = e.clientX;
    });
    const lookEnd = (e: PointerEvent) => {
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    right.addEventListener('pointerup', lookEnd);
    right.addEventListener('pointercancel', lookEnd);
    right.addEventListener('lostpointercapture', lookEnd);

    // BOMB (3D): bomba se pune la ridicarea degetului, ca glisarea în sus să poată schimba tipul
    let bombY: number | null = null;
    bomb3.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!this.enabled) return;
      bomb3.classList.add('down');
      bombY = e.clientY;
      try {
        bomb3.setPointerCapture(e.pointerId);
      } catch {
        /* ignorat */
      }
    });
    bomb3.addEventListener('pointermove', (e) => {
      if (bombY === null || bombY - e.clientY < SWIPE) return;
      bombY = null;
      bomb3.classList.remove('down');
      this.onSwap();
    });
    bomb3.addEventListener('pointerup', (e) => {
      bomb3.classList.remove('down');
      if (bombY === null || !this.enabled) return;
      bombY = null;
      this.onTap(e.clientX, e.clientY);
    });
    for (const t of ['pointercancel', 'lostpointercapture'])
      bomb3.addEventListener(t, () => {
        bombY = null;
        bomb3.classList.remove('down');
      });
    const button = (b: HTMLElement, fn: () => void) =>
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.enabled) fn();
      });
    button(sup, () => this.onSuper());
    button(spec, () => this.onSwap());
    det.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.enabled) this.onDetonate();
    });

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code in KEYMAP) {
        e.preventDefault();
        const d = KEYMAP[e.code]!;
        if (!this.keyStack.includes(d)) this.keyStack.push(d);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat && this.enabled) this.onTap(-1, -1);
      }
      if (e.code === 'KeyE' && this.enabled) this.onDetonate();
      if (e.code === 'KeyQ' && !e.repeat && this.enabled) this.onSuper();
      if (e.code === 'KeyR' && !e.repeat && this.enabled) this.onSwap();
      if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && this.enabled) this.onSlide();
      this.onKey(e.code);
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code in KEYMAP) {
        const i = this.keyStack.indexOf(KEYMAP[e.code]!);
        if (i >= 0) this.keyStack.splice(i, 1);
      }
    });
    addEventListener('blur', () => {
      this.keys.clear();
      this.keyStack = [];
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** O mișcare rapidă a degetului (cel puțin `FLICK_PX` în `FLICK_MS`) e un swipe: alunecare. */
  private checkFlick(e: PointerEvent): void {
    this.trail.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    while (this.trail.length > 1 && e.timeStamp - this.trail[0]!.t > FLICK_MS) this.trail.shift();
    const a = this.trail[0]!;
    if (Math.hypot(e.clientX - a.x, e.clientY - a.y) < FLICK_PX) return;
    if (!this.enabled || e.timeStamp - this.lastFlick < FLICK_PAUSE_MS) return;
    this.lastFlick = e.timeStamp;
    this.trail = [];
    this.onSlide();
  }

  private place(): void {
    const r = this.el.left.getBoundingClientRect();
    this.el.base.style.left = `${this.ox - r.left}px`;
    this.el.base.style.top = `${this.oy - r.top}px`;
  }

  private move(e: PointerEvent): void {
    let dx = e.clientX - this.ox;
    let dy = e.clientY - this.oy;
    const m = Math.hypot(dx, dy);
    if (m > JOY_MAX) {
      // baza urmează degetul
      this.ox += (dx / m) * (m - JOY_MAX);
      this.oy += (dy / m) * (m - JOY_MAX);
      this.place();
      dx = (dx / m) * JOY_MAX;
      dy = (dy / m) * JOY_MAX;
    }
    this.el.knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    this.vx = dx;
    this.vy = dy;
    this.mag = Math.hypot(dx, dy);
  }

  /** Ultima săgeată apăsată (tastatură). */
  keyDir(): Dir | null {
    return this.keyStack.length ? this.keyStack[this.keyStack.length - 1]! : null;
  }

  /** Vectorul de mers normalizat, în coordonate de ecran (x dreapta, y jos), sau null. */
  vector(): [number, number] | null {
    const k = this.keyDir();
    if (k !== null) return [[0, 0, -1, 1][k]!, [-1, 1, 0, 0][k]!];
    if (this.mag >= DEAD) return [this.vx / this.mag, this.vy / this.mag];
    return null;
  }

  /** Mers relativ la cameră în 3D: [înainte, dreapta] din joystick sau W/S/A/D. */
  vector3(): [number, number] | null {
    if (this.mag >= DEAD) return [-this.vy / this.mag, this.vx / this.mag];
    const k = (c: string) => (this.keys.has(c) ? 1 : 0);
    const f = Math.max(k('KeyW'), k('ArrowUp')) - Math.max(k('KeyS'), k('ArrowDown'));
    const r = k('KeyD') - k('KeyA');
    return f || r ? [f, r] : null;
  }

  /** Rotirea cu săgeți în 3D (-1 stânga, 1 dreapta). */
  turn(): number {
    return (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
  }

  reset(): void {
    this.joyId = null;
    this.lookId = null;
    this.vx = this.vy = this.mag = 0;
    this.lookDX = 0;
    this.el.base.classList.add('hidden');
  }
}

/** Joystick → direcție pe grilă (axa dominantă). */
export function quantize(v: [number, number] | null): Dir | null {
  if (!v) return null;
  const [x, y] = v;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 3 : 2) : y > 0 ? 1 : 0;
}
