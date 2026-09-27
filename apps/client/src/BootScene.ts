import Phaser from 'phaser';
import { createRng, nextInt, TICK_HZ } from '@fitil/sim';
import { THEMES } from '@fitil/content';
import { Capacitor } from '@capacitor/core';
import { tapHaptic } from './haptics.ts';

/** Scenă de verificare a lanțului Phaser + sim + content + Capacitor. Se înlocuiește în Faza 2. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const theme = THEMES[0]!;
    const rng = createRng(1);
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(theme.ink);

    const title = this.add
      .text(width / 2, height / 2 - 30, 'FITIL', {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '56px',
        color: '#ffd23f',
      })
      .setOrigin(0.5);
    const info = this.add
      .text(
        width / 2,
        height / 2 + 30,
        `platformă: ${Capacitor.getPlatform()} · sim ${TICK_HZ} Hz · atinge ecranul`,
        {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: '#9ba1c6',
        },
      )
      .setOrigin(0.5);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const [c1, c2, c3] = theme.flame;
      const color = Phaser.Display.Color.HexStringToColor([c1, c2, c3][nextInt(rng, 3)]!).color;
      const dot = this.add.circle(p.x, p.y, 24, color);
      this.tweens.add({ targets: dot, scale: 2, alpha: 0, duration: 450, onComplete: () => dot.destroy() });
      tapHaptic();
    });

    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      title.setPosition(size.width / 2, size.height / 2 - 30);
      info.setPosition(size.width / 2, size.height / 2 + 30);
    });
  }
}
