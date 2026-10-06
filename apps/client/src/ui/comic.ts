import type { UiSound } from '../audio/sfx.ts';
import { h } from './dom.ts';

/**
 * Componentele de bază ale interfeței „Comic” (`docs/design/ui.md`, „Componente”):
 * titlu de pagină, butoane, panouri, casete, balon, ștampilă ON/OFF, selector segmentat, explozie.
 * Stilurile sunt în `styles.css`; aici doar markup-ul.
 */

type Child = Node | string | null | undefined | false;
type Attrs = Parameters<typeof h>[1];

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(view: string, inner: string, cls = 'ico'): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', view);
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = inner;
  return s;
}

export const icon = {
  back: () => svg('0 0 24 24', '<path d="M15 5l-7 7 7 7"/>', 'ico thick'),
  next: () => svg('0 0 24 24', '<path d="M9 5l7 7-7 7"/>', 'ico thick'),
  gear: () =>
    svg(
      '0 0 24 24',
      '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    ),
  pause: () => svg('0 0 24 24', '<path d="M8 5v14M16 5v14"/>', 'ico pause'),
  /** Cameră video („Save clip”). */
  clip: () =>
    svg('0 0 24 24', '<rect x="3" y="7" width="12" height="10" rx="1"/><path d="M15 11l6-3v8l-6-3z"/>'),
  heart: () =>
    svg('0 0 24 22', '<path d="M12 21 L2 10 a5.5 5.5 0 0 1 10 -5 a5.5 5.5 0 0 1 10 5z"/>', 'heart'),
};

/** Steaua neregulată a exploziei („burst”), cu onomatopee peste ea (în CSS). */
export function burst(cls = 'burst'): SVGSVGElement {
  return svg(
    '0 0 200 200',
    '<path d="M100 0 L120 45 L165 20 L150 68 L200 80 L158 108 L190 150 L140 142 L135 195 L100 155 L62 195 L60 142 L8 150 L42 108 L0 80 L50 68 L35 20 L80 45 Z"/>',
    cls,
  );
}

/** Butonul pătrat de 46px („Back”, setări). */
export function sq(ico: SVGSVGElement, label: string, onclick: () => void, attrs: Attrs = {}): HTMLElement {
  return h('button', { class: 'sq', 'aria-label': label, onclick, ...attrs }, ico);
}

/** Antetul paginii: „Back”, titlul înclinat, apoi restul (aliniat la dreapta cu `.push`). */
export function head(title: Child, back: (() => void) | null, ...rest: Child[]): HTMLElement {
  return h(
    'div',
    { class: 'head' },
    back && sq(icon.back(), 'Back', back, { 'data-test': 'back' }),
    h('h1', { class: 'ptitle' }, title),
    ...rest,
  );
}

export type BtnKind = 'main' | 'sec' | 'cyan';

/** Buton înclinat: `main` roșu (acțiunea principală), `sec` alb, `cyan`. */
export function btn(
  kind: BtnKind,
  label: Child | Child[],
  onclick: (() => void) | null,
  attrs: Attrs = {},
): HTMLElement {
  const cls = `b ${kind}` + (attrs.class ? ` ${String(attrs.class)}` : '');
  const kids = Array.isArray(label) ? label : [label];
  return h('button', { ...attrs, class: cls, onclick: onclick ?? undefined }, ...kids);
}

/** Casetă de narator (italic) sau de informații (`label` îngroșat). */
export function caption(text: Child, label?: string, cls = ''): HTMLElement {
  return h(
    'div',
    { class: (label ? 'cap info' : 'cap') + (cls ? ' ' + cls : '') },
    label ? h('b', {}, label + ' ') : null,
    text,
  );
}

/** Balon de vorbire (colțul ascuțit jos-stânga). */
export function say(text: string, cls = ''): HTMLElement {
  return h('div', { class: 'say' + (cls ? ' ' + cls : ''), 'aria-live': 'polite' }, text);
}

/** Ștampilă mică: „NEW!”, „PICKED!”, „READY!”, „YOURS!”. */
export function tag(text: string, cls = ''): HTMLElement {
  return h('span', { class: 'tag' + (cls ? ' ' + cls : '') }, text);
}

/** Panou alb (sau cyan cu raze) cu contur gros, ușor rotit. */
export function panel(cls: string, ...kids: Child[]): HTMLElement {
  return h('div', { class: 'panel ' + cls }, ...kids);
}

/** Razele din spatele personajelor (se rotesc foarte lent). */
export function rays(): HTMLElement {
  return h('div', { class: 'rays', 'aria-hidden': 'true' });
}

/** Comutator cu ștampilă ON/OFF (Settings, Pause). */
export function stampSwitch(
  label: string,
  hint: string | null,
  on: boolean,
  flip: () => void,
  attrs: Attrs = {},
): HTMLElement {
  return h(
    'button',
    {
      class: 'switch',
      role: 'switch',
      'aria-checked': String(on),
      'data-fx': 'stamp',
      onclick: flip,
      ...attrs,
    },
    h('span', { class: 'sw-txt' }, h('b', {}, label), hint ? h('small', {}, hint) : null),
    h('span', { class: 'stamp' + (on ? ' on' : ' off') }, on ? 'ON' : 'OFF'),
  );
}

/** Selector segmentat: celule lipite, cea aleasă neagră cu text galben. */
export function seg<T extends string>(
  label: string,
  items: readonly (readonly [T, string])[],
  cur: T | undefined,
  pick: (v: T) => void,
  attr = 'data-v',
  disabled = false,
): HTMLElement {
  return h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': label, style: `--n:${items.length}` },
    ...items.map(([v, l]) =>
      h('button', { [attr]: v, 'aria-pressed': String(v === cur), disabled, onclick: () => pick(v) }, l),
    ),
  );
}

/** Pastila cu Fitile. */
export function coins(n: number): HTMLElement {
  return h(
    'div',
    { class: 'coins' },
    h('i'),
    h('span', { 'data-test': 'coins' }, String(n)),
    h('small', {}, 'Fitile'),
  );
}

/* ---------- răspunsul la apăsare ---------- */

export interface PressHooks {
  sound(k: UiSound): void;
  vibrate(p: number | number[]): void;
  /** Ai apăsat ceva blocat (după scuturare). */
  locked(el: HTMLElement): void;
  /** Ultima atingere, pentru privirea personajului. */
  touched(x: number, y: number): void;
}

/** Elementele cu răspuns la apăsare (butoanele de joc din HUD au răspunsul lor). */
const PRESSABLE = 'button, a[href], .press';

function kindOf(el: HTMLElement): 'main' | 'sec' | 'pick' | 'stamp' | 'none' {
  const fx = el.dataset.fx;
  if (fx === 'none' || fx === 'stamp' || fx === 'main' || fx === 'pick' || fx === 'sec') return fx;
  if (el.classList.contains('main')) return 'main';
  if (el.hasAttribute('aria-pressed')) return 'pick';
  return 'sec';
}

/**
 * Răspunsul la apăsare, pentru toată interfața (`docs/design/ui.md`, „Interacțiune”):
 * vizual la `pointerdown` (clasa `down`, scoasă la ridicare), sunet și vibrație după tipul
 * elementului; elementele blocate (`.locked`) se scutură, nu execută nimic și fac „nope”.
 */
export function installPress(root: HTMLElement, hooks: PressHooks): void {
  let downEl: HTMLElement | null = null;
  const release = () => {
    downEl?.classList.remove('down');
    downEl = null;
  };
  root.addEventListener(
    'pointerdown',
    (e) => {
      hooks.touched(e.clientX, e.clientY);
      const el = (e.target as HTMLElement).closest<HTMLElement>(PRESSABLE);
      if (!el || !root.contains(el) || el.closest('.ctl')) return;
      if ((el as HTMLButtonElement).disabled || el.classList.contains('locked')) return;
      const k = kindOf(el);
      if (k === 'none') return;
      release();
      downEl = el;
      el.classList.add('down');
      if (k === 'main') {
        hooks.sound('pop');
        hooks.vibrate(12);
      } else if (k === 'pick') {
        hooks.sound('pick');
        hooks.vibrate(10);
      } else if (k === 'sec') {
        hooks.sound('tick');
        hooks.vibrate(8);
      }
    },
    { capture: true },
  );
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const)
    root.addEventListener(ev, (e) => (ev !== 'pointerleave' || e.target === downEl) && release(), {
      capture: true,
    });
  root.addEventListener(
    'click',
    (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.locked');
      if (!el || !root.contains(el)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      el.classList.remove('shake');
      void el.offsetWidth;
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 260);
      hooks.sound('nope');
      hooks.vibrate([20, 40, 20]);
      hooks.locked(el);
    },
    { capture: true },
  );
}

/** Marchează un element blocat: vizibil, cu cerința pe el, dar nu execută nimic (D-040). */
export function lock<T extends HTMLElement>(el: T, locked: boolean): T {
  if (locked) {
    el.classList.add('locked');
    el.setAttribute('aria-disabled', 'true');
  }
  return el;
}
