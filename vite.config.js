import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Build stamp. The deployed build is served from GitHub Pages and there was no
// way to tell from inside the game which one you were looking at — "I couldn't
// even tell if you deployed" is a fair complaint about a game with no version
// on screen. Resolved at build time so it cannot drift from what shipped.
const buildId = (() => {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    const when = new Date().toISOString().slice(5, 16).replace('T', ' ');
    return `${sha} ${when}`;
  } catch (_) {
    return 'dev';
  }
})();

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  base: './',
  publicDir: 'public',
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
