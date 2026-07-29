// Runs every assertion smoke test in sequence and prints a summary.
//
// Sequential on purpose. Each test drives a real browser against the shared dev
// server on :5173 and several of them reposition enemies, pause physics or stop
// the game loop to take a measurement. Run in parallel they would corrupt each
// other's world state.
//
// Usage:  npm run smoke            (needs `npm run dev` already running)
//         npm run smoke -- --only cluster,flight
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// Assertion tests: these exit non-zero on failure and are what "the suite
// passing" means. The diagnostics (smoke-audio, smoke-fragsfx, diag-flight)
// only print numbers and are deliberately excluded — they have no pass/fail.
const TESTS = [
  'smoke-arc',
  'smoke-boost',
  'smoke-cluster',
  'smoke-debug',
  'smoke-depth',
  'smoke-flight',
  'smoke-hum',
  'smoke-leak',
];

const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > -1 ? (process.argv[onlyArg + 1] ?? '').split(',').filter(Boolean) : null;
const chosen = only ? TESTS.filter((t) => only.some((o) => t.includes(o))) : TESTS;

if (!chosen.length) {
  console.error(`no tests matched --only ${only?.join(',')}\navailable: ${TESTS.join(', ')}`);
  process.exit(2);
}

// Fail fast and loudly if the dev server is not up: otherwise every test dies
// with an inscrutable navigation error several minutes in.
try {
  const res = await fetch('http://localhost:5173/', { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`status ${res.status}`);
} catch (e) {
  console.error(`Dev server is not answering on :5173 (${e.message}).\nStart it first:  npm run dev`);
  process.exit(2);
}

const run = (name) => new Promise((resolve) => {
  const t0 = Date.now();
  const child = spawn(process.execPath, [join(HERE, `${name}.mjs`)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => {
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    const summary = out.trimEnd().split('\n').filter(Boolean).pop() ?? '(no output)';
    resolve({ name, code, secs, summary, out });
  });
});

const results = [];
for (const name of chosen) {
  process.stdout.write(`${name.padEnd(16)} … `);
  const r = await run(name);
  results.push(r);
  console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.secs}s`);
  if (r.code !== 0) console.log(r.out.split('\n').slice(-25).join('\n'));
}

const failed = results.filter((r) => r.code !== 0);
console.log('\n' + '─'.repeat(60));
for (const r of results) console.log(`${r.code === 0 ? '  ok  ' : ' FAIL '} ${r.name.padEnd(16)} ${r.summary.slice(0, 70)}`);
console.log('─'.repeat(60));
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
