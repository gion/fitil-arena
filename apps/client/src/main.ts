import Phaser from 'phaser';
import { BootScene } from './BootScene.ts';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#141726',
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  input: { activePointers: 3 }, // joystick + bombă + încă un deget
  scene: [BootScene],
});
