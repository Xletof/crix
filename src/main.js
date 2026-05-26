import Phaser from 'phaser';
import { VIEW } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './systems/HUD.js';
import { GameOverScene } from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0d12',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW.width,
    height: VIEW.height,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 },
    },
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 4,
  },
  scene: [BootScene, PreloadScene, TitleScene, GameScene, HUDScene, GameOverScene],
};

window.addEventListener('load', () => {
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  const game = new Phaser.Game(config);
  if (import.meta.env.DEV) window.game = game;
});
