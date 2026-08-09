import Phaser from 'phaser';
import { VIEW } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HUDScene } from './systems/HUD.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { UpgradeScene } from './scenes/UpgradeScene.js';
import { DialogueScene } from './scenes/DialogueScene.js';
import { DebugScene } from './scenes/DebugScene.js';
import { ControlsScene } from './scenes/ControlsScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0a0c14',
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
  // Pixel-art renderer: keep source textures crisp (no antialias), but allow
  // sub-pixel rendered positions so camera/player motion glides instead of
  // snapping to the integer pixel grid each frame.
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: false,
  },
  input: {
    activePointers: 4,
  },
  scene: [BootScene, PreloadScene, TitleScene, IntroScene, GameScene, HUDScene, GameOverScene, PauseScene, UpgradeScene, DialogueScene, DebugScene, ControlsScene],
};

window.addEventListener('load', () => {
  // Canvas text (unlike DOM text) doesn't block on webfont load automatically —
  // if we start the game before Orbitron/Rajdhani are ready, the very first
  // frame bakes in the fallback font and never re-renders. Wait for
  // document.fonts.ready (capped so a stalled font load can't hang the boot).
  const ready = document.fonts?.ready ?? Promise.resolve();
  const timeout = new Promise((r) => setTimeout(r, 1500));
  Promise.race([ready, timeout]).then(() => {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
    const game = new Phaser.Game(config);
    if (import.meta.env.DEV) window.game = game;
  });
});
