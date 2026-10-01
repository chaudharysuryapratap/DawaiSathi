const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadErrorMessage() {
  const sourcePath = path.resolve("src", "utils", "error-message.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports }, { filename: sourcePath });
  return module.exports;
}

function loadApi(fetchImplementation) {
  const errorMessage = loadErrorMessage();
  const sourcePath = path.resolve("src", "api.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    fetch: fetchImplementation,
    Headers,
    process,
    require(id) {
      if (id === "expo-constants") return { default: { expoConfig: null } };
      if (id === "react-native") return { Platform: { OS: "web" } };
      if (id === "./utils/error-message") return errorMessage;
      throw new Error(`Unexpected import: ${id}`);
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return module.exports.api;
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
  };
}

test("API errors parse FastAPI validation details and redact credentials", async () => {
  const api = loadApi(async () =>
    response(422, {
      detail: [
        { loc: ["body", "email"], msg: "value is not a valid email" },
        { loc: ["body", "password"], msg: "Request failed: Bearer opaque-secret" },
      ],
    }),
  );

  await assert.rejects(api.login("person@example.com", "password"), (error) => {
    assert.equal(error.name, "ApiRequestError");
    assert.match(error.message, /email: value is not a valid email/);
    assert.match(error.message, /Bearer \[redacted\]/);
    assert.doesNotMatch(error.message, /opaque-secret|password\]/);
    assert.doesNotMatch(error.message, /\[object Object\]/);
    return true;
  });
});

test("API errors handle string and nested object messages without leaking secrets", async () => {
  const stringApi = loadApi(async () => response(400, "Invalid request"));
  await assert.rejects(stringApi.login("person@example.com", "password"), {
    message: "Invalid request",
  });

  const objectApi = loadApi(async () =>
    response(400, { detail: { message: "Authentication failed; token=opaque-secret" } }),
  );
  await assert.rejects(objectApi.login("person@example.com", "password"), (error) => {
    assert.equal(error.message, "Authentication failed; token=[redacted]");
    assert.doesNotMatch(error.message, /opaque-secret|\[object Object\]/);
    return true;
  });
});

test("network errors use a credential-free sign-in message", async () => {
  const api = loadApi(async () => {
    throw new Error("network failed with password=secret-value");
  });

  await assert.rejects(api.login("person@example.com", "password"), (error) => {
    assert.equal(
      error.message,
      "Could not reach the DawaiSathi server. Check that it is running and try again.",
    );
    assert.doesNotMatch(error.message, /secret-value|\[object Object\]/);
    return true;
  });
});
