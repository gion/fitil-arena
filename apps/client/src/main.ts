import Phaser from 'phaser';
import { ArenaScene } from './ArenaScene.ts';
import { DPR, viewportSize } from './display.ts';

const { width, height } = viewportSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#141726',
  // Canvas la rezoluție fizică, afișat la dimensiunea CSS (zoom = 1/DPR) → imagine crisp pe ecrane retina.
  scale: { mode: Phaser.Scale.NONE, width, height, zoom: 1 / DPR },
  render: { antialias: true },
  input: { activePointers: 3 }, // joystick + bombă + încă un deget
  scene: [ArenaScene],
});

const onResize = () => {
  const s = viewportSize();
  game.scale.resize(s.width, s.height);
};
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
