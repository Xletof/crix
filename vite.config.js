import { defineConfig } from 'vite';

export default defineConfig({
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
