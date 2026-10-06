import {
  CHARACTERS,
  CHAR_IDS,
  CHAR_RELEASE,
  SHOP,
  THEMES,
  charById,
  defaultProfile,
  levelOf,
  playerLevel,
  seasonalTheme,
  totalXp,
  weeklyRotation,
} from '@fitil/content';
import type { Profile } from '@fitil/content';
import type { Sfx } from '../audio/sfx.ts';
import { devDate, now, setDevDate } from '../clock.ts';
import { store, today } from '../profile.ts';
import { h } from '../ui/dom.ts';

/**
 * Panoul DEV (D-039): doar în `pnpm dev` și în build-urile interne (`VITE_DEV_TOOLS=1`); în build-ul
 * public modulul nu există. Profiluri de test (jucător nou, veteran, admin) separate de profilul real,
 * data curentă mutată (teme de sezon, lansări, rotație) și câteva scurtături.
 */
export interface DevCtx {
  back: () => void;
  rerender: () => void;
  sfx: Sfx;
}

/** XP-ul total pentru un nivel de jucător dat (pus pe personajul ales). */
function xpForPlayerLevel(level: number): number {
  let xp = 0;
  while (playerLevel(xp).level < level) xp += 10;
  return xp;
}

const veteran = (): Profile => ({
  ...defaultProfile(),
  coins: 5000,
  xp: { bubu: xpForPlayerLevel(15) },
});

export function devScreen(ctx: DevCtx): HTMLElement {
  const p = store.profile;
  const date = today();
  const pl = playerLevel(totalXp(p));
  const change = (fn: (p: Profile) => Profile) => {
    store.set(fn(store.profile));
    ctx.rerender();
  };
  const btn = (label: string, onclick: () => void, test?: string) =>
    h(
      'button',
      { class: 'b sec', style: 'font-size:18px', onclick, ...(test ? { 'data-test': test } : {}) },
      label,
    );

  const profiles = h(
    'div',
    { class: 'dev-list' },
    h(
      'button',
      {
        class: 'card',
        'aria-pressed': String(!store.active),
        onclick: () => {
          store.use(null);
          ctx.rerender();
        },
      },
      'Player (real profile)',
    ),
    ...store.dev.list.map((d) =>
      h(
        'div',
        { class: 'row', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
        h(
          'button',
          {
            class: 'card',
            'aria-pressed': String(store.dev.active === d.id),
            onclick: () => {
              store.use(d.id);
              ctx.rerender();
            },
          },
          `${d.name}${d.admin ? ' · admin' : ''} · Lv ${playerLevel(totalXp(d.profile)).level}`,
        ),
        btn('✕', () => {
          store.removeDev(d.id);
          ctx.rerender();
        }),
      ),
    ),
  );

  const dateIn = h('input', { class: 'field', type: 'date', value: date, 'data-test': 'dev-date' });
  dateIn.addEventListener('change', () => {
    setDevDate(dateIn.value || null);
    ctx.rerender();
  });
  const season = seasonalTheme(now());
  const upcoming = Object.entries(CHAR_RELEASE)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, d]) => `${charById(id).name} ${d}${d <= date ? ' ✓' : ''}`);

  return h(
    'div',
    { class: 'page dev' },
    h('div', { class: 'head' }, h('h1', { class: 'ptitle' }, 'DEVELOPER')),
    h('p', {}, 'Only in internal builds. Test profiles never touch the real one.'),
    h('h2', { class: 'sub-title' }, 'Profile'),
    profiles,
    h(
      'div',
      { class: 'row', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
      btn(
        '+ New player',
        () => {
          store.addDev('New player', false);
          ctx.rerender();
        },
        'dev-new',
      ),
      btn('+ Veteran', () => {
        store.addDev('Veteran', false, veteran());
        ctx.rerender();
      }),
      btn(
        '+ Admin (all unlocked)',
        () => {
          store.addDev('Admin', true, {
            ...defaultProfile(),
            coins: 99999,
            chars: [...CHAR_IDS],
            owned: SHOP.map((i) => i.id),
            themes: THEMES.filter((t) => t.season).map((t) => t.id),
          });
          ctx.rerender();
        },
        'dev-admin',
      ),
    ),
    h(
      'p',
      {},
      `${store.label}: player Lv ${pl.level} (${totalXp(p)} XP) · ${p.coins} Fitile · ${p.chars.length}/${CHARACTERS.length} characters · ${charById(p.ch).name} Lv ${levelOf(p.xp[p.ch] ?? 0).level}`,
    ),
    h(
      'div',
      { class: 'row', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
      btn('+500 Fitile', () => change((q) => ({ ...q, coins: q.coins + 500 })), 'dev-coins'),
      btn(
        '+1 player level',
        () =>
          change((q) => {
            const need = xpForPlayerLevel(playerLevel(totalXp(q)).level + 1) - totalXp(q);
            return { ...q, xp: { ...q.xp, [q.ch]: (q.xp[q.ch] ?? 0) + need } };
          }),
        'dev-level',
      ),
      btn('+300 XP character', () =>
        change((q) => ({ ...q, xp: { ...q.xp, [q.ch]: (q.xp[q.ch] ?? 0) + 300 } })),
      ),
      btn('Unlock all characters', () => change((q) => ({ ...q, chars: [...CHAR_IDS] }))),
      btn('Own all cosmetics', () => change((q) => ({ ...q, owned: SHOP.map((i) => i.id) }))),
      btn('Reset daily bonus', () => change((q) => ({ ...q, daily: '', xpDay: {} }))),
      btn('Reset this profile', () => change(() => defaultProfile())),
    ),
    h('h2', { class: 'sub-title' }, 'Date (calendar, seasons, rotation)'),
    h(
      'div',
      { class: 'row', style: 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
      dateIn,
      btn('Today', () => {
        setDevDate(null);
        ctx.rerender();
      }),
    ),
    h(
      'p',
      {},
      `${devDate() ? 'Simulated' : 'Real'} date ${date} · season: ${season?.name ?? 'none'} · free this week: ${weeklyRotation(
        date,
      )
        .map((id) => charById(id).name)
        .join(', ')}`,
    ),
    h('p', {}, `Releases: ${upcoming.join(' · ')}`),
    h('button', { class: 'b main', 'data-test': 'dev-close', onclick: () => ctx.back() }, 'Done'),
  );
}
