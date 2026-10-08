/* global __dirname */
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), ts = require("typescript");
const filename = path.resolve(__dirname, "../src/checkup-schedule.ts"), loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { checkupSchedule } = loaded.exports;
const records = [{ id: "tomorrow", scheduled_at: "2026-10-09T08:00:00" }, { id: "elapsed", scheduled_at: "2026-10-08T09:00:00" }, { id: "later", scheduled_at: "2026-10-08T17:00:00" }, { id: "nearest", scheduled_at: "2026-10-08T14:00:00" }];
test("Today includes passed and future times but excludes other dates", () => {
  const result = checkupSchedule(records, new Date(2026, 9, 8, 12));
  assert.deepEqual(result.today.map(x => x.id), ["elapsed", "nearest", "later"]);
  assert.deepEqual(result.past.map(x => x.id), ["elapsed"]);
  assert.equal(result.next.id, "nearest");
});
test("after today's last checkup the next is tomorrow while Today retains its records", () => {
  const result = checkupSchedule(records, new Date(2026, 9, 8, 18));
  assert.equal(result.today.length, 3); assert.equal(result.past.length, 3);
  assert.equal(result.next.id, "tomorrow");
});
test("chronology uses timestamps, not ISO string ordering across timezone offsets", () => {
  const result = checkupSchedule([{ id: "early", scheduled_at: "2026-10-08T15:00:00+05:30" }, { id: "late", scheduled_at: "2026-10-08T10:00:00Z" }], new Date("2026-10-08T09:00:00Z"));
  assert.equal(result.next.id, "early");
});
