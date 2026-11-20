// B2-R6: renders the Reactor Thunder buffers off the main thread (systems/b2Thunder.js; a pure,
// seeded function of the sample rate, so the result is identical to the main-thread fallback).
import { renderThunder } from './b2Thunder.js';

self.onmessage = (e) => {
  const sr = e.data && e.data.sr;
  const t0 = performance.now();
  const r = renderThunder(sr);
  const ms = performance.now() - t0;
  const msg = { sr: r.sr, pre: r.pre, L: r.L, R: r.R, impacts: r.impacts, info: r.info, ms };
  self.postMessage(msg, [r.pre.buffer, r.L.buffer, r.R.buffer, ...r.impacts.map((b) => b.buffer)]);
};
