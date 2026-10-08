const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/family-code.ts");
const loaded = new Module(filename, module);
loaded.require = id => id === "expo-linking" ? {} : id === "react-native" ? { Platform: { OS: "android" } } : require(id);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
test("QR family codes accept expected formats and reject unrelated or unsafe data", () => {
  const parse = loaded.exports.familyCodeFromQr;
  const secure = 'FAM-' + 'A'.repeat(32);
  assert.equal(parse(secure), secure);
  assert.equal(parse('https://example.test/join-family?code=' + secure), secure);
  for (const value of ["0123-4567-89ab-cdef", "https://example.test/join-family?code=0123456789ABCDEF", "exp://test/--/join-family?code=0123456789ABCDEF", "frontend://join-family?code=0123456789ABCDEF"]) assert.equal(parse(value), "0123456789ABCDEF");
  for (const value of ["not a code", "javascript:alert(1)", "https://example.test/other?code=0123456789ABCDEF", "https://example.test/join-family?code=invalid"]) assert.equal(parse(value), null);
});
