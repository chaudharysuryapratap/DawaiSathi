/* global __dirname */
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), Module = require("node:module"), ts = require("typescript");
const filename = path.resolve(__dirname, "../src/dose-status.ts"), loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { relativeCheckup } = loaded.exports;
test("tomorrow less than 24 hours away is not labelled Today", () => {
  assert.ok(relativeCheckup("2026-10-09T13:00:00", new Date(2026, 9, 8, 22)).startsWith("Tomorrow"));
});
test("earlier checkup on the same local date still reads Today", () => {
  assert.ok(relativeCheckup("2026-10-08T09:00:00", new Date(2026, 9, 8, 22)).startsWith("Today"));
});
test("calendar date comparison handles month and year boundaries", () => {
  assert.ok(relativeCheckup("2027-01-01T01:00:00", new Date(2026, 11, 31, 23)).startsWith("Tomorrow"));
  assert.ok(!relativeCheckup("2026-10-07T23:30:00", new Date(2026, 9, 8, 0, 1)).startsWith("Today"));
});
