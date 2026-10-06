/**
 * Textele legale din aplicație — **provizorii (lorem ipsum)** până la revizuirea juridică (Q-011).
 * Nu sunt text legal valid: înlocuiește-le înainte de publicare. Aceleași texte stau și în
 * `apps/client/public/privacy.html` și `terms.html` (linkuri pentru store).
 */
export interface LegalPage {
  title: string;
  sections: { h: string; p: string }[];
}

export const LEGAL_PLACEHOLDER =
  'PLACEHOLDER — not final legal text. To be replaced after legal review before release.';

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

export const LEGAL: Record<'privacy' | 'terms', LegalPage> = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { h: 'Who we are', p: LOREM },
      { h: 'What data we keep', p: LOREM },
      { h: 'How long we keep it', p: LOREM },
      { h: 'Your rights and deleting your account', p: LOREM },
      { h: 'Children', p: LOREM },
      { h: 'Contact', p: LOREM },
    ],
  },
  terms: {
    title: 'Terms of Use',
    sections: [
      { h: 'Using the game', p: LOREM },
      { h: 'Accounts and progress', p: LOREM },
      { h: 'Fair play', p: LOREM },
      { h: 'Changes and contact', p: LOREM },
    ],
  },
};
