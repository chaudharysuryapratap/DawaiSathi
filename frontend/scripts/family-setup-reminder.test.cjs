const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness() {
  let callback, delay, cleared = false;
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/family-setup-reminder.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: module.exports, module,
    setInterval: (fn, ms) => { callback = fn; delay = ms; return 1; },
    clearInterval: () => { cleared = true; },
  });
  return { schedule: module.exports.scheduleFamilySetupReminder, tick: () => callback(), delay: () => delay, cleared: () => cleared };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('prompts after two minutes only if server reports no family', async () => {
  const h = harness(); let prompts = 0, empty = true;
  const stop = h.schedule(async () => empty, () => prompts++);
  assert.equal(h.delay(), 120000);
  assert.equal(prompts, 0);
  h.tick(); await settle(); assert.equal(prompts, 1);
  empty = false;
  h.tick(); await settle(); assert.equal(prompts, 1);
  stop(); assert.equal(h.cleared(), true);
});
test('cancellation suppresses in-flight response', async () => {
  const h = harness(); let resolve, prompts = 0;
  const stop = h.schedule(() => new Promise(r => { resolve = r; }), () => prompts++);
  h.tick(); stop(); resolve(true); await settle();
  assert.equal(prompts, 0);
});
test('offline check does not open a stale prompt and retries next interval', async () => {
  const h = harness(); let offline = true, prompts = 0;
  h.schedule(async () => { if (offline) throw new Error('offline'); return true; }, () => prompts++);
  h.tick(); await settle(); assert.equal(prompts, 0);
  offline = false; h.tick(); await settle(); assert.equal(prompts, 1);
});
