import Phaser from 'phaser';
import { App } from './app.ts';
import { DPR, viewportSize } from './display.ts';
import { hideSplash } from './native.ts';
import { ArenaScene } from './render/ArenaScene.ts';
import './ui/styles.css';

// plasa de siguranță: ecranul de pornire nu rămâne blocat dacă ceva pică la încărcare
setTimeout(hideSplash, 5000);

const { width, height } = viewportSize();
const scene = new ArenaScene();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  transparent: true,
  // Canvas la rezoluție fizică, afișat la dimensiunea CSS (zoom = 1/DPR) → imagine crisp pe ecrane retina.
  scale: { mode: Phaser.Scale.NONE, width, height, zoom: 1 / DPR },
  render: { antialias: true },
  // input-ul e în DOM (#ui): joystick, tap, butoane
  input: { mouse: false, touch: false, keyboard: false, gamepad: false },
  banner: false,
  scene: [scene],
});

const onResize = () => {
  const s = viewportSize();
  game.scale.resize(s.width, s.height);
};
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);

game.events.once(Phaser.Core.Events.READY, () => {
  const app = new App(game, scene);
  // pentru testele Playwright și depanare
  (window as unknown as { __fitil: unknown }).__fitil = { app, scene, game };
  hideSplash();
});
