import Phaser from 'phaser';
import { THEME } from './theme.js';
import { VillageScene } from './scenes/VillageScene.js';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: THEME.canvas.width,
  height: THEME.canvas.height,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: {
    target: THEME.canvas.fps,
    forceSetTimeOut: true,
  },
  scene: [VillageScene],
};

export const game = new Phaser.Game(config);
