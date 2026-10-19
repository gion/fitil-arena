/**
 * Exportă replicile de voce din `@fitil/content` într-un JSON pe care îl citește `tools/voice/omnivoice/gen.py`.
 *
 *   pnpm --filter @fitil/content exec tsx scripts/export-voice-lines.ts
 *
 * Scrie `tools/voice/omnivoice/lines.json`: { <personaj>: [{ id, kind, text }], crainic: [...] }.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BYE, CHARACTERS, HERO_LINES, MENU_LINES, charBlurb } from '../src/index.ts';

/** `key` = textul exact din conținut (cheia din manifestul clientului); `text` = varianta citită de model. */
type Line = { id: string; kind: string; key: string; text: string };

/** Modelul de voce citește mai bine ASCII simplu decât ghilimele și puncte de suspensie tipografice. */
const speakable = (s: string): string => s.replace(/[’‘]/g, "'").replace(/…/g, '...').trim();

const out: Record<string, Line[]> = {};

for (const c of CHARACTERS) {
  const lines: Line[] = [];
  const add = (kind: string, texts: readonly string[]): void => {
    texts.forEach((t, i) => lines.push({ id: `${kind}_${i + 1}`, kind, key: t, text: speakable(t) }));
  };
  add('win', c.win);
  add('quip', c.quips);
  add('kill', c.kill);
  add('bye', [BYE]);
  add('menu_fight', MENU_LINES.fight);
  add('menu_idle', MENU_LINES.idle);
  add('menu_locked', [MENU_LINES.locked]);
  add('menu_lost', [MENU_LINES.lost]);
  for (const [kind, texts] of Object.entries(HERO_LINES)) add(`hero_${kind}`, texts);
  out[c.id] = lines;
}

const announcer: Line[] = [];
const say = (id: string, text: string): void => {
  announcer.push({ id, kind: 'announcer', key: text, text });
};
say('hurry_up', 'Hurry up! The arena is shrinking!');
say('go', 'Three, two, one... go!');
say('round_over', "And that's the round, folks!");
say('champion', 'We have a champion!');
for (const c of CHARACTERS) {
  const text = charBlurb(c);
  announcer.push({ id: `desc_${c.id}`, kind: 'desc', key: text, text: speakable(text) });
}
out.crainic = announcer;

const target = fileURLToPath(new URL('../../../tools/voice/omnivoice/lines.json', import.meta.url));
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
const total = Object.values(out).reduce((n, l) => n + l.length, 0);
console.log(`${total} replici pentru ${Object.keys(out).length} voci -> ${target}`);
